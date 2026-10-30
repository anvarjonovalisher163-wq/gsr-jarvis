import { app } from 'electron'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { Logger, LogLevel } from 'telegram/extensions/Logger'
import type { Account } from '@shared/types'
import { accountsRepo } from '../../db/repositories'
import { decrypt } from '../../security/crypto'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { getApiCredentials } from './credentials'
import { mapTelegramError } from './errors'
import { TELEGRAM_TIMEOUT_MS, withTimeout } from '../../utils/timeout'
import { gramjsProxy } from '../network/proxy'

const log = createLogger('accounts')

/**
 * Barcha ulangan GramJS klientlar: Map<accountId, TelegramClient>.
 * Ilova ochilganda active akkauntlar StringSession bilan ulanadi.
 */
class ClientManager {
  private clients = new Map<number, TelegramClient>()
  private onChange: (() => void) | null = null
  private statusTimer: NodeJS.Timeout | null = null
  private lastStatus = new Map<number, boolean>()
  /** Qayta ulanish urinishlari orasidagi kutish (accountId → keyingi urinish vaqti). */
  private reconnectAt = new Map<number, number>()

  /** Ulanish holati o'zgarganda chaqiriladigan callback (UI'ga push uchun). */
  setOnChange(cb: () => void): void {
    this.onChange = cb
  }

  private readyHooks: ((accountId: number, client: TelegramClient) => void)[] = []
  private goneHooks: ((accountId: number) => void)[] = []

  /** Klient ulanib tayyor bo'lganda (hodisa handler'larini ulash uchun). */
  onClientReady(cb: (accountId: number, client: TelegramClient) => void): void {
    this.readyHooks.push(cb)
    for (const [id, c] of this.clients) cb(id, c)
  }
  onClientGone(cb: (accountId: number) => void): void {
    this.goneHooks.push(cb)
  }

  /** Yangi klient yaratadi (ulamaydi). session bo'sh bo'lsa — login uchun. */
  createClient(session = ''): TelegramClient {
    const { apiId, apiHash } = getApiCredentials()
    return new TelegramClient(new StringSession(session), apiId, apiHash, {
      connectionRetries: 5,
      retryDelay: 2000,
      autoReconnect: true,
      deviceModel: 'TG Manager',
      appVersion: app.getVersion(),
      systemVersion: `${process.platform} ${process.arch}`,
      langCode: 'uz',
      baseLogger: new Logger(LogLevel.ERROR),
      proxy: gramjsProxy()
    })
  }

  /** Ilova ochilganda: sessiyasi bor barcha active akkauntlarni ulaydi. Xatolar login'ni buzmaydi. */
  async connectAll(): Promise<void> {
    const accounts = accountsRepo.listActive().filter((a) => a.session_encrypted)
    log.info(`${accounts.length} ta akkaunt ulanmoqda`)
    await Promise.allSettled(accounts.map((a) => this.connect(a)))
    this.startStatusWatch()
  }

  async connect(account: Account): Promise<void> {
    if (this.clients.has(account.id)) return
    if (!account.session_encrypted) return

    let client: TelegramClient
    try {
      client = this.createClient(decrypt(account.session_encrypted))
    } catch (e) {
      log.error(`Akkaunt ${account.id}: sessiyani ochib bo'lmadi`, e)
      return
    }

    try {
      await withTimeout(client.connect(), TELEGRAM_TIMEOUT_MS)
      if (!(await withTimeout(client.isUserAuthorized(), TELEGRAM_TIMEOUT_MS))) {
        log.warn(`Akkaunt ${account.id} (${account.phone}): sessiya bekor qilingan`)
        accountsRepo.clearSession(account.id)
        await client.disconnect()
        this.emit()
        return
      }
      this.clients.set(account.id, client)
      for (const h of this.readyHooks) h(account.id, client)
      this.refreshProfile(account.id, client).catch(() => {})
      log.info(`Akkaunt ${account.id} (${account.phone}) ulandi`)
    } catch (e) {
      const err = mapTelegramError(e)
      log.error(`Akkaunt ${account.id} ulanmadi: ${err.code}`, err.message)
      if (err.code === 'AUTH_KEY_UNREGISTERED' || err.code === 'SESSION_REVOKED' || err.code === 'AUTH_KEY_DUPLICATED') {
        accountsRepo.clearSession(account.id)
      } else if (err.code === 'USER_DEACTIVATED' || err.code === 'USER_DEACTIVATED_BAN' || err.code === 'PHONE_NUMBER_BANNED') {
        accountsRepo.setStatus(account.id, 'banned')
      }
      await client.disconnect().catch(() => {})
    }
    this.emit()
  }

  /** Login tugagach tayyor klientni ro'yxatga oladi. */
  adopt(accountId: number, client: TelegramClient): void {
    this.clients.set(accountId, client)
    for (const h of this.readyHooks) h(accountId, client)
    this.emit()
  }

  async disconnect(accountId: number): Promise<void> {
    const client = this.clients.get(accountId)
    if (!client) return
    this.clients.delete(accountId)
    for (const h of this.goneHooks) h(accountId)
    await client.disconnect().catch((e) => log.warn(`Akkaunt ${accountId} uzishda xato`, e))
    this.emit()
  }

  async disconnectAll(): Promise<void> {
    if (this.statusTimer) clearInterval(this.statusTimer)
    await Promise.allSettled([...this.clients.keys()].map((id) => this.disconnect(id)))
  }

  /** Ulangan klient. Yo'q bo'lsa AppError — chaqiruvchi foydalanuvchiga ko'rsatadi. */
  getClient(accountId: number): TelegramClient {
    const client = this.clients.get(accountId)
    if (!client || !client.connected) {
      throw new AppError('NOT_CONNECTED', 'Akkaunt Telegram\'ga ulanmagan. Qaytadan kiring yoki internetni tekshiring.')
    }
    return client
  }

  tryGetClient(accountId: number): TelegramClient | undefined {
    return this.clients.get(accountId)
  }

  isConnected(accountId: number): boolean {
    return this.clients.get(accountId)?.connected === true
  }

  /** Ism/username o'zgargan bo'lsa bazani yangilaydi. */
  private async refreshProfile(accountId: number, client: TelegramClient): Promise<void> {
    const me = await client.getMe()
    if (me.className !== 'User') return
    accountsRepo.updateProfile(accountId, { username: me.username ?? null, first_name: me.firstName ?? null })
  }

  /** Har 15 soniyada ulanish holatini tekshiradi; o'zgarsa UI'ga xabar beradi. */
  private startStatusWatch(): void {
    if (this.statusTimer) return
    this.statusTimer = setInterval(() => {
      let changed = false
      for (const [id, client] of this.clients) {
        const now = this.isConnected(id)
        if (!now) this.tryReconnect(id, client)
        if (this.lastStatus.get(id) !== now) {
          this.lastStatus.set(id, now)
          changed = true
        }
      }
      if (changed) this.emit()
    }, 15_000)
  }

  /**
   * Internet uzilib GramJS'ning o'z urinishlari tugagan bo'lsa, har 60 soniyada qayta ulanamiz.
   * Sessiya o'zgarmaydi — foydalanuvchi qayta login qilmaydi.
   */
  private tryReconnect(accountId: number, client: TelegramClient): void {
    const next = this.reconnectAt.get(accountId) ?? 0
    if (Date.now() < next) return
    this.reconnectAt.set(accountId, Date.now() + 60_000)
    log.info(`Akkaunt ${accountId}: ulanish yo'q, qayta ulanish urinishi`)
    withTimeout(client.connect(), TELEGRAM_TIMEOUT_MS)
      .then(() => {
        log.info(`Akkaunt ${accountId}: qayta ulandi`)
        this.reconnectAt.delete(accountId)
        this.emit()
      })
      .catch((e) => log.warn(`Akkaunt ${accountId}: qayta ulanmadi`, mapTelegramError(e).message))
  }

  private emit(): void {
    this.onChange?.()
  }
}

export const clientManager = new ClientManager()
