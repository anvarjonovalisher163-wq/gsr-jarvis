import { AppError } from '../errors'

/**
 * Promise'ga vaqt chegarasi qo'yadi. Vaqt o'tsa AppError tashlaydi.
 * GramJS connect/sendCode ba'zi tarmoqlarda (proksi, firewall) javobsiz osilib qoladi —
 * foydalanuvchi spinner'ga abadiy qarab qolmasligi uchun.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  code = 'NETWORK',
  message = "Telegram serveridan javob kelmadi. Internet yoki proksi sozlamalarini tekshiring."
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError(code, message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

/** Telegram'ga ulanish va login so'rovlari uchun umumiy chegara. */
export const TELEGRAM_TIMEOUT_MS = 30_000
