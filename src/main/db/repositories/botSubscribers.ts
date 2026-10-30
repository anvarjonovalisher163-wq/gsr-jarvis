import type { BotSubscriber } from '@shared/types'
import { getDb } from '../index'

export interface SubscriberFilter {
  search?: string
  tag?: string
  activeOnly?: boolean
  limit?: number
  offset?: number
}

export const botSubscribersRepo = {
  list(botId: number, f: SubscriberFilter = {}): BotSubscriber[] {
    const conds = ['bot_id = @botId']
    if (f.activeOnly) conds.push('unsubscribed_at IS NULL')
    if (f.search) conds.push('(username LIKE @search OR first_name LIKE @search OR tg_user_id LIKE @search)')
    if (f.tag) conds.push(`(',' || COALESCE(tags,'') || ',') LIKE @tag`)
    return getDb()
      .prepare(
        `SELECT * FROM bot_subscribers WHERE ${conds.join(' AND ')}
         ORDER BY subscribed_at DESC LIMIT @limit OFFSET @offset`
      )
      .all({
        botId,
        search: f.search ? `%${f.search}%` : null,
        tag: f.tag ? `%,${f.tag},%` : null,
        limit: f.limit ?? 500,
        offset: f.offset ?? 0
      }) as BotSubscriber[]
  },

  /** Rassilka auditoriyasi: faqat faol (unsubscribed_at IS NULL), ixtiyoriy teg bo'yicha. */
  listActiveForBroadcast(botId: number, tag?: string | null): BotSubscriber[] {
    return this.list(botId, { activeOnly: true, tag: tag ?? undefined, limit: 1_000_000 })
  },

  countActive(botId: number): number {
    return (
      getDb()
        .prepare('SELECT COUNT(*) AS c FROM bot_subscribers WHERE bot_id = ? AND unsubscribed_at IS NULL')
        .get(botId) as { c: number }
    ).c
  },

  /** /start: yangi bo'lsa qo'shadi, qaytgan bo'lsa unsubscribed_at ni tozalaydi. Deep-link tegini qo'shadi. */
  subscribe(
    botId: number,
    u: { tg_user_id: string; username?: string | null; first_name?: string | null },
    tag?: string | null
  ): BotSubscriber {
    const db = getDb()
    const existing = db
      .prepare('SELECT * FROM bot_subscribers WHERE bot_id = ? AND tg_user_id = ?')
      .get(botId, u.tg_user_id) as BotSubscriber | undefined

    if (!existing) {
      db.prepare(
        `INSERT INTO bot_subscribers (bot_id, tg_user_id, username, first_name, tags)
         VALUES (?, ?, ?, ?, ?)`
      ).run(botId, u.tg_user_id, u.username ?? null, u.first_name ?? null, tag ?? null)
    } else {
      const tags = new Set((existing.tags ?? '').split(',').filter(Boolean))
      if (tag) tags.add(tag)
      db.prepare(
        `UPDATE bot_subscribers SET username = ?, first_name = ?, unsubscribed_at = NULL,
           subscribed_at = CASE WHEN unsubscribed_at IS NOT NULL THEN datetime('now') ELSE subscribed_at END,
           tags = ?
         WHERE id = ?`
      ).run(u.username ?? null, u.first_name ?? null, [...tags].join(',') || null, existing.id)
    }
    return db
      .prepare('SELECT * FROM bot_subscribers WHERE bot_id = ? AND tg_user_id = ?')
      .get(botId, u.tg_user_id) as BotSubscriber
  },

  /** /stop yoki 403 (bot bloklangan). */
  unsubscribe(botId: number, tgUserId: string): void {
    getDb()
      .prepare(
        `UPDATE bot_subscribers SET unsubscribed_at = datetime('now')
         WHERE bot_id = ? AND tg_user_id = ? AND unsubscribed_at IS NULL`
      )
      .run(botId, tgUserId)
  },

  setTags(id: number, tags: string[]): void {
    getDb().prepare('UPDATE bot_subscribers SET tags = ? WHERE id = ?').run(tags.join(',') || null, id)
  },

  /** Bot bo'yicha ishlatilgan barcha teglar (filtr uchun). */
  distinctTags(botId: number): string[] {
    const rows = getDb()
      .prepare('SELECT tags FROM bot_subscribers WHERE bot_id = ? AND tags IS NOT NULL')
      .all(botId) as { tags: string }[]
    const set = new Set<string>()
    for (const r of rows) r.tags.split(',').filter(Boolean).forEach((t) => set.add(t))
    return [...set].sort()
  }
}
