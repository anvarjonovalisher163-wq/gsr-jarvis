import type { Channel, ChannelType } from '@shared/types'
import { getDb } from '../index'

export interface ChannelInput {
  account_id: number
  tg_id: string
  access_hash?: string | null
  title: string
  username?: string | null
  type: ChannelType
  is_admin: boolean
  photo_path?: string | null
}

export const channelsRepo = {
  list(accountId?: number): Channel[] {
    const db = getDb()
    return accountId === undefined
      ? (db.prepare('SELECT * FROM channels ORDER BY account_id, title').all() as Channel[])
      : (db.prepare('SELECT * FROM channels WHERE account_id = ? ORDER BY title').all(accountId) as Channel[])
  },

  getById(id: number): Channel | undefined {
    return getDb().prepare('SELECT * FROM channels WHERE id = ?').get(id) as Channel | undefined
  },

  upsert(c: ChannelInput): Channel {
    const db = getDb()
    db.prepare(
      `INSERT INTO channels (account_id, tg_id, access_hash, title, username, type, is_admin, photo_path, synced_at)
       VALUES (@account_id, @tg_id, @access_hash, @title, @username, @type, @is_admin, @photo_path, datetime('now'))
       ON CONFLICT(account_id, tg_id) DO UPDATE SET
         access_hash = excluded.access_hash,
         title = excluded.title,
         username = excluded.username,
         type = excluded.type,
         is_admin = excluded.is_admin,
         photo_path = COALESCE(excluded.photo_path, channels.photo_path),
         synced_at = datetime('now')`
    ).run({
      ...c,
      access_hash: c.access_hash ?? null,
      username: c.username ?? null,
      photo_path: c.photo_path ?? null,
      is_admin: c.is_admin ? 1 : 0
    })
    return db.prepare('SELECT * FROM channels WHERE account_id = ? AND tg_id = ?').get(c.account_id, c.tg_id) as Channel
  },

  /** Sinxronlashda ro'yxatda yo'q (endi admin bo'lmagan) kanallarni o'chiradi. */
  removeMissing(accountId: number, keepTgIds: string[]): number {
    const db = getDb()
    if (keepTgIds.length === 0) {
      return db.prepare('DELETE FROM channels WHERE account_id = ?').run(accountId).changes
    }
    const placeholders = keepTgIds.map(() => '?').join(',')
    return db
      .prepare(`DELETE FROM channels WHERE account_id = ? AND tg_id NOT IN (${placeholders})`)
      .run(accountId, ...keepTgIds).changes
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM channels WHERE id = ?').run(id)
  }
}
