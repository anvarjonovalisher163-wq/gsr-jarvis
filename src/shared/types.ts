/**
 * Ma'lumotlar bazasi qatorlari va umumiy tiplar.
 * Main va renderer ikkalasi ham shu tiplardan foydalanadi.
 *
 * Eslatma: *_encrypted maydonlar faqat main'da ishlatiladi, renderer'ga
 * hech qachon yuborilmaydi (quyidagi Public* tiplar ular siz).
 */

export type AccountStatus = 'active' | 'logged_out' | 'banned'
export type ChannelType = 'channel' | 'group'
export type PostStatus = 'draft' | 'scheduled' | 'sent' | 'failed'
export type TargetStatus = 'pending' | 'scheduled' | 'sent' | 'failed'
export type BotRuleTrigger = 'command' | 'keyword' | 'any'
export type BroadcastStatus =
  'draft' | 'scheduled' | 'running' | 'paused' | 'done' | 'cancelled' | 'failed'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type CampaignStatus =
  'draft' | 'scheduled' | 'running' | 'paused' | 'done' | 'cancelled' | 'failed'
export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface Account {
  id: number
  phone: string
  username: string | null
  first_name: string | null
  tg_user_id: string | null
  session_encrypted: Buffer | null
  status: AccountStatus
  created_at: string
}
export type PublicAccount = Omit<Account, 'session_encrypted'>

export interface Bot {
  id: number
  token_encrypted: Buffer
  username: string
  title: string
  is_running: 0 | 1
  created_at: string
}
export type PublicBot = Omit<Bot, 'token_encrypted'>

export interface Channel {
  id: number
  account_id: number
  tg_id: string
  access_hash: string | null
  title: string
  username: string | null
  type: ChannelType
  is_admin: 0 | 1
  photo_path: string | null
  synced_at: string
}

export interface Post {
  id: number
  title: string
  text: string
  media_json: string | null
  buttons_json: string | null
  status: PostStatus
  created_at: string
  updated_at: string
}

export interface PostTarget {
  id: number
  post_id: number
  channel_id: number
  scheduled_at: string | null
  sent_at: string | null
  tg_message_id: number | null
  status: TargetStatus
  error: string | null
}

export interface BotSubscriber {
  id: number
  bot_id: number
  tg_user_id: string
  username: string | null
  first_name: string | null
  subscribed_at: string
  unsubscribed_at: string | null
  tags: string | null
}

export interface BotRule {
  id: number
  bot_id: number
  trigger_type: BotRuleTrigger
  trigger_value: string | null
  reply_text: string
  reply_media_json: string | null
  reply_buttons_json: string | null
  is_active: 0 | 1
  sort_order: number
}

export interface Broadcast {
  id: number
  bot_id: number
  text: string
  media_json: string | null
  buttons_json: string | null
  tag_filter: string | null
  status: BroadcastStatus
  total: number
  sent: number
  failed: number
  scheduled_at: string | null
  created_at: string
  finished_at: string | null
}

export type DeliveryStatus = 'sent' | 'failed' | 'blocked'

export interface BroadcastDelivery {
  broadcast_id: number
  subscriber_id: number
  status: DeliveryStatus
  error: string | null
  sent_at: string
  tg_user_id: string
  username: string | null
  first_name: string | null
}

export interface Tag {
  id: number
  name: string
  color: string
}

export interface Contact {
  account_id: number
  peer_id: string
  title: string
  username: string | null
  kind: string
  note: string
  updated_at: string
}

export interface ContactTag {
  account_id: number
  peer_id: string
  tag_id: number
}

/** Tayyor xabar (shablon): matn + media + tugmalar (tugmalar faqat botlarda ishlaydi). */
export interface Template {
  id: number
  name: string
  text: string
  media_json: string | null
  buttons_json: string | null
  created_at: string
  updated_at: string
}

/** Qora ro'yxat: bu foydalanuvchilarga kampaniya/API/bot javobi yuborilmaydi. */
export interface BlacklistEntry {
  id: number
  tg_user_id: string
  username: string | null
  title: string
  reason: string
  created_at: string
}

/** Akkaunt kampaniyasi: bitta xabar → tanlangan MAVJUD chatlarga, pauzalar bilan. */
export interface Campaign {
  id: number
  name: string
  account_id: number
  text: string
  media_json: string | null
  settings_json: string
  status: CampaignStatus
  total: number
  sent: number
  failed: number
  skipped: number
  last_error: string | null
  scheduled_at: string | null
  created_at: string
  finished_at: string | null
}

export interface CampaignRecipient {
  id: number
  campaign_id: number
  peer_id: string
  title: string
  username: string | null
  status: RecipientStatus
  error: string | null
  sent_at: string | null
}

export interface Setting {
  key: string
  value: string
}

export interface LogEntry {
  id: number
  level: LogLevel
  module: string
  message: string
  meta_json: string | null
  created_at: string
}

/** Media fayl tavsifi (media_json ichida massiv sifatida saqlanadi). */
export interface MediaItem {
  path: string
  kind: 'photo' | 'video' | 'document'
  caption?: string
}

/** Inline URL tugma (buttons_json ichida massiv-massiv: qatorlar). */
export interface UrlButton {
  text: string
  url: string
}
