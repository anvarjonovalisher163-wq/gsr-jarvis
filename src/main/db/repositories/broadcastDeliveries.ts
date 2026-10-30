import type { BroadcastDelivery, DeliveryStatus } from '@shared/types'
import { getDb } from '../index'

export const broadcastDeliveriesRepo = {
  /** Allaqachon qayta ishlangan obunachilar (davom ettirishda o'tkazib yuboriladi). */
  processedSubscriberIds(broadcastId: number): Set<number> {
    const rows = getDb()
      .prepare('SELECT subscriber_id FROM broadcast_deliveries WHERE broadcast_id = ?')
      .all(broadcastId) as { subscriber_id: number }[]
    return new Set(rows.map((r) => r.subscriber_id))
  },

  record(broadcastId: number, subscriberId: number, status: DeliveryStatus, error: string | null = null): void {
    getDb()
      .prepare(
        `INSERT INTO broadcast_deliveries (broadcast_id, subscriber_id, status, error)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(broadcast_id, subscriber_id) DO UPDATE SET status = excluded.status, error = excluded.error, sent_at = datetime('now')`
      )
      .run(broadcastId, subscriberId, status, error)
  },

  counts(broadcastId: number): { sent: number; failed: number; blocked: number } {
    const rows = getDb()
      .prepare('SELECT status, COUNT(*) AS c FROM broadcast_deliveries WHERE broadcast_id = ? GROUP BY status')
      .all(broadcastId) as { status: DeliveryStatus; c: number }[]
    const out = { sent: 0, failed: 0, blocked: 0 }
    for (const r of rows) out[r.status] = r.c
    return out
  },

  /** Hisobot uchun: xato/bloklangan yetkazishlar obunachi ma'lumoti bilan. */
  listProblems(broadcastId: number, limit = 500): BroadcastDelivery[] {
    return getDb()
      .prepare(
        `SELECT d.*, s.tg_user_id, s.username, s.first_name
         FROM broadcast_deliveries d JOIN bot_subscribers s ON s.id = d.subscriber_id
         WHERE d.broadcast_id = ? AND d.status != 'sent'
         ORDER BY d.sent_at DESC LIMIT ?`
      )
      .all(broadcastId, limit) as BroadcastDelivery[]
  }
}
