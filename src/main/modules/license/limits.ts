import { PLAN_LABEL } from '@shared/license'
import { AppError } from '../../errors'
import { getStatus } from './service'

/**
 * Litsenziya cheklovlari. Har bir "yaratuvchi" amal oldidan chaqiriladi:
 * akkaunt qo'shish, bot qo'shish, post yuborish, rassilka.
 * Faqat ko'rish rejimi: muddati tugagan, 3 kun oflayn, yoki litsenziya yo'q.
 */

function readOnlyError(state: string): AppError {
  switch (state) {
    case 'none':
      return new AppError('LICENSE_REQUIRED', "Litsenziya yo'q. Trial boshlang yoki kalit kiriting (chap pastdagi tarif bloki).")
    case 'stale':
      return new AppError('LICENSE_STALE', "Litsenziya 3 kundan beri tekshirilmadi. Internetga ulanib \"Tekshirish\" bosing.")
    default:
      return new AppError('LICENSE_EXPIRED', 'Litsenziya muddati tugagan — faqat ko\'rish rejimi. Kalit kiriting yoki uzaytiring.')
  }
}

export function assertWritable(): void {
  const s = getStatus()
  if (s.readOnly) throw readOnlyError(s.state)
}

export function assertCanAddAccount(): void {
  const s = getStatus()
  if (s.readOnly) throw readOnlyError(s.state)
  if (s.usage.accounts >= s.limits.accounts) {
    throw new AppError('LICENSE_LIMIT_ACCOUNTS', `${PLAN_LABEL[s.plan ?? 'trial']} tarifida ko'pi bilan ${s.limits.accounts} ta akkaunt. Tarifni oshiring.`)
  }
}

export function assertCanAddBot(): void {
  const s = getStatus()
  if (s.readOnly) throw readOnlyError(s.state)
  if (s.usage.bots >= s.limits.bots) {
    throw new AppError('LICENSE_LIMIT_BOTS', `${PLAN_LABEL[s.plan ?? 'trial']} tarifida ko'pi bilan ${s.limits.bots} ta bot. Tarifni oshiring.`)
  }
}

/** n ta xabar yuborishdan oldin. */
export function assertCanSend(n: number): void {
  const s = getStatus()
  if (s.readOnly) throw readOnlyError(s.state)
  if (s.limits.messages !== null && s.usage.messages + n > s.limits.messages) {
    const left = Math.max(0, s.limits.messages - s.usage.messages)
    throw new AppError(
      'LICENSE_LIMIT_MESSAGES',
      `${PLAN_LABEL[s.plan ?? 'trial']} limiti: ${s.limits.messages} ta xabar (qoldi ${left}, kerak ${n}). Tarifni oshiring.`
    )
  }
}
