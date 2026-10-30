import { app } from 'electron'
import type { LicensePayload } from '@shared/license'
import { AppError } from '../../errors'
import { withTimeout } from '../../utils/timeout'
import type { LicenseConfig } from './config'
import { isLicensePayload, verifySignature } from './verify'

const TIMEOUT_MS = 15_000

export interface SignedLicense {
  license: LicensePayload
  signature: string
}

const MESSAGES: Record<string, string> = {
  LICENSE_NOT_FOUND: 'Bunday litsenziya kaliti topilmadi. Kalitni tekshiring.',
  LICENSE_REVOKED: 'Bu litsenziya bekor qilingan. Sotuvchi bilan bog\'laning.',
  DEVICE_LIMIT: 'Bu kalit ruxsat etilgan qurilmalar sonida ishlatilmoqda.',
  DEVICE_NOT_ACTIVATED: 'Bu qurilma litsenziyaga ulanmagan. Kalitni qaytadan kiriting.',
  EMAIL_INVALID: "Email noto'g'ri.",
  DEVICE_INVALID: "Qurilma identifikatori noto'g'ri."
}

async function call(cfg: LicenseConfig, fn: 'activate' | 'check', body: Record<string, unknown>): Promise<SignedLicense> {
  let res: Response
  try {
    res = await withTimeout(
      fetch(`${cfg.url}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: cfg.anonKey,
          authorization: `Bearer ${cfg.anonKey}`
        },
        body: JSON.stringify({ ...body, app_version: app.getVersion() })
      }),
      TIMEOUT_MS,
      'LICENSE_NETWORK',
      "Litsenziya serveri javob bermadi. Internetni tekshiring."
    )
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError('LICENSE_NETWORK', "Litsenziya serveriga ulanib bo'lmadi. Internetni tekshiring.")
  }

  let data: { ok?: boolean; license?: unknown; signature?: unknown; error?: { code?: string; message?: string } }
  try {
    data = (await res.json()) as typeof data
  } catch {
    throw new AppError('LICENSE_BAD_RESPONSE', `Litsenziya serveri noto'g'ri javob berdi (${res.status}).`)
  }

  if (!data.ok) {
    const code = data.error?.code ?? `HTTP_${res.status}`
    throw new AppError(code, MESSAGES[code] ?? data.error?.message ?? `Litsenziya serveri xatosi: ${code}`)
  }
  if (!isLicensePayload(data.license) || typeof data.signature !== 'string') {
    throw new AppError('LICENSE_BAD_RESPONSE', "Litsenziya javobi shakli noto'g'ri.")
  }
  if (!verifySignature(data.license, data.signature, cfg.publicKey)) {
    throw new AppError('LICENSE_BAD_SIGNATURE', "Litsenziya imzosi tasdiqlanmadi. Ilova yoki server sozlamasi buzilgan.")
  }
  return { license: data.license, signature: data.signature }
}

export function activateWithKey(cfg: LicenseConfig, deviceId: string, key: string): Promise<SignedLicense> {
  return call(cfg, 'activate', { device_id: deviceId, key })
}

export function startTrial(cfg: LicenseConfig, deviceId: string, email: string): Promise<SignedLicense> {
  return call(cfg, 'activate', { device_id: deviceId, email })
}

export function checkLicense(cfg: LicenseConfig, deviceId: string, key: string): Promise<SignedLicense> {
  return call(cfg, 'check', { device_id: deviceId, key })
}
