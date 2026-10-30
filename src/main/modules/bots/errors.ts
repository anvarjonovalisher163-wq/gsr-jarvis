import { GrammyError, HttpError } from 'grammy'
import { AppError, isAppError } from '../../errors'
import { formatWait } from '../accounts/errors'

/** Bot API (grammY) xatosi → o'zbekcha AppError. */
export function mapBotError(e: unknown): AppError {
  if (isAppError(e)) return e

  if (e instanceof GrammyError) {
    switch (e.error_code) {
      case 401:
        return new AppError('BOT_TOKEN_INVALID', "Bot tokeni noto'g'ri yoki bekor qilingan. @BotFather da tekshiring.")
      case 409:
        return new AppError(
          'BOT_CONFLICT',
          "Bu bot boshqa joyda ham ishga tushirilgan (getUpdates to'qnashuvi). Boshqa nusxani to'xtating."
        )
      case 429: {
        const s = e.parameters.retry_after ?? 0
        return new AppError('FLOOD_WAIT', `Bot API cheklovi: ${formatWait(s)} kutish kerak.`, s)
      }
      case 403:
        return new AppError('BOT_BLOCKED', 'Foydalanuvchi botni bloklagan.')
      case 400:
        return new AppError('BOT_BAD_REQUEST', `Telegram rad etdi: ${e.description}`)
      default:
        return new AppError(`BOT_API_${e.error_code}`, `Telegram Bot API: ${e.description}`)
    }
  }

  if (e instanceof HttpError) {
    return new AppError('NETWORK', "Telegram Bot API'ga ulanib bo'lmadi. Internetni tekshiring.")
  }

  if (e instanceof Error) return new AppError('INTERNAL', `Kutilmagan xato: ${e.message}`)
  return new AppError('INTERNAL', 'Kutilmagan xato.')
}

/** 403 — foydalanuvchi botni bloklagan yoki o'chirgan: obunadan chiqarish kerak. */
export function isBlockedError(e: unknown): boolean {
  return e instanceof GrammyError && e.error_code === 403
}
