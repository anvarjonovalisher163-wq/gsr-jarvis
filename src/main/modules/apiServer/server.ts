import { randomBytes, timingSafeEqual } from 'crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { app } from 'electron'
import bigInt from 'big-integer'
import { Api } from 'telegram'
import type { ApiServerStatus } from '@shared/outreach'
import { CAMPAIGN_DEFAULTS } from '@shared/outreach'
import { accountsRepo, blacklistRepo, sendLogRepo, settingsRepo } from '../../db/repositories'
import { getDb } from '../../db'
import { AppError, isAppError } from '../../errors'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'
import { TELEGRAM_TIMEOUT_MS, withTimeout } from '../../utils/timeout'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { peerKeyOfEntity, remember } from '../chats/peers'
import { assertCanSend } from '../license/limits'

const log = createLogger('api-server')

/**
 * Lokal REST API (faqat 127.0.0.1): CRM yoki o'z skriptingiz shu kompyuterdagi dasturga so'rov
 * yuboradi, xabar tanlangan akkauntdan ketadi. Har so'rov — bitta xabar, bitta qabul qiluvchi.
 * Chegaralar: API kalit, akkaunt bo'yicha 24 soatlik limit (kampaniyalar bilan umumiy),
 * akkaunt bo'yicha ketma-ket navbat (kamida 3s), qora ro'yxat, FLOOD_WAIT'da xato qaytadi (kutish).
 */
const KEYS = {
  enabled: 'api.enabled',
  port: 'api.port',
  key: 'api.key',
  dailyLimit: 'api.daily_limit'
} as const
const DEFAULT_PORT = 48123
const MIN_INTERVAL_MS = 3000
const BODY_LIMIT = 64 * 1024

interface SendBody {
  account_id?: number
  to: string
  text: string
  parse_mode?: 'html' | 'text'
}

class ApiServer {
  private server: Server | null = null
  private lastError: string | null = null
  private queues = new Map<number, Promise<unknown>>()
  private lastSentAt = new Map<number, number>()

  // --- sozlamalar ---
  private ensureKey(): string {
    let k = settingsRepo.get(KEYS.key)
    if (!k) {
      k = randomBytes(24).toString('hex')
      settingsRepo.set(KEYS.key, k)
    }
    return k
  }
  private port(): number {
    return Number(settingsRepo.getOr(KEYS.port, String(DEFAULT_PORT))) || DEFAULT_PORT
  }
  private dailyLimit(): number {
    return (
      Number(settingsRepo.getOr(KEYS.dailyLimit, String(CAMPAIGN_DEFAULTS.dailyLimit))) ||
      CAMPAIGN_DEFAULTS.dailyLimit
    )
  }
  private enabled(): boolean {
    return settingsRepo.get(KEYS.enabled) === '1'
  }

  status(): ApiServerStatus {
    const port = this.port()
    const sentToday = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM send_log WHERE source = 'api' AND sent_at >= datetime('now','-1 day')`
        )
        .get() as { n: number }
    ).n
    return {
      enabled: this.enabled(),
      running: !!this.server?.listening,
      port,
      baseUrl: `http://127.0.0.1:${port}/api`,
      key: this.ensureKey(),
      dailyLimit: this.dailyLimit(),
      sentToday,
      lastError: this.lastError
    }
  }

  private emit(): ApiServerStatus {
    const s = this.status()
    broadcast('apiServer:changed', s)
    return s
  }

  async configure(patch: {
    enabled?: boolean
    port?: number
    dailyLimit?: number
  }): Promise<ApiServerStatus> {
    if (patch.port !== undefined) settingsRepo.set(KEYS.port, String(patch.port))
    if (patch.dailyLimit !== undefined) settingsRepo.set(KEYS.dailyLimit, String(patch.dailyLimit))
    if (patch.enabled !== undefined) settingsRepo.set(KEYS.enabled, patch.enabled ? '1' : '0')
    await this.stop()
    if (this.enabled()) await this.start()
    return this.emit()
  }

  regenerateKey(): ApiServerStatus {
    settingsRepo.set(KEYS.key, randomBytes(24).toString('hex'))
    log.info('API kaliti yangilandi')
    return this.emit()
  }

  // --- server ---
  async init(): Promise<void> {
    if (this.enabled()) await this.start().catch((e) => log.error('API server ishga tushmadi', e))
  }

  async start(): Promise<void> {
    if (this.server) return
    this.lastError = null
    const server = createServer((req, res) => {
      this.handle(req, res).catch((e) => {
        log.error("API so'rovida kutilmagan xato", e)
        this.json(res, 500, { ok: false, error: { code: 'INTERNAL', message: 'Ichki xato' } })
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', (e: NodeJS.ErrnoException) => {
        this.lastError =
          e.code === 'EADDRINUSE' ? `Port ${this.port()} band — boshqa port tanlang` : e.message
        reject(e)
      })
      server.listen(this.port(), '127.0.0.1', () => resolve())
    })
    server.on('error', (e) => {
      this.lastError = e.message
      log.error('API server xatosi', e)
      this.emit()
    })
    this.server = server
    log.info(`REST API ishga tushdi: http://127.0.0.1:${this.port()}/api`)
  }

  async stop(): Promise<void> {
    const s = this.server
    if (!s) return
    this.server = null
    await new Promise<void>((r) => s.close(() => r()))
    log.info("REST API to'xtatildi")
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    res.end(JSON.stringify(body))
  }

  private authorized(req: IncomingMessage): boolean {
    const h = req.headers['x-api-key'] ?? req.headers.authorization?.replace(/^Bearer\s+/i, '')
    const given = Array.isArray(h) ? h[0] : h
    if (!given) return false
    const a = Buffer.from(given)
    const b = Buffer.from(this.ensureKey())
    return a.length === b.length && timingSafeEqual(a, b)
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let size = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        size += c.length
        if (size > BODY_LIMIT) {
          reject(new AppError('BODY_TOO_LARGE', "So'rov hajmi 64KB dan oshmasin."))
          req.destroy()
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname.replace(/\/+$/, '')
    if (!path.startsWith('/api'))
      return this.json(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } })
    if (!this.authorized(req))
      return this.json(res, 401, {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: "API kalit noto'g'ri (X-Api-Key sarlavhasi)" }
      })

    try {
      if (req.method === 'GET' && (path === '/api/status' || path === '/api')) {
        return this.json(res, 200, {
          ok: true,
          app: 'tg-manager',
          version: app.getVersion(),
          accounts: this.accounts(),
          daily_limit: this.dailyLimit()
        })
      }
      if (req.method === 'GET' && path === '/api/accounts')
        return this.json(res, 200, { ok: true, accounts: this.accounts() })
      if (req.method === 'POST' && path === '/api/send') {
        const raw = await this.readBody(req)
        let body: SendBody
        try {
          body = JSON.parse(raw || '{}') as SendBody
        } catch {
          throw new AppError('BAD_REQUEST', "JSON noto'g'ri")
        }
        const result = await this.send(body)
        return this.json(res, 200, { ok: true, ...result })
      }
      return this.json(res, 404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: "Bunday yo'l yo'q. Mavjud: GET /api/status, GET /api/accounts, POST /api/send"
        }
      })
    } catch (e) {
      const err = isAppError(e) ? e : mapTelegramError(e)
      const status =
        err.code === 'BAD_REQUEST'
          ? 400
          : err.code === 'FLOOD_WAIT' || err.code === 'DAILY_LIMIT'
            ? 429
            : err.code === 'NOT_FOUND'
              ? 404
              : 422
      log.warn(`API /send xato: ${err.code} — ${err.message}`)
      return this.json(res, status, { ok: false, error: err.toShape() })
    }
  }

  private accounts() {
    return accountsRepo.listActive().map((a) => ({
      id: a.id,
      phone: a.phone,
      username: a.username,
      name: a.first_name,
      connected: clientManager.isConnected(a.id)
    }))
  }

  /** Akkaunt bo'yicha ketma-ket navbat: bir vaqtda bitta, orasida kamida 3s. */
  private enqueue<T>(accountId: number, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(accountId) ?? Promise.resolve()
    const next = prev.then(async () => {
      const wait = MIN_INTERVAL_MS - (Date.now() - (this.lastSentAt.get(accountId) ?? 0))
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      try {
        return await fn()
      } finally {
        this.lastSentAt.set(accountId, Date.now())
      }
    })
    this.queues.set(
      accountId,
      next.catch(() => {})
    )
    return next
  }

  private async send(
    body: SendBody
  ): Promise<{ message_id: number; account_id: number; to: string }> {
    const to = String(body.to ?? '').trim()
    const text = String(body.text ?? '')
    if (!to)
      throw new AppError('BAD_REQUEST', "'to' maydoni kerak: @username, +telefon yoki chat id")
    if (!text.trim()) throw new AppError('BAD_REQUEST', "'text' bo'sh")
    if (text.length > 4096) throw new AppError('BAD_REQUEST', 'Matn 4096 belgidan oshmasin')

    const active = accountsRepo.listActive().filter((a) => clientManager.isConnected(a.id))
    const account = body.account_id
      ? active.find((a) => a.id === Number(body.account_id))
      : active[0]
    if (!account)
      throw new AppError(
        'NOT_FOUND',
        body.account_id ? 'Bu akkaunt ulanmagan yoki topilmadi' : "Ulangan akkaunt yo'q"
      )

    return this.enqueue(account.id, async () => {
      const limit = this.dailyLimit()
      if (sendLogRepo.countLast24h(account.id) >= limit) {
        throw new AppError('DAILY_LIMIT', `Akkauntning 24 soatlik limiti (${limit}) to'ldi`)
      }
      assertCanSend(1)
      const client = clientManager.getClient(account.id)
      const entity = await withTimeout(this.resolve(client, to), TELEGRAM_TIMEOUT_MS)
      if (!(entity instanceof Api.User))
        throw new AppError(
          'BAD_REQUEST',
          "Qabul qiluvchi foydalanuvchi bo'lishi kerak (guruh/kanal emas)"
        )
      if (entity.bot) throw new AppError('BAD_REQUEST', 'Botga API orqali yozilmaydi')
      if (
        blacklistRepo.has(entity.id.toString()) ||
        (entity.username && blacklistRepo.hasUsername(entity.username))
      ) {
        throw new AppError('BLACKLISTED', "Bu foydalanuvchi qora ro'yxatda")
      }
      const peerKey = peerKeyOfEntity(entity)
      try {
        const input = await client.getInputEntity(entity)
        remember(account.id, peerKey, input, entity)
        const msg = await withTimeout(
          client.sendMessage(input, {
            message: text,
            parseMode: body.parse_mode === 'text' ? undefined : 'html'
          }),
          TELEGRAM_TIMEOUT_MS
        )
        sendLogRepo.record(account.id, peerKey, 'api')
        log.info(`API: ${account.phone} → ${to} (msg ${msg.id})`)
        this.emit()
        return { message_id: msg.id, account_id: account.id, to: peerKey }
      } catch (e) {
        throw mapTelegramError(e)
      }
    })
  }

  /** @username | +telefon | raqamli id | u<id> → entity. Telefon faqat maxfiylik ruxsat bersa topiladi. */
  private async resolve(
    client: import('telegram').TelegramClient,
    to: string
  ): Promise<Api.TypeUser | Api.TypeChat | undefined> {
    if (/^\+?\d{7,15}$/.test(to) && to.startsWith('+')) {
      try {
        const r = await client.invoke(
          new Api.contacts.ResolvePhone({ phone: to.replace(/\D/g, '') })
        )
        return r.users[0]
      } catch (e) {
        const err = mapTelegramError(e)
        if (err.code === 'PHONE_NOT_OCCUPIED')
          throw new AppError('NOT_FOUND', "Bu telefonda Telegram yo'q")
        throw new AppError(
          'NOT_FOUND',
          "Telefon bo'yicha topilmadi — foydalanuvchining maxfiylik sozlamalari ruxsat bermaydi. @username yoki chat id ishlating."
        )
      }
    }
    const idMatch = /^u?(\d{1,20})$/.exec(to)
    try {
      if (idMatch) return (await client.getEntity(bigInt(idMatch[1]))) as Api.TypeUser
      return (await client.getEntity(to.startsWith('@') ? to : `@${to}`)) as Api.TypeUser
    } catch (e) {
      const err = mapTelegramError(e)
      if (idMatch)
        throw new AppError(
          'NOT_FOUND',
          "Bu id bo'yicha chat topilmadi — akkaunt u bilan avval yozishgan bo'lishi kerak"
        )
      if (
        err.code === 'USERNAME_NOT_OCCUPIED' ||
        err.code === 'USERNAME_INVALID' ||
        /No user has/i.test(err.message)
      )
        throw new AppError('NOT_FOUND', `${to} topilmadi`)
      throw err
    }
  }
}

export const apiServer = new ApiServer()
