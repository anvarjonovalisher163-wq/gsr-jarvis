import { settingsRepo, SettingKeys } from '../../db/repositories'
import { AppError } from '../../errors'

export interface ApiCredentials {
  apiId: number
  apiHash: string
}

/**
 * Sozlamalardan api_id/api_hash oladi. Bo'sh bo'lsa foydalanuvchini
 * Sozlamalar'ga yo'naltiruvchi xato beradi (UI buni alohida ko'rsatadi).
 */
export function getApiCredentials(): ApiCredentials {
  const idRaw = settingsRepo.get(SettingKeys.apiId)?.trim()
  const apiHash = settingsRepo.get(SettingKeys.apiHash)?.trim()
  const apiId = Number(idRaw)

  if (!idRaw || !apiHash || !Number.isInteger(apiId) || apiId <= 0) {
    throw new AppError(
      'API_CREDENTIALS_MISSING',
      "Telegram api_id va api_hash kiritilmagan. Sozlamalar → Telegram API bo'limini to'ldiring."
    )
  }
  if (!/^[a-f0-9]{32}$/i.test(apiHash)) {
    throw new AppError('API_HASH_INVALID', "api_hash 32 ta belgidan iborat bo'lishi kerak (my.telegram.org dan nusxalang).")
  }
  return { apiId, apiHash }
}

export function hasApiCredentials(): boolean {
  try {
    getApiCredentials()
    return true
  } catch {
    return false
  }
}
