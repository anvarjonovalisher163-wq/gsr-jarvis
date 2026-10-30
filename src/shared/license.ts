/** Litsenziya tiplari — main va renderer uchun umumiy. */

export type Plan = 'trial' | 'pro' | 'agency'

/** Server imzolagan payload (supabase/functions/_shared/license.ts bilan bir xil). */
export interface LicensePayload {
  key: string
  email: string
  plan: Plan
  max_accounts: number
  max_bots: number
  /** null = cheksiz */
  max_messages: number | null
  expires_at: string
  device_id: string
  issued_at: string
}

export type LicenseState =
  /** Litsenziya yo'q: trial yoki kalit kerak. */
  | 'none'
  /** Amal qilmoqda (trial yoki pullik). */
  | 'active'
  /** Muddati tugagan — faqat ko'rish rejimi. */
  | 'expired'
  /** Server bilan 3 kundan beri bog'lanib bo'lmadi — faqat ko'rish rejimi. */
  | 'stale'
  /** Server sozlanmagan (dev): mahalliy trial limitlari. */
  | 'unconfigured'
  /** Egasi rejimi (.env MAIN_VITE_OWNER_MODE=1): serversiz, cheksiz. */
  | 'owner'

export interface LicenseLimits {
  accounts: number
  bots: number
  /** null = cheksiz */
  messages: number | null
}

export interface LicenseUsage {
  accounts: number
  bots: number
  /** Yuborilgan post + rassilka xabarlari (jami). */
  messages: number
}

export interface LicenseStatus {
  state: LicenseState
  plan: Plan | null
  email: string | null
  /** Qisman yashirilgan kalit: TGM-PRO-AB12-…-EF56 */
  keyMasked: string | null
  expiresAt: string | null
  lastCheckedAt: string | null
  /** Oflayn amal qilish tugashigacha necha kun (stale bo'lmasa null). */
  offlineDaysLeft: number | null
  limits: LicenseLimits
  usage: LicenseUsage
  /** Yangi post/rassilka/akkaunt/bot bloklangan. */
  readOnly: boolean
  deviceId: string
}

/** Tariflar — Supabase migratsiyasidagi izoh bilan bir xil. */
export const PLAN_LIMITS: Record<Plan, LicenseLimits> = {
  trial: { accounts: 2, bots: 1, messages: 100 },
  pro: { accounts: 10, bots: 5, messages: null },
  agency: { accounts: 9999, bots: 9999, messages: null }
}

export const PLAN_LABEL: Record<Plan, string> = { trial: 'Free Trial', pro: 'Pro', agency: 'Agency' }

export const TRIAL_DAYS = 7
/** Oxirgi muvaffaqiyatli tekshiruvdan keyin oflayn ishlash muddati. */
export const OFFLINE_GRACE_DAYS = 3
/** Tekshiruv chastotasi. */
export const CHECK_INTERVAL_HOURS = 24
