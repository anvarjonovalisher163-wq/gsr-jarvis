import { InputFile, type Api as BotApi, type RawApi } from 'grammy'
import type { BroadcastInput, BroadcastReport, BroadcastView } from '@shared/ipc'
import type { Broadcast, BotSubscriber, MediaItem, UrlButton } from '@shared/types'
import { LIMITS } from '@shared/media'
import {
  botsRepo,
  botSubscribersRepo,
  broadcastDeliveriesRepo,
  broadcastsRepo,
  settingsRepo,
  SettingKeys
} from '../../db/repositories'
import { AppError } from '../../errors'
import { broadcast as emit } from '../../events'
import { createLogger } from '../../logger'
import { allowMediaPaths } from '../posting/media'
import { botManager } from './botManager'
import { isBlockedError, mapBotError } from './errors'
import { buildKeyboard, parseButtonsJson, parseMediaJson } from './handlers'
import { assertCanSend } from '../license/limits'

const log = createLogger('broadcast')

/**
 * Bot API limiti: ~30 xabar/soniya umumiy, rassilkada 25 dan oshmaslik tavsiya etiladi.
 * Biz 20/s dan oshmaymiz (xavfsiz zaxira): har xabardan keyin kamida 50ms.
 */
const MIN_INTERVAL_MS = 50
/** UI'ga progress yuborish chastotasi. */
const PROGRESS_EVERY_MS = 400
/** Rejali rassilkalar tekshiruvi. */
const SCHEDULE_TICK_MS = 30_000

export const STOP_FOOTER = '\n\nObunadan chiqish: /stop'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Control = { pause: boolean; cancel: boolean }

class BroadcastRunner {
  private running = new Map<number, Control>()
  private timer: NodeJS.Timeout | null = null

  /** Ilova ochilganda: yarim qolganlarni davom ettiradi, rejalilarni kuzatadi. */
  init(): void {
    for (const b of broadcastsRepo.listResumable()) {
      if (b.status === 'running') {
        log.info(`Rassilka ${b.id} yarim qolgan — davom ettirilmoqda`)
        this.run(b.id).catch((e) => log.error(`Rassilka ${b.id} davom etmadi`, e))
      }
    }
    this.timer = setInterval(() => this.tick(), SCHEDULE_TICK_MS)
    this.tick()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    // Ishlayotganlarni pauza emas, "running" holatida qoldiramiz — keyingi ochilishda davom etadi
    for (const c of this.running.values()) c.cancel = true
  }

  private tick(): void {
    const now = Date.now()
    for (const b of broadcastsRepo.listResumable()) {
      if (b.status === 'scheduled' && b.scheduled_at && Date.parse(b.scheduled_at) <= now && !this.running.has(b.id)) {
        log.info(`Rassilka ${b.id}: rejali vaqt keldi`)
        this.run(b.id).catch((e) => log.error(`Rassilka ${b.id} boshlanmadi`, e))
      }
    }
  }

  isActive(id: number): boolean {
    return this.running.has(id)
  }

  pause(id: number): void {
    const c = this.running.get(id)
    if (c) c.pause = true
    else broadcastsRepo.setStatus(id, 'paused')
  }

  cancel(id: number): void {
    const c = this.running.get(id)
    if (c) c.cancel = true
    else broadcastsRepo.setStatus(id, 'cancelled')
  }

  /** Auditoriyani ketma-ket yuboradi; yetkazilganlar broadcast_deliveries da — qayta yuborilmaydi. */
  async run(id: number): Promise<void> {
    if (this.running.has(id)) return
    const b = broadcastsRepo.getById(id)
    if (!b) throw new AppError('NOT_FOUND', 'Rassilka topilmadi.')

    let api: BotApi<RawApi>
    try {
      api = botManager.getBot(b.bot_id).api
    } catch (e) {
      // Bot o'chiq — pauzaga qo'yamiz, foydalanuvchi botni yoqib davom ettiradi
      broadcastsRepo.setStatus(id, 'paused')
      this.emitView(id)
      throw e
    }

    const control: Control = { pause: false, cancel: false }
    this.running.set(id, control)

    const audience = botSubscribersRepo.listActiveForBroadcast(b.bot_id, b.tag_filter)
    const done = broadcastDeliveriesRepo.processedSubscriberIds(id)
    const todo = audience.filter((s) => !done.has(s.id))
    try {
      assertCanSend(todo.length)
    } catch (e) {
      this.running.delete(id)
      broadcastsRepo.setStatus(id, 'paused')
      this.emitView(id)
      throw e
    }
    broadcastsRepo.setTotal(id, audience.length)
    broadcastsRepo.setStatus(id, 'running')
    this.emitView(id)
    log.info(`Rassilka ${id} (@${botsRepo.getById(b.bot_id)?.username}): ${todo.length}/${audience.length} ta qoldi`)

    const payload = this.buildPayload(b)
    let lastEmit = 0

    try {
      for (const sub of todo) {
        if (control.cancel || control.pause) break
        const t0 = Date.now()
        await this.sendOne(api, id, sub, payload, control)
        if (Date.now() - lastEmit > PROGRESS_EVERY_MS) {
          this.emitView(id)
          lastEmit = Date.now()
        }
        const elapsed = Date.now() - t0
        if (elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed)
      }
    } finally {
      this.running.delete(id)
    }

    const fresh = broadcastsRepo.getById(id)!
    if (control.cancel) {
      if (fresh.status === 'running') broadcastsRepo.setStatus(id, 'cancelled')
    } else if (control.pause) {
      broadcastsRepo.setStatus(id, 'paused')
    } else {
      broadcastsRepo.setStatus(id, 'done')
    }
    const v = this.emitView(id)
    log.info(`Rassilka ${id}: ${v.status}, yuborildi ${v.sent}, xato ${v.failed}, bloklagan ${v.blocked}`)
  }

  private buildPayload(b: Broadcast) {
    const footer = settingsRepo.get(SettingKeys.broadcastFooter) === '1' ? STOP_FOOTER : ''
    return {
      text: b.text + footer,
      media: parseMediaJson(b.media_json),
      reply_markup: buildKeyboard(parseButtonsJson(b.buttons_json))
    }
  }

  private async sendOne(
    api: BotApi<RawApi>,
    broadcastId: number,
    sub: BotSubscriber,
    p: { text: string; media: MediaItem | null; reply_markup: ReturnType<typeof buildKeyboard> },
    control: Control
  ): Promise<void> {
    const chatId = Number(sub.tg_user_id)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (p.media) {
          const file = new InputFile(p.media.path)
          const opts = { caption: p.text || undefined, parse_mode: 'HTML' as const, reply_markup: p.reply_markup }
          if (p.media.kind === 'photo') await api.sendPhoto(chatId, file, opts)
          else if (p.media.kind === 'video') await api.sendVideo(chatId, file, opts)
          else await api.sendDocument(chatId, file, opts)
        } else {
          await api.sendMessage(chatId, p.text, { parse_mode: 'HTML', reply_markup: p.reply_markup })
        }
        broadcastDeliveriesRepo.record(broadcastId, sub.id, 'sent')
        broadcastsRepo.incrementProgress(broadcastId, 1, 0)
        return
      } catch (e) {
        if (isBlockedError(e)) {
          // Bot bloklangan/o'chirilgan — obunadan chiqaramiz, boshqa urinmaymiz
          botSubscribersRepo.unsubscribe(sub.bot_id, sub.tg_user_id)
          broadcastDeliveriesRepo.record(broadcastId, sub.id, 'blocked', 'Foydalanuvchi botni bloklagan')
          broadcastsRepo.incrementProgress(broadcastId, 0, 1)
          emit('subscribers:changed', { botId: sub.bot_id })
          return
        }
        const err = mapBotError(e)
        if (err.code === 'FLOOD_WAIT' && attempt < 2 && !control.cancel) {
          const wait = (err.retryAfter ?? 5) + 1
          log.warn(`Rassilka ${broadcastId}: 429, ${wait}s kutilmoqda`)
          await sleep(wait * 1000)
          continue
        }
        broadcastDeliveriesRepo.record(broadcastId, sub.id, 'failed', `${err.code}: ${err.message}`)
        broadcastsRepo.incrementProgress(broadcastId, 0, 1)
        return
      }
    }
  }

  private emitView(id: number): BroadcastView {
    const v = toBroadcastView(broadcastsRepo.getById(id)!)
    emit('broadcasts:changed', v)
    return v
  }
}

export const broadcastRunner = new BroadcastRunner()

// --- Service ---

export function toBroadcastView(b: Broadcast): BroadcastView {
  const counts = broadcastDeliveriesRepo.counts(b.id)
  const media = parseMediaJson(b.media_json)
  if (media) allowMediaPaths([media])
  return {
    ...b,
    // Hisoblagichlarni deliveries'dan olamiz — qayta ochilganda ham aniq
    sent: counts.sent,
    failed: counts.failed + counts.blocked,
    blocked: counts.blocked,
    bot_username: botsRepo.getById(b.bot_id)?.username ?? '?'
  }
}

export function listBroadcasts(botId?: number): BroadcastView[] {
  return broadcastsRepo.list(botId).map(toBroadcastView)
}

export async function createBroadcast(input: BroadcastInput): Promise<BroadcastView> {
  if (!botsRepo.getById(input.bot_id)) throw new AppError('NOT_FOUND', 'Bot topilmadi.')
  const text = input.text.trim()
  if (!text && !input.media) throw new AppError('BROADCAST_EMPTY', 'Matn yoki media kiriting.')
  const max = input.media ? LIMITS.captionMax : LIMITS.textMax
  if (text.length > max) throw new AppError('TEXT_TOO_LONG', `Matn ${max} belgidan oshmasligi kerak (hozir ${text.length}).`)
  for (const row of input.buttons) {
    for (const btn of row as UrlButton[]) {
      if (!btn.text.trim()) throw new AppError('BUTTON_TEXT_EMPTY', "Tugma matni bo'sh.")
      if (!/^(https?:\/\/|tg:\/\/)/i.test(btn.url.trim())) throw new AppError('BUTTON_URL_INVALID', `Tugma havolasi noto'g'ri: "${btn.url}"`)
    }
  }
  if (input.scheduledAt) {
    const at = Date.parse(input.scheduledAt)
    if (Number.isNaN(at)) throw new AppError('SCHEDULE_INVALID', "Vaqt noto'g'ri.")
    if (at - Date.now() < LIMITS.scheduleMinSec * 1000) throw new AppError('SCHEDULE_TOO_SOON', "Vaqt kamida 1 daqiqa keyin bo'lishi kerak.")
  }
  const audience = botSubscribersRepo.listActiveForBroadcast(input.bot_id, input.tag_filter || null).length
  if (audience === 0) throw new AppError('NO_AUDIENCE', "Bu botda faol obunachi yo'q.")
  assertCanSend(audience)
  if (!input.scheduledAt) botManager.getBot(input.bot_id) // bot o'chiq bo'lsa darhol xato

  const b = broadcastsRepo.create({
    bot_id: input.bot_id,
    text,
    media_json: input.media ? JSON.stringify(input.media) : null,
    buttons_json: input.buttons.length ? JSON.stringify(input.buttons) : null,
    tag_filter: input.tag_filter || null,
    scheduled_at: input.scheduledAt
  })
  if (input.media) allowMediaPaths([input.media])
  log.info(`Rassilka ${b.id} yaratildi${input.scheduledAt ? ` (reja: ${input.scheduledAt})` : ''}`)

  if (!input.scheduledAt) {
    // Fonda ishlaydi; progress broadcasts:changed orqali keladi
    broadcastRunner.run(b.id).catch((e) => log.error(`Rassilka ${b.id} xato bilan to'xtadi`, e))
  }
  return toBroadcastView(broadcastsRepo.getById(b.id)!)
}

export function pauseBroadcast(id: number): BroadcastView {
  const b = broadcastsRepo.getById(id)
  if (!b) throw new AppError('NOT_FOUND', 'Rassilka topilmadi.')
  if (b.status !== 'running') throw new AppError('BROADCAST_NOT_RUNNING', "Rassilka ishlamayapti.")
  broadcastRunner.pause(id)
  return toBroadcastView(broadcastsRepo.getById(id)!)
}

export async function resumeBroadcast(id: number): Promise<BroadcastView> {
  const b = broadcastsRepo.getById(id)
  if (!b) throw new AppError('NOT_FOUND', 'Rassilka topilmadi.')
  if (b.status !== 'paused') throw new AppError('BROADCAST_NOT_PAUSED', "Faqat pauzadagi rassilkani davom ettirish mumkin.")
  botManager.getBot(b.bot_id)
  broadcastRunner.run(id).catch((e) => log.error(`Rassilka ${id} davom etmadi`, e))
  await sleep(50)
  return toBroadcastView(broadcastsRepo.getById(id)!)
}

export function cancelBroadcast(id: number): BroadcastView {
  const b = broadcastsRepo.getById(id)
  if (!b) throw new AppError('NOT_FOUND', 'Rassilka topilmadi.')
  if (!['running', 'paused', 'scheduled'].includes(b.status)) {
    throw new AppError('BROADCAST_FINISHED', 'Bu rassilka allaqachon tugagan.')
  }
  broadcastRunner.cancel(id)
  if (b.status !== 'running') broadcastsRepo.setStatus(id, 'cancelled')
  log.info(`Rassilka ${id} bekor qilindi`)
  return toBroadcastView(broadcastsRepo.getById(id)!)
}

export function deleteBroadcast(id: number): void {
  const b = broadcastsRepo.getById(id)
  if (!b) return
  if (b.status === 'running' || broadcastRunner.isActive(id)) {
    throw new AppError('BROADCAST_RUNNING', "Ishlayotgan rassilkani o'chirib bo'lmaydi — avval bekor qiling.")
  }
  broadcastsRepo.remove(id)
}

export function broadcastReport(id: number): BroadcastReport {
  const b = broadcastsRepo.getById(id)
  if (!b) throw new AppError('NOT_FOUND', 'Rassilka topilmadi.')
  return { broadcast: toBroadcastView(b), problems: broadcastDeliveriesRepo.listProblems(id) }
}
