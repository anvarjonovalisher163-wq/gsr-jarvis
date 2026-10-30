// POST /functions/v1/activate
// Body: { device_id, app_version?, key?, email? }
//   key bor   → kalitni tekshirib qurilmani qo'shadi (max_devices chegarasida)
//   key yo'q  → email bilan 7 kunlik trial (bitta qurilma = bitta trial)
// Javob: { ok: true, license, signature } yoki { ok: false, error: { code, message } }

import { admin, fail, genKey, type LicenseRow, logCheck, signedResponse, TRIAL, validDevice, validEmail } from '../_shared/license.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
  }
  if (req.method !== 'POST') return fail('METHOD', 'POST kutiladi', 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('BAD_JSON', "So'rov tanasi JSON emas")
  }
  const deviceId = body.device_id
  if (!validDevice(deviceId)) return fail('DEVICE_INVALID', "device_id noto'g'ri")
  const appVersion = typeof body.app_version === 'string' ? body.app_version : undefined
  const db = admin()

  // --- Kalit bilan faollashtirish ---
  if (typeof body.key === 'string' && body.key.trim()) {
    const key = body.key.trim().toUpperCase()
    const { data: lic } = await db.from('licenses').select('*').eq('key', key).maybeSingle<LicenseRow>()
    if (!lic) {
      await logCheck(db, { license_key: null, device_id: deviceId, action: 'activate', ok: false, error: 'LICENSE_NOT_FOUND', app_version: appVersion })
      return fail('LICENSE_NOT_FOUND', 'Bunday litsenziya kaliti topilmadi.', 404)
    }
    if (lic.revoked) {
      await logCheck(db, { license_key: key, device_id: deviceId, action: 'activate', ok: false, error: 'LICENSE_REVOKED', app_version: appVersion })
      return fail('LICENSE_REVOKED', 'Bu litsenziya bekor qilingan.', 403)
    }
    if (!lic.device_ids.includes(deviceId)) {
      if (lic.device_ids.length >= lic.max_devices) {
        await logCheck(db, { license_key: key, device_id: deviceId, action: 'activate', ok: false, error: 'DEVICE_LIMIT', app_version: appVersion })
        return fail('DEVICE_LIMIT', `Bu kalit allaqachon ${lic.max_devices} ta qurilmada ishlatilmoqda.`, 403)
      }
      const { error } = await db.from('licenses').update({ device_ids: [...lic.device_ids, deviceId] }).eq('key', key)
      if (error) return fail('DB', error.message, 500)
      lic.device_ids.push(deviceId)
    }
    await logCheck(db, { license_key: key, device_id: deviceId, action: 'activate', ok: true, app_version: appVersion })
    return signedResponse(lic, deviceId)
  }

  // --- Trial ---
  if (!validEmail(body.email)) return fail('EMAIL_INVALID', "Email noto'g'ri")
  const email = body.email.toLowerCase()

  const { data: existing } = await db.from('trial_devices').select('license_key').eq('device_id', deviceId).maybeSingle<{ license_key: string }>()
  if (existing) {
    // Bu qurilma trial olgan — o'shani qaytaramiz (muddati tugagan bo'lishi mumkin; ilova ko'rsatadi)
    const { data: lic } = await db.from('licenses').select('*').eq('key', existing.license_key).maybeSingle<LicenseRow>()
    if (lic) {
      await logCheck(db, { license_key: lic.key, device_id: deviceId, action: 'trial', ok: true, error: 'TRIAL_EXISTS', app_version: appVersion })
      return signedResponse(lic, deviceId)
    }
  }

  const row: LicenseRow = {
    key: genKey('TRIAL'),
    email,
    plan: 'trial',
    max_accounts: TRIAL.max_accounts,
    max_bots: TRIAL.max_bots,
    max_messages: TRIAL.max_messages,
    expires_at: new Date(Date.now() + TRIAL.days * 86_400_000).toISOString(),
    device_ids: [deviceId],
    max_devices: 1,
    revoked: false
  }
  const ins = await db.from('licenses').insert(row)
  if (ins.error) return fail('DB', ins.error.message, 500)
  await db.from('trial_devices').insert({ device_id: deviceId, email, license_key: row.key })
  await logCheck(db, { license_key: row.key, device_id: deviceId, action: 'trial', ok: true, app_version: appVersion })
  return signedResponse(row, deviceId)
})
