// POST /functions/v1/check
// Body: { key, device_id, app_version? }
// Ilova kuniga bir marta chaqiradi; yangi imzolangan holat qaytadi (bekor qilish, uzaytirish shu yerdan ko'rinadi).

import { admin, fail, type LicenseRow, logCheck, signedResponse, validDevice } from '../_shared/license.ts'

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
  if (typeof body.key !== 'string' || !body.key.trim()) return fail('KEY_REQUIRED', 'Kalit kerak')
  const key = body.key.trim().toUpperCase()
  const appVersion = typeof body.app_version === 'string' ? body.app_version : undefined
  const db = admin()

  const { data: lic } = await db.from('licenses').select('*').eq('key', key).maybeSingle<LicenseRow>()
  if (!lic) {
    await logCheck(db, { license_key: null, device_id: deviceId, action: 'check', ok: false, error: 'LICENSE_NOT_FOUND', app_version: appVersion })
    return fail('LICENSE_NOT_FOUND', 'Litsenziya topilmadi.', 404)
  }
  if (lic.revoked) {
    await logCheck(db, { license_key: key, device_id: deviceId, action: 'check', ok: false, error: 'LICENSE_REVOKED', app_version: appVersion })
    return fail('LICENSE_REVOKED', 'Bu litsenziya bekor qilingan.', 403)
  }
  if (!lic.device_ids.includes(deviceId)) {
    await logCheck(db, { license_key: key, device_id: deviceId, action: 'check', ok: false, error: 'DEVICE_NOT_ACTIVATED', app_version: appVersion })
    return fail('DEVICE_NOT_ACTIVATED', 'Bu qurilma litsenziyaga ulanmagan. Kalitni qaytadan kiriting.', 403)
  }
  await logCheck(db, { license_key: key, device_id: deviceId, action: 'check', ok: true, app_version: appVersion })
  return signedResponse(lic, deviceId)
})
