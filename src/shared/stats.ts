/** Statistika tiplari. */

export interface DayCount {
  /** YYYY-MM-DD (UTC) */
  day: string
  count: number
}

export interface StatsOverview {
  totals: {
    accounts: number
    bots: number
    channels: number
    postsSent: number
    postsScheduled: number
    activeSubscribers: number
    broadcastsSent: number
  }
  /** Kunlik yuborilgan post nishonlari */
  postsPerDay: DayCount[]
  /** Kunlik rejali (hali chiqmagan) postlar */
  scheduledPerDay: DayCount[]
  /** Faol obunachilar soni (kumulyativ, kun bo'yicha) */
  subscribersGrowth: DayCount[]
  broadcasts: { id: number; bot_username: string; text: string; status: string; total: number; sent: number; failed: number; blocked: number; created_at: string }[]
}

export interface ChannelPostViews {
  post_id: number
  title: string
  tg_message_id: number
  sent_at: string
  views: number | null
  forwards: number | null
}

export interface ChannelViewsReport {
  channel_id: number
  channel_title: string
  account_id: number
  /** Ulanmagan bo'lsa yoki xato — sabab */
  error: string | null
  posts: ChannelPostViews[]
}
