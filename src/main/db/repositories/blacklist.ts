import type { BlacklistEntry } from '@shared/types'
import { getDb } from '../index'

export const blacklistRepo = {
  list(search?: string): BlacklistEntry[] {
    if (search) {
      const q = `%${search}%`
      return getDb()
        .prepare(
          'SELECT * FROM blacklist WHERE tg_user_id LIKE ? OR username LIKE ? OR title LIKE ? ORDER BY created_at DESC'
        )
        .all(q, q, q) as BlacklistEntry[]
    }
    return getDb()
      .prepare('SELECT * FROM blacklist ORDER BY created_at DESC')
      .all() as BlacklistEntry[]
  },
  has(tgUserId: string): boolean {
    return !!getDb().prepare('SELECT 1 FROM blacklist WHERE tg_user_id = ?').get(tgUserId)
  },
  hasUsername(username: string): boolean {
    return !!getDb()
      .prepare('SELECT 1 FROM blacklist WHERE lower(username) = lower(?)')
      .get(username.replace(/^@/, ''))
  },
  add(e: {
    tg_user_id: string
    username: string | null
    title: string
    reason: string
  }): BlacklistEntry {
    getDb()
      .prepare(
        `INSERT INTO blacklist (tg_user_id, username, title, reason) VALUES (@tg_user_id, @username, @title, @reason)
         ON CONFLICT(tg_user_id) DO UPDATE SET username = COALESCE(excluded.username, blacklist.username),
           title = CASE WHEN excluded.title != '' THEN excluded.title ELSE blacklist.title END,
           reason = CASE WHEN excluded.reason != '' THEN excluded.reason ELSE blacklist.reason END`
      )
      .run({ ...e, username: e.username?.replace(/^@/, '') ?? null })
    return getDb()
      .prepare('SELECT * FROM blacklist WHERE tg_user_id = ?')
      .get(e.tg_user_id) as BlacklistEntry
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM blacklist WHERE id = ?').run(id)
  },
  /** Barcha bloklangan tg_user_id'lar to'plami (tez tekshiruv uchun). */
  idSet(): Set<string> {
    return new Set(
      (getDb().prepare('SELECT tg_user_id FROM blacklist').all() as { tg_user_id: string }[]).map(
        (r) => r.tg_user_id
      )
    )
  }
}
