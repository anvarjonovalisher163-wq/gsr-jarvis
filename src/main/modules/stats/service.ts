import { Api } from 'telegram'
import type { ChannelViewsReport, DayCount, StatsOverview } from '@shared/stats'
import { getDb } from '../../db'
import { channelsRepo } from '../../db/repositories'
import { createLogger } from '../../logger'
import { withTimeout, TELEGRAM_TIMEOUT_MS } from '../../utils/timeout'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { toInputPeer } from '../posting/peer'

const log = createLogger('stats')

function count(sql: string, ...params: unknown[]): number {
  return (getDb().prepare(sql).get(...params) as { c: number }).c
}

/** Bo'sh kunlarni 0 bilan to'ldiradi (grafik uzilmasin). */
function fillDays(rows: DayCount[], days: number): DayCount[] {
  const map = new Map(rows.map((r) => [r.day, r.count]))
  const out: DayCount[] = []
  const today = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today - i * 86_400_000).toISOString().slice(0, 10)
    out.push({ day, count: map.get(day) ?? 0 })
  }
  return out
}

export function overview(days: number): StatsOverview {
  const db = getDb()
  const since = `-${days} days`

  const postsPerDay = db
    .prepare(`SELECT substr(sent_at, 1, 10) AS day, COUNT(*) AS count FROM post_targets WHERE status = 'sent' AND sent_at >= datetime('now', ?) GROUP BY day`)
    .all(since) as DayCount[]
  const scheduledPerDay = db
    .prepare(`SELECT substr(scheduled_at, 1, 10) AS day, COUNT(*) AS count FROM post_targets WHERE status = 'scheduled' AND tg_message_id IS NOT NULL GROUP BY day ORDER BY day`)
    .all() as DayCount[]

  // Obunachilar o'sishi: har kun oxiridagi faol obunachilar soni (kumulyativ)
  const subsByDay = db
    .prepare(`SELECT substr(subscribed_at, 1, 10) AS day, COUNT(*) AS count FROM bot_subscribers WHERE unsubscribed_at IS NULL GROUP BY day`)
    .all() as DayCount[]
  const start = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  let base = subsByDay.filter((r) => r.day < start).reduce((a, r) => a + r.count, 0)
  const growth: DayCount[] = []
  const inRange = new Map(subsByDay.filter((r) => r.day >= start).map((r) => [r.day, r.count]))
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    base += inRange.get(day) ?? 0
    growth.push({ day, count: base })
  }

  const broadcasts = db
    .prepare(
      `SELECT b.id, bt.username AS bot_username, b.text, b.status, b.total, b.created_at,
              (SELECT COUNT(*) FROM broadcast_deliveries d WHERE d.broadcast_id = b.id AND d.status = 'sent') AS sent,
              (SELECT COUNT(*) FROM broadcast_deliveries d WHERE d.broadcast_id = b.id AND d.status = 'failed') AS failed,
              (SELECT COUNT(*) FROM broadcast_deliveries d WHERE d.broadcast_id = b.id AND d.status = 'blocked') AS blocked
       FROM broadcasts b JOIN bots bt ON bt.id = b.bot_id ORDER BY b.created_at DESC LIMIT 10`
    )
    .all() as StatsOverview['broadcasts']

  return {
    totals: {
      accounts: count('SELECT COUNT(*) AS c FROM accounts'),
      bots: count('SELECT COUNT(*) AS c FROM bots'),
      channels: count('SELECT COUNT(*) AS c FROM channels'),
      postsSent: count(`SELECT COUNT(*) AS c FROM post_targets WHERE status = 'sent'`),
      postsScheduled: count(`SELECT COUNT(*) AS c FROM post_targets WHERE status = 'scheduled' AND tg_message_id IS NOT NULL`),
      activeSubscribers: count('SELECT COUNT(*) AS c FROM bot_subscribers WHERE unsubscribed_at IS NULL'),
      broadcastsSent: count(`SELECT COUNT(*) AS c FROM broadcast_deliveries WHERE status = 'sent'`)
    },
    postsPerDay: fillDays(postsPerDay, days),
    scheduledPerDay,
    subscribersGrowth: growth,
    broadcasts
  }
}

/** Har kanalning oxirgi 10 ta yuborilgan postining ko'rishlari (GramJS views). */
export async function channelViews(): Promise<ChannelViewsReport[]> {
  const rows = getDb()
    .prepare(
      `SELECT t.channel_id, t.post_id, t.tg_message_id, t.sent_at, p.title, p.text
       FROM post_targets t JOIN posts p ON p.id = t.post_id
       WHERE t.status = 'sent' AND t.tg_message_id IS NOT NULL ORDER BY t.sent_at DESC`
    )
    .all() as { channel_id: number; post_id: number; tg_message_id: number; sent_at: string; title: string; text: string }[]

  const byChannel = new Map<number, typeof rows>()
  for (const r of rows) {
    const list = byChannel.get(r.channel_id) ?? []
    if (list.length < 10) list.push(r)
    byChannel.set(r.channel_id, list)
  }

  const out: ChannelViewsReport[] = []
  for (const [channelId, posts] of byChannel) {
    const channel = channelsRepo.getById(channelId)
    if (!channel) continue
    const report: ChannelViewsReport = {
      channel_id: channelId,
      channel_title: channel.title,
      account_id: channel.account_id,
      error: null,
      posts: posts.map((p) => ({ post_id: p.post_id, title: p.title || p.text.replace(/<[^>]+>/g, '').slice(0, 50), tg_message_id: p.tg_message_id, sent_at: p.sent_at, views: null, forwards: null }))
    }
    try {
      const client = clientManager.getClient(channel.account_id)
      const msgs = await withTimeout(client.getMessages(toInputPeer(channel), { ids: posts.map((p) => p.tg_message_id) }), TELEGRAM_TIMEOUT_MS)
      for (const m of msgs) {
        if (!(m instanceof Api.Message)) continue
        const p = report.posts.find((x) => x.tg_message_id === m.id)
        if (p) {
          p.views = m.views ?? null
          p.forwards = m.forwards ?? null
        }
      }
    } catch (e) {
      report.error = mapTelegramError(e).message
      log.warn(`Kanal ${channel.title} ko'rishlari olinmadi`, report.error)
    }
    out.push(report)
  }
  return out
}
