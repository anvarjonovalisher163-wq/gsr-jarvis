import { createPublicKey, verify as cryptoVerify } from 'crypto'
import type { LicensePayload } from '@shared/license'

/** Kalitlar alfavit tartibida — Edge Function'dagi canonical() bilan aynan bir xil. */
export function canonical(p: LicensePayload): string {
  const sorted: Record<string, unknown> = {}
  for (const k of Object.keys(p).sort()) sorted[k] = (p as unknown as Record<string, unknown>)[k]
  return JSON.stringify(sorted)
}

/** Ed25519 imzoni ochiq kalit (base64 SPKI DER) bilan tekshiradi. */
export function verifySignature(payload: LicensePayload, signatureB64: string, publicKeyB64: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' })
    return cryptoVerify(null, Buffer.from(canonical(payload)), key, Buffer.from(signatureB64, 'base64'))
  } catch {
    return false
  }
}

/** Payload shakli to'g'rimi (serverdan kelgan JSON ishonchsiz). */
export function isLicensePayload(v: unknown): v is LicensePayload {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return (
    typeof p.key === 'string' &&
    typeof p.email === 'string' &&
    (p.plan === 'trial' || p.plan === 'pro' || p.plan === 'agency') &&
    typeof p.max_accounts === 'number' &&
    typeof p.max_bots === 'number' &&
    (p.max_messages === null || typeof p.max_messages === 'number') &&
    typeof p.expires_at === 'string' &&
    typeof p.device_id === 'string' &&
    typeof p.issued_at === 'string'
  )
}
