import type { PostTarget, TargetStatus } from '@shared/types'
import { getDb } from '../index'

export const postTargetsRepo = {
  listByPost(postId: number): PostTarget[] {
    return getDb().prepare('SELECT * FROM post_targets WHERE post_id = ? ORDER BY id').all(postId) as PostTarget[]
  },

  getById(id: number): PostTarget | undefined {
    return getDb().prepare('SELECT * FROM post_targets WHERE id = ?').get(id) as PostTarget | undefined
  },

  /** Post uchun kanallar ro'yxatini butunlay almashtiradi. */
  replaceForPost(postId: number, channelIds: number[], scheduledAt: string | null): PostTarget[] {
    const db = getDb()
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM post_targets WHERE post_id = ?').run(postId)
      const ins = db.prepare(
        `INSERT INTO post_targets (post_id, channel_id, scheduled_at, status) VALUES (?, ?, ?, ?)`
      )
      for (const cid of channelIds) ins.run(postId, cid, scheduledAt, scheduledAt ? 'scheduled' : 'pending')
    })
    tx()
    return this.listByPost(postId)
  },

  markSent(id: number, tgMessageId: number | null): void {
    getDb()
      .prepare(`UPDATE post_targets SET status = 'sent', sent_at = datetime('now'), tg_message_id = ?, error = NULL WHERE id = ?`)
      .run(tgMessageId, id)
  },

  markScheduled(id: number, tgMessageId: number | null, scheduledAt: string): void {
    getDb()
      .prepare(`UPDATE post_targets SET status = 'scheduled', scheduled_at = ?, tg_message_id = ?, error = NULL WHERE id = ?`)
      .run(scheduledAt, tgMessageId, id)
  },

  markFailed(id: number, error: string): void {
    getDb().prepare(`UPDATE post_targets SET status = 'failed', error = ? WHERE id = ?`).run(error, id)
  },

  setStatus(id: number, status: TargetStatus): void {
    getDb().prepare('UPDATE post_targets SET status = ? WHERE id = ?').run(status, id)
  },

  /** Kalendar/ro'yxat uchun: sana oralig'idagi rejali targetlar. */
  listScheduledBetween(fromIso: string, toIso: string): PostTarget[] {
    return getDb()
      .prepare(`SELECT * FROM post_targets WHERE status = 'scheduled' AND scheduled_at BETWEEN ? AND ? ORDER BY scheduled_at`)
      .all(fromIso, toIso) as PostTarget[]
  }
}
