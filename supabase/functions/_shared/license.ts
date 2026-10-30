// Edge Function'lar uchun umumiy kod (Deno).
// Imzolash: Ed25519, LICENSE_PRIVATE_KEY (base64 PKCS8 DER) secret'dan.
// Ilova LICENSE_PUBLIC_KEY (base64 SPKI DER) bilan tekshiradi — maxfiy kalit ilovaga tushmaydi.
//
// MUHIM: imzolanadigan payload shakli ilovadagi src/main/modules/license/verify.ts bilan
// AYNAN bir xil bo'lishi kerak (kalitlar alfavit tartibida, JSON.stringify).

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export type Plan = 'trial' | 'pro' | 'agency'

export interface LicenseRow {
  key: string
  email: string
  plan: Plan
  max_accounts: number
  max_bots: number
  max_messages: number | null
  expires_at: string
  device_ids: string[]
  max_devices: number
  revoked: boolean
}

/** Ilovaga yuboriladigan va imzolanadigan payload. */
export interface LicensePayload {
  key: string
  email: string
  plan: Plan
  max_accounts: number
  max_bots: number
  max_messages: number | null
  expires_at: string
  device_id: string
  issued_at: string
}

export const TRIAL = { days: 7, max_accounts: 2, max_bots: 1, max_messages: 100 }

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  })
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  })
}

export function fail(code: string, message: string, status = 400): Response {
  return json({ ok: false, error: { code, message } }, status)
}

/** Kalitlar alfavit tartibida — Node tomonida ham shunday. */
export function canonical(p: LicensePayload): string {
  const sorted: Record<string, unknown> = {}
  for (const k of Object.keys(p).sort()) sorted[k] = (p as Record<string, unknown>)[k]
  return JSON.stringify(sorted)
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
function bytesToB64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

export async function sign(p: LicensePayload): Promise<string> {
  const priv = Deno.env.get('LICENSE_PRIVATE_KEY')
  if (!priv) throw new Error('LICENSE_PRIVATE_KEY secret sozlanmagan')
  const key = await crypto.subtle.importKey('pkcs8', b64ToBytes(priv), { name: 'Ed25519' }, false, ['sign'])
  const sig = await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(canonical(p)))
  return bytesToB64(sig)
}

export function toPayload(row: LicenseRow, deviceId: string): LicensePayload {
  return {
    key: row.key,
    email: row.email,
    plan: row.plan,
    max_accounts: row.max_accounts,
    max_bots: row.max_bots,
    max_messages: row.max_messages,
    expires_at: row.expires_at,
    device_id: deviceId,
    issued_at: new Date().toISOString()
  }
}

export async function signedResponse(row: LicenseRow, deviceId: string): Promise<Response> {
  const license = toPayload(row, deviceId)
  return json({ ok: true, license, signature: await sign(license) })
}

export function genKey(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // o'xshash belgilar (0/O, 1/I) yo'q
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let s = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) s += '-'
    s += alphabet[bytes[i] % alphabet.length]
  }
  return `TGM-${prefix}-${s}`
}

export async function logCheck(
  db: SupabaseClient,
  entry: { license_key: string | null; device_id: string; action: 'activate' | 'check' | 'trial'; ok: boolean; error?: string; app_version?: string }
): Promise<void> {
  await db.from('license_checks').insert(entry)
}

export function validEmail(e: unknown): e is string {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
}

export function validDevice(d: unknown): d is string {
  return typeof d === 'string' && /^[a-f0-9]{16,128}$/i.test(d)
}
