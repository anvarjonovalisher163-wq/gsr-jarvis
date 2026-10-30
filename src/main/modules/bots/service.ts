import { Bot } from 'grammy'
import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import type { BotRuleInput, BotView } from '@shared/ipc'
import type { BotRule, PublicBot } from '@shared/types'
import { botRulesRepo, botsRepo, botSubscribersRepo } from '../../db/repositories'
import { encrypt, isEncryptionAvailable, mask } from '../../security/crypto'
import { AppError } from '../../errors'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'
import { withTimeout } from '../../utils/timeout'
import { allowMediaPaths } from '../posting/media'
import { botManager } from './botManager'
import { mapBotError } from './errors'

const log = createLogger('bots')

const TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/

export function toBotView(b: PublicBot): BotView {
  return {
    ...b,
    running: botManager.isRunning(b.id),
    subscribers: botSubscribersRepo.countActive(b.id),
    lastError: botManager.lastError(b.id)
  }
}

export function listBotViews(): BotView[] {
  return botsRepo.listPublic().map(toBotView)
}

export function emitBotsChanged(): BotView[] {
  const views = listBotViews()
  broadcast('bots:changed', views)
  return views
}

export async function addBot(rawToken: string): Promise<BotView> {
  const token = rawToken.trim()
  if (!TOKEN_RE.test(token)) {
    throw new AppError('BOT_TOKEN_FORMAT', "Token formati noto'g'ri. @BotFather bergan tokenni to'liq nusxalang: 123456789:AAH...")
  }
  if (!isEncryptionAvailable()) {
    throw new AppError('ENCRYPTION_UNAVAILABLE', "Tizimda shifrlash xizmati mavjud emas — tokenni xavfsiz saqlab bo'lmaydi.")
  }

  let me
  try {
    me = await withTimeout(new Bot(token).api.getMe(), 20_000, 'NETWORK', "Telegram Bot API javob bermadi.")
  } catch (e) {
    throw mapBotError(e)
  }

  const saved = botsRepo.upsert({ username: me.username, title: me.first_name, token_encrypted: encrypt(token) })
  log.info(`Bot qo'shildi: @${me.username} (token ${mask(token)})`)

  try {
    await botManager.start(saved.id)
  } catch (e) {
    // Qo'shildi, lekin polling boshlanmadi (masalan 409) — UI'da xato ko'rinadi
    log.warn(`Bot @${me.username} qo'shildi, lekin ishga tushmadi`, e)
  }
  emitBotsChanged()
  return toBotView(saved)
}

export async function removeBot(id: number): Promise<void> {
  const bot = botsRepo.getById(id)
  if (!bot) throw new AppError('NOT_FOUND', 'Bot topilmadi.')
  await botManager.stop(id)
  botsRepo.remove(id)
  log.info(`Bot o'chirildi: @${bot.username}`)
  emitBotsChanged()
}

// --- Qoidalar ---

function validateRule(r: BotRuleInput): void {
  if (!botsRepo.getById(r.bot_id)) throw new AppError('NOT_FOUND', 'Bot topilmadi.')
  if (r.trigger_type !== 'any' && !r.trigger_value?.trim()) {
    throw new AppError('RULE_TRIGGER_EMPTY', r.trigger_type === 'command' ? 'Buyruq nomini kiriting (masalan: narx).' : "Kalit so'zni kiriting.")
  }
  if (!r.reply_text.trim() && !r.reply_media) throw new AppError('RULE_REPLY_EMPTY', 'Javob matni yoki media kiriting.')
  if (r.reply_text.length > 4096) throw new AppError('TEXT_TOO_LONG', "Javob 4096 belgidan oshmasligi kerak.")
  for (const row of r.reply_buttons) {
    for (const b of row) {
      if (!b.text.trim()) throw new AppError('BUTTON_TEXT_EMPTY', 'Tugma matni bo\'sh.')
      if (!/^(https?:\/\/|tg:\/\/)/i.test(b.url.trim())) throw new AppError('BUTTON_URL_INVALID', `Tugma havolasi noto'g'ri: "${b.url}"`)
    }
  }
}

export function saveRule(r: BotRuleInput): BotRule {
  validateRule(r)
  const trigger_value =
    r.trigger_type === 'any' ? null : r.trigger_type === 'command' ? r.trigger_value!.trim().replace(/^\//, '').toLowerCase() : r.trigger_value!.trim()
  const payload = {
    trigger_type: r.trigger_type,
    trigger_value,
    reply_text: r.reply_text,
    reply_media_json: r.reply_media ? JSON.stringify(r.reply_media) : null,
    reply_buttons_json: r.reply_buttons.length ? JSON.stringify(r.reply_buttons) : null,
    is_active: r.is_active
  }
  if (r.reply_media) allowMediaPaths([r.reply_media])

  if (r.id) {
    const updated = botRulesRepo.update(r.id, payload)
    if (!updated) throw new AppError('NOT_FOUND', 'Qoida topilmadi.')
    return updated
  }
  const count = botRulesRepo.list(r.bot_id).length
  return botRulesRepo.create({ bot_id: r.bot_id, ...payload, sort_order: count })
}

export function listRules(botId: number): BotRule[] {
  const rules = botRulesRepo.list(botId)
  for (const r of rules) {
    if (r.reply_media_json) {
      try {
        allowMediaPaths([JSON.parse(r.reply_media_json)])
      } catch {
        /* buzilgan json — e'tiborsiz */
      }
    }
  }
  return rules
}

// --- Obunachilar CSV ---

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportSubscribersCsv(botId: number, win: BrowserWindow | null): Promise<{ path: string | null; count: number }> {
  const bot = botsRepo.getById(botId)
  if (!bot) throw new AppError('NOT_FOUND', 'Bot topilmadi.')
  const rows = botSubscribersRepo.list(botId, { limit: 1_000_000 })

  const opts: Electron.SaveDialogOptions = {
    title: 'Obunachilarni eksport qilish',
    defaultPath: `${bot.username}-obunachilar.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  }
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (res.canceled || !res.filePath) return { path: null, count: rows.length }

  const header = ['tg_user_id', 'username', 'first_name', 'subscribed_at', 'unsubscribed_at', 'tags']
  const lines = [header.join(';')]
  for (const r of rows) {
    lines.push([r.tg_user_id, r.username, r.first_name, r.subscribed_at, r.unsubscribed_at, r.tags].map(csvCell).join(';'))
  }
  // BOM — Excel kirillcha/o'zbekcha belgilarni to'g'ri ochishi uchun
  writeFileSync(res.filePath, '﻿' + lines.join('\r\n'), 'utf8')
  log.info(`CSV eksport: @${bot.username}, ${rows.length} ta qator → ${res.filePath}`)
  return { path: res.filePath, count: rows.length }
}
