import type { Campaign, CampaignRecipient, MediaItem, UrlButton } from './types'

/**
 * Akkaunt kampaniyasi ("Xabarnoma"): bitta xabar faqat akkauntning MAVJUD chatlariga
 * (sizga yozgan / siz yozgan odamlar), orasida pauza bilan.
 * Qoidalar (o'zgarmaydi): notanishlarga baza bo'yicha yuborish yo'q, FLOOD_WAIT'da boshqa
 * akkauntga o'tish yo'q (faqat kutish/to'xtash), kunlik limit.
 */
export interface CampaignSettings {
  /** Xabarlar orasidagi kechikish (soniya), tasodifiy [min, max] */
  delayMin: number
  delayMax: number
  /** Shuncha xabardan keyin uzun pauza */
  groupSize: number
  groupPauseMin: number
  groupPauseMax: number
  /** Avval biror kampaniya/API orqali yozilganlarni o'tkazib yuborish */
  onlyNew: boolean
  /** Akkaunt bo'yicha 24 soatda ko'pi bilan shuncha (kampaniya + API) */
  dailyLimit: number
}

export const CAMPAIGN_DEFAULTS: CampaignSettings = {
  delayMin: 8,
  delayMax: 20,
  groupSize: 15,
  groupPauseMin: 90,
  groupPauseMax: 180,
  onlyNew: false,
  dailyLimit: 50
}

/** Qattiq chegaralar — UI va main ikkalasida. */
export const CAMPAIGN_BOUNDS = {
  delayMinFloor: 3,
  delayMax: 600,
  groupSizeMax: 100,
  groupPauseMax: 3600,
  dailyLimitMax: 200,
  recipientsMax: 2000
} as const

export interface RecipientInput {
  /** u<id> — faqat foydalanuvchilar */
  peer: string
  title: string
  username: string | null
}

export interface CampaignInput {
  id?: number
  name: string
  accountId: number
  /** Telegram HTML */
  text: string
  media: MediaItem | null
  settings: CampaignSettings
  recipients: RecipientInput[]
  /** ISO (UTC) yoki null */
  scheduledAt: string | null
}

export interface CampaignView extends Campaign {
  account_label: string
  settings: CampaignSettings
  media: MediaItem | null
  /** FLOOD_WAIT tufayli avtomatik davom etish vaqti (ISO) */
  resumeAt: string | null
}

export interface CampaignReport {
  campaign: CampaignView
  recipients: CampaignRecipient[]
}

export interface TemplateInput {
  id?: number
  name: string
  text: string
  media: MediaItem | null
  buttons: UrlButton[][]
}

export interface TemplateView {
  id: number
  name: string
  text: string
  media: MediaItem | null
  buttons: UrlButton[][]
  updated_at: string
}

export interface BlacklistInput {
  /** Raqamli Telegram user id yoki peer kaliti u<id> */
  tgUserId: string
  username: string | null
  title: string
  reason: string
}

/** Lokal REST API holati (CRM integratsiyasi). */
export interface ApiServerStatus {
  enabled: boolean
  running: boolean
  port: number
  /** http://127.0.0.1:<port>/api */
  baseUrl: string
  key: string
  /** Akkaunt bo'yicha 24 soatlik limit (kampaniya bilan umumiy) */
  dailyLimit: number
  /** Bugun API orqali yuborilganlar */
  sentToday: number
  lastError: string | null
}

export interface UserProfile {
  name: string
  email: string
  phone: string
}

/** Story yuborish (profil yoki kanal). */
export interface StoryInput {
  accountId: number
  /** null — o'z profili, aks holda channels.id (admin kanal) */
  channelId: number | null
  media: MediaItem
  caption: string
  /** 6 | 12 | 24 | 48 */
  periodHours: number
  privacy: 'all' | 'contacts' | 'close'
  /** Profilda doimiy saqlash */
  pinned: boolean
}

export interface StoryResult {
  storyId: number | null
  target: string
}
