import { Bot } from 'grammy'
import { botsRepo } from '../../db/repositories'
import { decrypt } from '../../security/crypto'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { withTimeout } from '../../utils/timeout'
import { mapBotError } from './errors'
import { registerHandlers } from './handlers'

const log = createLogger('bots')
const INIT_TIMEOUT_MS = 20_000

/**
 * Har bot uchun bitta grammY Bot instance (long polling).
 * Ilova ochilganda is_running=1 botlar ishga tushadi.
 */
class BotManager {
  private bots = new Map<number, Bot>()
  private errors = new Map<number, string>()
  private onChange: (() => void) | null = null

  setOnChange(cb: () => void): void {
    this.onChange = cb
  }

  async startAll(): Promise<void> {
    const list = botsRepo.listRunning()
    log.info(`${list.length} ta bot ishga tushmoqda`)
    await Promise.allSettled(list.map((b) => this.start(b.id).catch((e) => log.error(`Bot ${b.id} ishga tushmadi`, e))))
  }

  /** getMe bilan tekshirib, polling'ni boshlaydi. Xato bo'lsa AppError (UI ko'rsatadi). */
  async start(botId: number): Promise<void> {
    if (this.bots.has(botId)) return
    const row = botsRepo.getById(botId)
    if (!row) throw new AppError('NOT_FOUND', 'Bot topilmadi.')

    let token: string
    try {
      token = decrypt(row.token_encrypted)
    } catch (e) {
      log.error(`Bot ${botId}: tokenni ochib bo'lmadi`, e)
      const err = new AppError('TOKEN_DECRYPT', "Bot tokenini ochib bo'lmadi (tizim kaliti o'zgargan). Botni o'chirib qayta qo'shing.")
      this.errors.set(botId, err.message)
      this.emit()
      throw err
    }
    const bot = new Bot(token)
    registerHandlers(bot, botId)

    bot.catch((err) => {
      // Handler ichidagi xatolar: logga yozamiz, polling davom etadi
      log.error(`Bot ${botId} (@${row.username}): handler xatosi`, err.error)
    })

    try {
      await withTimeout(bot.init(), INIT_TIMEOUT_MS, 'NETWORK', "Telegram Bot API javob bermadi.")
    } catch (e) {
      const err = mapBotError(e)
      this.errors.set(botId, err.message)
      botsRepo.setRunning(botId, false)
      this.emit()
      throw err
    }

    this.bots.set(botId, bot)
    this.errors.delete(botId)
    botsRepo.setRunning(botId, true)

    // start() faqat stop() da tugaydi — kutmaymiz. Polling xatosi (409, 401) shu yerga keladi.
    bot
      .start({
        onStart: () => {
          log.info(`Bot @${row.username} ishga tushdi`)
          this.emit()
        }
      })
      .catch((e) => {
        const err = mapBotError(e)
        log.error(`Bot @${row.username} to'xtadi: ${err.code}`, err.message)
        this.errors.set(botId, err.message)
        this.bots.delete(botId)
        botsRepo.setRunning(botId, false)
        this.emit()
      })

    this.emit()
  }

  async stop(botId: number): Promise<void> {
    const bot = this.bots.get(botId)
    this.bots.delete(botId)
    botsRepo.setRunning(botId, false)
    if (bot) {
      await bot.stop().catch((e) => log.warn(`Bot ${botId} to'xtatishda xato`, e))
      log.info(`Bot ${botId} to'xtatildi`)
    }
    this.emit()
  }

  async stopAll(): Promise<void> {
    await Promise.allSettled([...this.bots.keys()].map((id) => this.stop(id)))
  }

  isRunning(botId: number): boolean {
    return this.bots.get(botId)?.isRunning() === true
  }

  lastError(botId: number): string | null {
    return this.errors.get(botId) ?? null
  }

  /** Rassilka (9-qadam) uchun: ishlayotgan bot instance. */
  getBot(botId: number): Bot {
    const bot = this.bots.get(botId)
    if (!bot) throw new AppError('BOT_NOT_RUNNING', 'Bot ishga tushirilmagan. Avval botni yoqing.')
    return bot
  }

  private emit(): void {
    this.onChange?.()
  }
}

export const botManager = new BotManager()
