import { errors } from 'telegram'
import { AppError, isAppError } from '../../errors'

/** Telegram RPC xato kodi → foydalanuvchiga o'zbekcha matn. */
const MESSAGES: Record<string, string> = {
  PHONE_NUMBER_INVALID: "Telefon raqam noto'g'ri. Xalqaro formatda kiriting: +998901234567",
  PHONE_NUMBER_BANNED: 'Bu telefon raqam Telegram tomonidan bloklangan.',
  PHONE_NUMBER_UNOCCUPIED:
    "Bu raqamda Telegram akkaunt yo'q. Avval Telegram ilovasida ro'yxatdan o'ting.",
  PHONE_NUMBER_FLOOD: "Bu raqamga juda ko'p urinish bo'ldi. Keyinroq qayta urining.",
  PHONE_CODE_INVALID: "Kod noto'g'ri. Qaytadan tekshirib kiriting.",
  PHONE_CODE_EXPIRED: "Kod muddati tugadi. Kodni qaytadan so'rang.",
  PHONE_CODE_EMPTY: 'Kodni kiriting.',
  PHONE_CODE_HASH_EMPTY: "Login sessiyasi topilmadi. Kodni qaytadan so'rang.",
  PASSWORD_HASH_INVALID: "Ikki bosqichli parol noto'g'ri.",
  PASSWORD_EMPTY: 'Parolni kiriting.',
  PHONE_PASSWORD_FLOOD: "Parol juda ko'p marta noto'g'ri kiritildi. Keyinroq urining.",
  SESSION_PASSWORD_NEEDED: 'Ikki bosqichli tekshiruv paroli kerak.',
  SESSION_REVOKED: 'Sessiya boshqa qurilmadan bekor qilingan. Qaytadan kiring.',
  AUTH_KEY_UNREGISTERED: 'Sessiya haqiqiy emas. Akkauntga qaytadan kiring.',
  AUTH_KEY_DUPLICATED: 'Sessiya boshqa joyda ishlatilmoqda. Akkauntga qaytadan kiring.',
  USER_DEACTIVATED: "Bu akkaunt o'chirilgan.",
  USER_DEACTIVATED_BAN: 'Bu akkaunt Telegram tomonidan bloklangan.',
  API_ID_INVALID: "api_id yoki api_hash noto'g'ri. Sozlamalar'ni tekshiring.",
  API_ID_PUBLISHED_FLOOD:
    "Bu api_id ommaviy ishlatilgani uchun cheklangan. O'zingizning api_id'ingizni kiriting.",
  NETWORK: "Telegram serveriga ulanib bo'lmadi. Internetni tekshiring."
}

/**
 * GramJS xatosini AppError'ga aylantiradi.
 * FLOOD_WAIT: retryAfter soniya bilan qaytadi — chaqiruvchi boshqa akkauntga o'tmaydi, faqat kutadi.
 */
export function mapTelegramError(e: unknown): AppError {
  if (isAppError(e)) return e

  if (e instanceof errors.FloodWaitError) {
    const s = e.seconds
    return new AppError('FLOOD_WAIT', `Telegram cheklovi: ${formatWait(s)} kutish kerak.`, s)
  }

  if (e instanceof errors.RPCError) {
    const code = e.errorMessage
    const text = MESSAGES[code]
    if (text) return new AppError(code, text)
    return new AppError(code, `Telegram xatosi: ${code}`)
  }

  if (e instanceof Error) {
    if (/ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|Not connected|timeout/i.test(e.message)) {
      return new AppError('NETWORK', MESSAGES.NETWORK)
    }
    return new AppError('INTERNAL', `Kutilmagan xato: ${e.message}`)
  }

  return new AppError('INTERNAL', 'Kutilmagan xato.')
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} soniya`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} daqiqa`
  return `${Math.ceil(seconds / 3600)} soat`
}
