import { type Bot, type Context, InlineKeyboard, InputFile } from 'grammy'
import type { BotRule, MediaItem, UrlButton } from '@shared/types'
import { blacklistRepo, botRulesRepo, botSubscribersRepo } from '../../db/repositories'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'
import { isBlockedError } from './errors'

const log = createLogger('bots')

export const DEFAULT_WELCOME =
  "Assalomu alaykum! Siz botga obuna bo'ldingiz.\nObunadan chiqish uchun /stop yuboring."
export const DEFAULT_GOODBYE = "Siz obunadan chiqdingiz. Qayta obuna bo'lish uchun /start yuboring."

/** Deep-link parametri teg sifatida: faqat harf/raqam/_/-, 32 belgigacha. */
function sanitizeTag(raw: string | undefined): string | null {
  const t = (raw ?? '')
    .trim()
    .replace(/[^\w-]/g, '')
    .slice(0, 32)
  return t || null
}

/** "/narx", "narx", "/Narx@bot" → "narx" */
function normCommand(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/^\//, '').split('@')[0].toLowerCase()
}

export function parseMediaJson(json: string | null): MediaItem | null {
  if (!json) return null
  try {
    const v = JSON.parse(json)
    return v && typeof v === 'object' && 'path' in v ? (v as MediaItem) : null
  } catch {
    return null
  }
}

export function parseButtonsJson(json: string | null): UrlButton[][] {
  if (!json) return []
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? (v as UrlButton[][]) : []
  } catch {
    return []
  }
}

/** URL tugma qatorlaridan inline klaviatura (bo'sh/noto'g'ri tugmalar tashlab yuboriladi). */
export function buildKeyboard(rows: UrlButton[][]): InlineKeyboard | undefined {
  const valid = rows
    .map((r) => r.filter((b) => b.text && /^(https?:\/\/|tg:\/\/)/i.test(b.url)))
    .filter((r) => r.length)
  if (!valid.length) return undefined
  const kb = new InlineKeyboard()
  valid.forEach((row, i) => {
    row.forEach((b) => kb.url(b.text, b.url))
    if (i < valid.length - 1) kb.row()
  })
  return kb
}

/** Qoida javobini yuboradi: matn + ixtiyoriy media + URL tugmalar. */
export async function sendRuleReply(ctx: Context, rule: BotRule): Promise<void> {
  const media = parseMediaJson(rule.reply_media_json)
  const reply_markup = buildKeyboard(parseButtonsJson(rule.reply_buttons_json))
  const text = rule.reply_text

  const send = async (parse_mode: 'HTML' | undefined) => {
    if (media) {
      const file = new InputFile(media.path)
      const opts = { caption: text || undefined, parse_mode, reply_markup }
      if (media.kind === 'photo') return ctx.replyWithPhoto(file, opts)
      if (media.kind === 'video') return ctx.replyWithVideo(file, opts)
      return ctx.replyWithDocument(file, opts)
    }
    return ctx.reply(text, { parse_mode, reply_markup })
  }

  try {
    await send('HTML')
  } catch (e) {
    // HTML noto'g'ri bo'lsa (yopilmagan teg) oddiy matn sifatida yuboramiz
    const msg = e instanceof Error ? e.message : ''
    if (/can't parse entities/i.test(msg)) {
      log.warn(`Qoida ${rule.id}: HTML xato, oddiy matn yuborildi`)
      await send(undefined)
    } else throw e
  }
}

/** Faol qoidalar ichidan matnga mosini topadi: command → keyword → any. */
export function matchRule(rules: BotRule[], text: string): BotRule | undefined {
  const t = text.trim()
  const firstWord = normCommand(t.split(/\s+/)[0])
  const lower = t.toLowerCase()

  if (t.startsWith('/')) {
    const cmd = rules.find(
      (r) => r.trigger_type === 'command' && normCommand(r.trigger_value) === firstWord
    )
    if (cmd) return cmd
  }
  const kw = rules.find(
    (r) =>
      r.trigger_type === 'keyword' &&
      r.trigger_value &&
      lower.includes(r.trigger_value.toLowerCase())
  )
  if (kw) return kw
  return rules.find((r) => r.trigger_type === 'any')
}

export function registerHandlers(bot: Bot, botId: number): void {
  const priv = bot.chatType('private')
  const notify = () => broadcast('subscribers:changed', { botId })

  // Qora ro'yxatdagilarga bot javob bermaydi va ularni obunaga olmaydi
  priv.use(async (ctx, next) => {
    if (ctx.from && blacklistRepo.has(String(ctx.from.id))) return
    await next()
  })

  priv.command('start', async (ctx) => {
    const tag = sanitizeTag(ctx.match)
    botSubscribersRepo.subscribe(
      botId,
      {
        tg_user_id: String(ctx.from!.id),
        username: ctx.from!.username ?? null,
        first_name: ctx.from!.first_name ?? null
      },
      tag
    )
    notify()
    log.info(`Bot ${botId}: /start ${ctx.from!.id}${tag ? ` (teg: ${tag})` : ''}`)

    const rules = botRulesRepo.list(botId, true)
    const custom = rules.find(
      (r) => r.trigger_type === 'command' && normCommand(r.trigger_value) === 'start'
    )
    if (custom) await sendRuleReply(ctx, custom)
    else await ctx.reply(DEFAULT_WELCOME)
  })

  priv.command('stop', async (ctx) => {
    botSubscribersRepo.unsubscribe(botId, String(ctx.from!.id))
    notify()
    log.info(`Bot ${botId}: /stop ${ctx.from!.id}`)
    await ctx.reply(DEFAULT_GOODBYE)
  })

  // Foydalanuvchi botni bloklasa yoki o'chirsa
  bot.on('my_chat_member', (ctx) => {
    const upd = ctx.myChatMember
    if (upd.chat.type !== 'private') return
    const status = upd.new_chat_member.status
    if (status === 'kicked' || status === 'left') {
      botSubscribersRepo.unsubscribe(botId, String(upd.from.id))
      notify()
      log.info(`Bot ${botId}: ${upd.from.id} botni bloklagan → obunadan chiqarildi`)
    }
  })

  priv.on('message:text', async (ctx) => {
    const text = ctx.message.text
    if (/^\/(start|stop)\b/i.test(text)) return // yuqorida qayta ishlangan
    const rule = matchRule(botRulesRepo.list(botId, true), text)
    if (!rule) return
    try {
      await sendRuleReply(ctx, rule)
    } catch (e) {
      if (isBlockedError(e)) {
        botSubscribersRepo.unsubscribe(botId, String(ctx.from.id))
        notify()
      } else {
        log.error(`Bot ${botId}: qoida ${rule.id} javobi yuborilmadi`, e)
      }
    }
  })
}
