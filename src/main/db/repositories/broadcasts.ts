import type { Broadcast, BroadcastStatus } from '@shared/types'
import { getDb } from '../index'

export interface BroadcastInput {
  bot_id: number
  text: string
  media_json?: string | null
  buttons_json?: string | null
  tag_filter?: string | null
  scheduled_at?: string | null
}

export const broadcastsRepo = {
  list(botId?: number): Broadcast[] {
    const db = getDb()
    return botId === undefined
      ? (db.prepare('SELECT * FROM broadcasts ORDER BY created_at DESC').all() as Broadcast[])
      : (db.prepare('SELECT * FROM broadcasts WHERE bot_id = ? ORDER BY created_at DESC').all(botId) as Broadcast[])
  },

  getById(id: number): Broadcast | undefined {
    return getDb().prepare('SELECT * FROM broadcasts WHERE id = ?').get(id) as Broadcast | undefined
  },

  create(b: BroadcastInput): Broadcast {
    const res = getDb()
      .prepare(
        `INSERT INTO broadcasts (bot_id, text, media_json, buttons_json, tag_filter, status, scheduled_at)
         VALUES (@bot_id, @text, @media_json, @buttons_json, @tag_filter, @status, @scheduled_at)`
      )
      .run({
        bot_id: b.bot_id,
        text: b.text,
        media_json: b.media_json ?? null,
        buttons_json: b.buttons_json ?? null,
        tag_filter: b.tag_filter ?? null,
        status: b.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: b.scheduled_at ?? null
      })
    return this.getById(Number(res.lastInsertRowid))!
  },

  setStatus(id: number, status: BroadcastStatus): void {
    const finished = status === 'done' || status === 'cancelled' || status === 'failed'
    getDb()
      .prepare(`UPDATE broadcasts SET status = ?, finished_at = ${finished ? "datetime('now')" : 'finished_at'} WHERE id = ?`)
      .run(status, id)
  },

  setTotal(id: number, total: number): void {
    getDb().prepare('UPDATE broadcasts SET total = ? WHERE id = ?').run(total, id)
  },

  /** Har yuborilgan/xato xabardan keyin hisoblagichlarni oshiradi. */
  incrementProgress(id: number, sentDelta: number, failedDelta: number): void {
    getDb()
      .prepare('UPDATE broadcasts SET sent = sent + ?, failed = failed + ? WHERE id = ?')
      .run(sentDelta, failedDelta, id)
  },

  /** Ilova qayta ochilganda davom ettirish kerak bo'lganlar. */
  listResumable(): Broadcast[] {
    return getDb()
      .prepare(`SELECT * FROM broadcasts WHERE status IN ('running','paused','scheduled') ORDER BY created_at`)
      .all() as Broadcast[]
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM broadcasts WHERE id = ?').run(id)
  }
}
