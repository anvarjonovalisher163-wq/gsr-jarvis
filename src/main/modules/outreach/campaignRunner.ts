import type { TelegramClient } from 'telegram'
import type { CampaignSettings, CampaignView } from '@shared/outreach'
import type { CampaignRecipient } from '@shared/types'
import { accountsRepo, blacklistRepo, campaignsRepo, sendLogRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { inputPeerFor } from '../chats/peers'
import { assertCanSend } from '../license/limits'
import {
  emitCampaign,
  getCampaignView,
  parseCampaignMedia,
  parseSettings,
  resumeAtMap
} from './campaigns'

const log = createLogger('campaigns')

const SCHEDULE_TICK_MS = 30_000
const PROGRESS_EVERY_MS = 500
/** FLOOD_WAIT shundan uzun bo'lsa avtomatik davom etmaymiz — foydalanuvchi o'zi qaror qiladi. */
const AUTO_RESUME_MAX_SEC = 2 * 3600
/** Kunlik limit to'lganda qayta urinish. */
const DAILY_LIMIT_RETRY_MS = 60 * 60_000

/** Akkauntni to'xtatadigan xatolar — kampaniya pauza, shu akkauntdan bugun boshqa yuborilmaydi. */
const STOP_CODES = new Set([
  'PEER_FLOOD',
  'USER_DEACTIVATED',
  'USER_DEACTIVATED_BAN',
  'AUTH_KEY_UNREGISTERED',
  'SESSION_REVOKED'
])
/** Qabul qiluvchi bo'yicha xato — keyingisiga o'tamiz. */
const RECIPIENT_MESSAGES: Record<string, string> = {
  USER_IS_BLOCKED: 'Foydalanuvchi sizni bloklagan',
  USER_PRIVACY_RESTRICTED: 'Maxfiylik sozlamalari xabarga ruxsat bermaydi',
  INPUT_USER_DEACTIVATED: "Foydalanuvchi akkaunti o'chirilgan",
  PEER_ID_INVALID: 'Chat topilmadi',
  PEER_UNKNOWN: "Chat topilmadi — bu odam bilan dialog yo'q",
  CHAT_WRITE_FORBIDDEN: 'Yozish taqiqlangan',
  USER_BANNED_IN_CHANNEL: 'Yozish taqiqlangan'
}

type Control = { pause: boolean; cancel: boolean }
const rand = (min: number, max: number) => Math.round(min + Math.random() * Math.max(0, max - min))

class CampaignRunner {
  private running = new Map<number, Control>()
  private timers = new Map<number, NodeJS.Timeout>()
  private tickTimer: NodeJS.Timeout | null = null

  init(): void {
    for (const c of campaignsRepo.listResumable()) {
      if (c.status === 'running') {
        // Ilova yopilib qolgan — akkaunt ulangach davom etadi (tick orqali)
        campaignsRepo.setStatus(
          c.id,
          'paused',
          'Ilova qayta ochildi — davom ettirish uchun ▶ bosing'
        )
      }
    }
    this.tickTimer = setInterval(() => this.tick(), SCHEDULE_TICK_MS)
    this.tick()
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer)
    for (const t of this.timers.values()) clearTimeout(t)
    for (const c of this.running.values()) c.pause = true
  }

  private tick(): void {
    const now = Date.now()
    for (const c of campaignsRepo.listResumable()) {
      if (
        c.status === 'scheduled' &&
        c.scheduled_at &&
        Date.parse(c.scheduled_at) <= now &&
        !this.running.has(c.id)
      ) {
        if (!clientManager.isConnected(c.account_id)) continue // akkaunt ulangach boshlanadi
        log.info(`Kampaniya ${c.id}: rejali vaqt keldi`)
        this.run(c.id).catch((e) => log.error(`Kampaniya ${c.id} boshlanmadi`, e))
      }
    }
  }

  isActive(id: number): boolean {
    return this.running.has(id)
  }

  start(id: number): CampaignView {
    const c = campaignsRepo.getById(id)
    if (!c) throw new AppError('NOT_FOUND', 'Kampaniya topilmadi.')
    if (this.running.has(id)) return getCampaignView(id)
    if (c.status === 'done' || c.status === 'cancelled')
      throw new AppError('CAMPAIGN_FINISHED', 'Kampaniya allaqachon tugagan.')
    if (campaignsRepo.recipients(id, 'pending').length === 0)
      throw new AppError('CAMPAIGN_EMPTY', "Yuboriladigan qabul qiluvchi yo'q.")
    clientManager.getClient(c.account_id) // ulanmagan bo'lsa AppError
    this.clearTimer(id)
    this.run(id).catch((e) => log.error(`Kampaniya ${id} xato bilan to'xtadi`, e))
    return getCampaignView(id)
  }

  pause(id: number): CampaignView {
    const ctl = this.running.get(id)
    this.clearTimer(id)
    if (ctl) ctl.pause = true
    else campaignsRepo.setStatus(id, 'paused')
    return emitCampaign(id)
  }

  cancel(id: number): CampaignView {
    const ctl = this.running.get(id)
    this.clearTimer(id)
    if (ctl) ctl.cancel = true
    else campaignsRepo.setStatus(id, 'cancelled')
    return emitCampaign(id)
  }

  private clearTimer(id: number): void {
    const t = this.timers.get(id)
    if (t) clearTimeout(t)
    this.timers.delete(id)
    resumeAtMap.delete(id)
  }

  /** Kutib keyin avtomatik davom etish (FLOOD_WAIT, kunlik limit). Hech qachon boshqa akkauntga o'tmaydi. */
  private scheduleResume(id: number, ms: number, reason: string): void {
    this.clearTimer(id)
    const at = new Date(Date.now() + ms).toISOString()
    resumeAtMap.set(id, at)
    campaignsRepo.setStatus(id, 'paused', reason)
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id)
        resumeAtMap.delete(id)
        const c = campaignsRepo.getById(id)
        if (!c || c.status !== 'paused') return
        log.info(`Kampaniya ${id}: kutish tugadi, davom etmoqda`)
        this.run(id).catch((e) => log.error(`Kampaniya ${id} davom etmadi`, e))
      }, ms)
    )
    emitCampaign(id)
  }

  private async sleepInterruptible(ms: number, ctl: Control): Promise<void> {
    const until = Date.now() + ms
    while (Date.now() < until && !ctl.pause && !ctl.cancel) {
      await new Promise((r) => setTimeout(r, Math.min(500, until - Date.now())))
    }
  }

  async run(id: number): Promise<void> {
    if (this.running.has(id)) return
    const c = campaignsRepo.getById(id)
    if (!c) return
    let client: TelegramClient
    try {
      client = clientManager.getClient(c.account_id)
    } catch (e) {
      campaignsRepo.setStatus(id, 'paused', 'Akkaunt ulanmagan')
      emitCampaign(id)
      throw e
    }
    const settings = parseSettings(c.settings_json)
    const media = parseCampaignMedia(c.media_json)
    const ctl: Control = { pause: false, cancel: false }
    this.running.set(id, ctl)
    campaignsRepo.setStatus(id, 'running')
    emitCampaign(id)
    const acc = accountsRepo.getById(c.account_id)
    log.info(
      `Kampaniya ${id} boshlandi (${acc?.phone}): ${campaignsRepo.recipients(id, 'pending').length} ta qoldi`
    )

    let lastEmit = 0
    let sentInGroup = 0
    let outcome: 'done' | 'paused' | 'cancelled' = 'done'
    let pauseReason: string | null = null
    let resumeMs: number | null = null

    try {
      const pending = campaignsRepo.recipients(id, 'pending')
      const black = blacklistRepo.idSet()
      for (let i = 0; i < pending.length; i++) {
        if (ctl.cancel || ctl.pause) break
        const r = pending[i]

        if (black.has(r.peer_id.replace(/^u/, ''))) {
          campaignsRepo.markRecipient(r.id, 'skipped', "Qora ro'yxatda")
          continue
        }
        if (settings.onlyNew && sendLogRepo.everSent(c.account_id, r.peer_id)) {
          campaignsRepo.markRecipient(r.id, 'skipped', 'Avval yozilgan (faqat yangilarga)')
          continue
        }
        if (sendLogRepo.countLast24h(c.account_id) >= settings.dailyLimit) {
          pauseReason = `Kunlik limit (${settings.dailyLimit}) to'ldi — 1 soatdan keyin qayta tekshiriladi`
          resumeMs = DAILY_LIMIT_RETRY_MS
          break
        }
        try {
          assertCanSend(1)
        } catch (e) {
          pauseReason = e instanceof AppError ? e.message : 'Litsenziya cheklovi'
          break
        }

        const res = await this.sendOne(client, c.account_id, r, c.text, media)
        if (res.kind === 'sent') {
          sentInGroup++
        } else if (res.kind === 'flood') {
          const wait = res.seconds + 5
          pauseReason = `Telegram cheklovi (FLOOD_WAIT): ${Math.ceil(res.seconds / 60)} daqiqa kutish`
          resumeMs = wait <= AUTO_RESUME_MAX_SEC ? wait * 1000 : null
          break
        } else if (res.kind === 'stop') {
          pauseReason = res.message
          break
        }

        campaignsRepo.recount(id)
        if (Date.now() - lastEmit > PROGRESS_EVERY_MS) {
          emitCampaign(id)
          lastEmit = Date.now()
        }

        const more = i < pending.length - 1
        if (more) {
          if (sentInGroup >= settings.groupSize && settings.groupPauseMax > 0) {
            sentInGroup = 0
            await this.sleepInterruptible(
              rand(settings.groupPauseMin, settings.groupPauseMax) * 1000,
              ctl
            )
          } else if (res.kind === 'sent') {
            await this.sleepInterruptible(rand(settings.delayMin, settings.delayMax) * 1000, ctl)
          }
        }
      }
    } finally {
      this.running.delete(id)
      campaignsRepo.recount(id)
    }

    if (ctl.cancel) outcome = 'cancelled'
    else if (ctl.pause || pauseReason) outcome = 'paused'
    else if (campaignsRepo.recipients(id, 'pending').length > 0) outcome = 'paused'

    if (outcome === 'paused' && resumeMs !== null && !ctl.pause && !ctl.cancel) {
      this.scheduleResume(id, resumeMs, pauseReason ?? 'Kutilmoqda')
    } else {
      campaignsRepo.setStatus(id, outcome, outcome === 'paused' ? pauseReason : null)
      emitCampaign(id)
    }
    const v = getCampaignView(id)
    log.info(
      `Kampaniya ${id}: ${v.status}, yuborildi ${v.sent}, xato ${v.failed}, o'tkazildi ${v.skipped}${pauseReason ? ` — ${pauseReason}` : ''}`
    )
  }

  private async sendOne(
    client: TelegramClient,
    accountId: number,
    r: CampaignRecipient,
    text: string,
    media: ReturnType<typeof parseCampaignMedia>
  ): Promise<
    | { kind: 'sent' }
    | { kind: 'failed' }
    | { kind: 'flood'; seconds: number }
    | { kind: 'stop'; message: string }
  > {
    try {
      const peer = await inputPeerFor(client, accountId, r.peer_id)
      if (media) {
        await client.sendFile(peer, {
          file: media.path,
          caption: text || undefined,
          parseMode: 'html',
          forceDocument: media.kind === 'document'
        })
      } else {
        await client.sendMessage(peer, { message: text, parseMode: 'html' })
      }
      campaignsRepo.markRecipient(r.id, 'sent')
      sendLogRepo.record(accountId, r.peer_id, 'campaign')
      return { kind: 'sent' }
    } catch (e) {
      const err = mapTelegramError(e)
      if (err.code === 'FLOOD_WAIT') {
        log.warn(
          `Kampaniya: FLOOD_WAIT ${err.retryAfter}s (akkaunt ${accountId}) — kutamiz, boshqa akkauntga o'tilmaydi`
        )
        return { kind: 'flood', seconds: err.retryAfter ?? 60 }
      }
      if (STOP_CODES.has(err.code)) {
        campaignsRepo.markRecipient(r.id, 'failed', err.message)
        const msg =
          err.code === 'PEER_FLOOD'
            ? 'Telegram akkauntni vaqtincha chekladi (PEER_FLOOD). Bugun bu akkauntdan boshqa yubormang; ertaga davom eting.'
            : err.message
        log.error(`Kampaniya to'xtadi: ${err.code} (akkaunt ${accountId})`)
        return { kind: 'stop', message: msg }
      }
      campaignsRepo.markRecipient(r.id, 'failed', RECIPIENT_MESSAGES[err.code] ?? err.message)
      return { kind: 'failed' }
    }
  }
}

export const campaignRunner = new CampaignRunner()

export function resumeCampaign(id: number): CampaignView {
  return campaignRunner.start(id)
}

export function settingsSummary(s: CampaignSettings): string {
  return `${s.delayMin}–${s.delayMax}s, har ${s.groupSize} tadan keyin ${s.groupPauseMin}–${s.groupPauseMax}s, kuniga ${s.dailyLimit}`
}
