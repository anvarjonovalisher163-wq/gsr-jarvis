import {
  CHECK_INTERVAL_HOURS,
  OFFLINE_GRACE_DAYS,
  PLAN_LIMITS,
  TRIAL_DAYS,
  type LicenseLimits,
  type LicensePayload,
  type LicenseStatus,
  type LicenseUsage
} from '@shared/license'
import { getDb } from '../../db'
import { settingsRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'
import { activateWithKey, checkLicense, startTrial as apiStartTrial, type SignedLicense } from './client'
import { licenseConfig } from './config'
import { deviceId } from './device'
import { verifySignature } from './verify'

const log = createLogger('license')

const K_STATE = 'license.state' // SignedLicense + checked_at
const K_LOCAL_TRIAL = 'license.local_trial_started' // server sozlanmaganda

interface Cached extends SignedLicense {
  checked_at: string
}

const DAY = 86_400_000

function readCache(): Cached | null {
  const c = settingsRepo.getJson<Cached | null>(K_STATE, null)
  if (!c) return null
  const cfg = licenseConfig()
  // Kesh buzilgan/boshqa qurilmadan ko'chirilgan bo'lsa — yo'q hisob
  if (c.license.device_id !== deviceId()) return null
  if (cfg && !verifySignature(c.license, c.signature, cfg.publicKey)) {
    log.warn('Keshdagi litsenziya imzosi mos emas — e\'tiborsiz')
    return null
  }
  return c
}

function writeCache(s: SignedLicense): void {
  settingsRepo.setJson(K_STATE, { ...s, checked_at: new Date().toISOString() })
}

function usage(): LicenseUsage {
  const db = getDb()
  const n = (sql: string) => (db.prepare(sql).get() as { c: number }).c
  return {
    accounts: n('SELECT COUNT(*) AS c FROM accounts'),
    bots: n('SELECT COUNT(*) AS c FROM bots'),
    messages:
      n(`SELECT COUNT(*) AS c FROM post_targets WHERE status = 'sent'`) +
      n(`SELECT COUNT(*) AS c FROM broadcast_deliveries WHERE status = 'sent'`)
  }
}

function limitsOf(p: LicensePayload): LicenseLimits {
  return { accounts: p.max_accounts, bots: p.max_bots, messages: p.max_messages }
}

function maskKey(key: string): string {
  const parts = key.split('-')
  if (parts.length < 4) return key.slice(0, 4) + '…'
  return `${parts[0]}-${parts[1]}-${parts[2]}-…-${parts[parts.length - 1]}`
}

export function getStatus(): LicenseStatus {
  const cfg = licenseConfig()
  const dev = deviceId()
  const use = usage()

  // Server sozlanmagan (dev): mahalliy trial
  if (!cfg) {
    let started = settingsRepo.get(K_LOCAL_TRIAL)
    if (!started) {
      started = new Date().toISOString()
      settingsRepo.set(K_LOCAL_TRIAL, started)
    }
    const expiresAt = new Date(Date.parse(started) + TRIAL_DAYS * DAY).toISOString()
    const expired = Date.now() > Date.parse(expiresAt)
    return {
      state: expired ? 'expired' : 'unconfigured',
      plan: 'trial',
      email: null,
      keyMasked: null,
      expiresAt,
      lastCheckedAt: null,
      offlineDaysLeft: null,
      limits: PLAN_LIMITS.trial,
      usage: use,
      readOnly: expired,
      deviceId: dev
    }
  }

  const c = readCache()
  if (!c) {
    return {
      state: 'none',
      plan: null,
      email: settingsRepo.get('license.email') ?? null,
      keyMasked: null,
      expiresAt: null,
      lastCheckedAt: null,
      offlineDaysLeft: null,
      limits: { accounts: 0, bots: 0, messages: 0 },
      usage: use,
      readOnly: true,
      deviceId: dev
    }
  }

  const now = Date.now()
  const expired = now > Date.parse(c.license.expires_at)
  const sinceCheck = now - Date.parse(c.checked_at)
  const stale = sinceCheck > OFFLINE_GRACE_DAYS * DAY
  const offlineDaysLeft = Math.max(0, Math.ceil((OFFLINE_GRACE_DAYS * DAY - sinceCheck) / DAY))

  return {
    state: expired ? 'expired' : stale ? 'stale' : 'active',
    plan: c.license.plan,
    email: c.license.email,
    keyMasked: maskKey(c.license.key),
    expiresAt: c.license.expires_at,
    lastCheckedAt: c.checked_at,
    offlineDaysLeft: sinceCheck > DAY ? offlineDaysLeft : null,
    limits: limitsOf(c.license),
    usage: use,
    readOnly: expired || stale,
    deviceId: dev
  }
}

export function emitLicenseChanged(): LicenseStatus {
  const s = getStatus()
  broadcast('license:changed', s)
  return s
}

function requireConfig() {
  const cfg = licenseConfig()
  if (!cfg) throw new AppError('LICENSE_UNCONFIGURED', 'Litsenziya serveri sozlanmagan (.env: MAIN_VITE_SUPABASE_URL va ochiq kalit).')
  return cfg
}

export async function startTrial(email: string): Promise<LicenseStatus> {
  const cfg = requireConfig()
  const e = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new AppError('EMAIL_INVALID', "Email noto'g'ri.")
  const signed = await apiStartTrial(cfg, deviceId(), e)
  settingsRepo.set('license.email', e)
  writeCache(signed)
  log.info(`Trial boshlandi: ${signed.license.plan}, tugaydi ${signed.license.expires_at}`)
  return emitLicenseChanged()
}

export async function activate(key: string): Promise<LicenseStatus> {
  const cfg = requireConfig()
  const k = key.trim().toUpperCase()
  if (!/^TGM-[A-Z]+-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(k)) {
    throw new AppError('KEY_FORMAT', "Kalit formati noto'g'ri. Namuna: TGM-PRO-AB12-CD34-EF56")
  }
  const signed = await activateWithKey(cfg, deviceId(), k)
  settingsRepo.set('license.email', signed.license.email)
  writeCache(signed)
  log.info(`Litsenziya faollashtirildi: ${signed.license.plan} (${maskKey(k)})`)
  return emitLicenseChanged()
}

/** Serverdan yangi holat. Tarmoq xatosi bo'lsa kesh saqlanadi (3 kun amal qiladi). */
export async function checkNow(): Promise<LicenseStatus> {
  const cfg = licenseConfig()
  const c = readCache()
  if (!cfg || !c) return getStatus()
  try {
    const signed = await checkLicense(cfg, deviceId(), c.license.key)
    writeCache(signed)
    log.info(`Litsenziya tekshirildi: ${signed.license.plan}, tugaydi ${signed.license.expires_at}`)
  } catch (e) {
    const err = e instanceof AppError ? e : null
    if (err && (err.code === 'LICENSE_REVOKED' || err.code === 'LICENSE_NOT_FOUND' || err.code === 'DEVICE_NOT_ACTIVATED')) {
      // Server aniq rad etdi — keshni o'chiramiz, faqat ko'rish rejimi
      log.warn(`Litsenziya rad etildi: ${err.code}`)
      settingsRepo.remove(K_STATE)
    } else {
      log.warn('Litsenziya tekshiruvi o\'tmadi (tarmoq?), kesh ishlatiladi', e)
    }
  }
  return emitLicenseChanged()
}

export function deactivate(): LicenseStatus {
  settingsRepo.remove(K_STATE)
  log.info('Litsenziya shu qurilmadan olib tashlandi')
  return emitLicenseChanged()
}

/** Ilova ochilganda va har 6 soatda: oxirgi tekshiruvdan 24 soat o'tgan bo'lsa tekshiradi. */
export function startPeriodicCheck(): () => void {
  const tick = () => {
    const c = readCache()
    if (!c) return
    if (Date.now() - Date.parse(c.checked_at) >= CHECK_INTERVAL_HOURS * 3_600_000) {
      checkNow().catch((e) => log.warn('Davriy tekshiruv xatosi', e))
    } else {
      emitLicenseChanged() // stale/expired holatlari vaqt o'tishi bilan o'zgaradi
    }
  }
  setTimeout(tick, 3000)
  const timer = setInterval(tick, 6 * 3_600_000)
  return () => clearInterval(timer)
}
