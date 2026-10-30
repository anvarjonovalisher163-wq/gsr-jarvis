import type { LogLevel } from '@shared/types'
import { getDb } from './db'

/**
 * Konsolga va (baza ochiq bo'lsa) logs jadvaliga yozadi.
 * Baza hali ochilmagan paytdagi yozuvlar navbatga tushadi va keyin yoziladi.
 *
 * MUHIM: meta ichiga token, sessiya, parol qo'ymang — security/crypto.ts dagi mask() ni ishlating.
 */

interface Pending {
  level: LogLevel
  module: string
  message: string
  meta?: unknown
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const SECRET_KEYS = /token|session|password|secret|api_hash/i

let dbReady = false
const queue: Pending[] = []
let minLevel: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info'

/** Tasodifan maxfiy kalit tushib qolsa, qiymatini yashiradi. */
function sanitize(meta: unknown): unknown {
  if (meta instanceof Error) return { name: meta.name, message: meta.message, stack: meta.stack }
  if (Array.isArray(meta)) return meta.map(sanitize)
  if (meta && typeof meta === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '[yashirilgan]' : sanitize(v)
    }
    return out
  }
  return meta
}

function persist(entry: Pending): void {
  try {
    getDb()
      .prepare('INSERT INTO logs (level, module, message, meta_json) VALUES (?, ?, ?, ?)')
      .run(
        entry.level,
        entry.module,
        entry.message,
        entry.meta === undefined ? null : JSON.stringify(sanitize(entry.meta))
      )
  } catch (e) {
    console.error('[logger] bazaga yozib bo\'lmadi:', e)
  }
}

function write(entry: Pending): void {
  if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[minLevel]) return

  const ts = new Date().toISOString().slice(11, 19)
  const line = `${ts} [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}`
  const fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log
  if (entry.meta === undefined) fn(line)
  else fn(line, sanitize(entry.meta))

  if (dbReady) persist(entry)
  else queue.push(entry)
}

/** openDatabase() dan keyin chaqiriladi: navbatdagi yozuvlarni bazaga tushiradi. */
export function attachLoggerToDb(): void {
  dbReady = true
  while (queue.length) persist(queue.shift()!)
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level
}

/** Modul nomi bilan bog'langan logger: const log = createLogger('accounts') */
export function createLogger(module: string) {
  return {
    debug: (message: string, meta?: unknown) => write({ level: 'debug', module, message, meta }),
    info: (message: string, meta?: unknown) => write({ level: 'info', module, message, meta }),
    warn: (message: string, meta?: unknown) => write({ level: 'warn', module, message, meta }),
    error: (message: string, meta?: unknown) => write({ level: 'error', module, message, meta })
  }
}

export type Logger = ReturnType<typeof createLogger>
