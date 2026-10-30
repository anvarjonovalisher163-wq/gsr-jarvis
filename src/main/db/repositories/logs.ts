import type { LogEntry, LogLevel } from '@shared/types'
import { getDb } from '../index'

export interface LogFilter {
  level?: LogLevel
  module?: string
  search?: string
  limit?: number
  offset?: number
}

export const logsRepo = {
  list(f: LogFilter = {}): LogEntry[] {
    const conds: string[] = []
    if (f.level) conds.push('level = @level')
    if (f.module) conds.push('module = @module')
    if (f.search) conds.push('message LIKE @search')
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    return getDb()
      .prepare(`SELECT * FROM logs ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
      .all({
        level: f.level ?? null,
        module: f.module ?? null,
        search: f.search ? `%${f.search}%` : null,
        limit: f.limit ?? 200,
        offset: f.offset ?? 0
      }) as LogEntry[]
  },

  modules(): string[] {
    return (getDb().prepare('SELECT DISTINCT module FROM logs ORDER BY module').all() as { module: string }[]).map(
      (r) => r.module
    )
  },

  /** Eski yozuvlarni tozalash (default 30 kun). */
  prune(days = 30): number {
    return getDb().prepare(`DELETE FROM logs WHERE created_at < datetime('now', ?)`).run(`-${days} days`).changes
  },

  clear(): void {
    getDb().prepare('DELETE FROM logs').run()
  }
}
