import { Api, TelegramClient } from 'telegram'
import { computeCheck } from 'telegram/Password'
import type { AccountView, SignInResult } from '@shared/ipc'
import { accountsRepo } from '../../db/repositories'
import { encrypt, isEncryptionAvailable } from '../../security/crypto'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { clientManager } from './clientManager'
import { getApiCredentials } from './credentials'
import { mapTelegramError } from './errors'
import { downloadAvatar } from './avatars'
import { toAccountView } from './views'
import { TELEGRAM_TIMEOUT_MS, withTimeout } from '../../utils/timeout'

const log = createLogger('auth')

/**
 * Login oqimi: sendCode(phone) → signIn(code) → [check2FA(password)].
 * Bir vaqtda bitta login jarayoni bo'ladi (pending).
 */
interface PendingLogin {
  client: TelegramClient
  phone: string
  phoneCodeHash: string
}

let pending: PendingLogin | null = null

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-()]/g, '')
  if (!/^\+?\d{7,15}$/.test(digits)) {
    throw new AppError('PHONE_NUMBER_INVALID', "Telefon raqam noto'g'ri. Xalqaro formatda kiriting: +998901234567")
  }
  return digits.startsWith('+') ? digits : `+${digits}`
}

function requirePending(): PendingLogin {
  if (!pending) {
    throw new AppError('NO_PENDING_LOGIN', "Login jarayoni topilmadi. Telefon raqamni qaytadan kiriting.")
  }
  return pending
}

export async function cancelLogin(): Promise<void> {
  if (!pending) return
  const { client } = pending
  pending = null
  await client.disconnect().catch(() => {})
}

export async function sendCode(rawPhone: string): Promise<{ viaApp: boolean }> {
  if (!isEncryptionAvailable()) {
    throw new AppError(
      'ENCRYPTION_UNAVAILABLE',
      "Tizimda shifrlash xizmati (Keychain/DPAPI) mavjud emas — sessiyani xavfsiz saqlab bo'lmaydi."
    )
  }
  const phone = normalizePhone(rawPhone)
  const creds = getApiCredentials()
  await cancelLogin()

  const client = clientManager.createClient('')
  try {
    // Ulanish + kod so'rash birgalikda 30s dan oshmasin, aks holda spinner abadiy aylanadi
    const { phoneCodeHash, isCodeViaApp } = await withTimeout(
      client.connect().then(() => client.sendCode(creds, phone)),
      TELEGRAM_TIMEOUT_MS
    )
    pending = { client, phone, phoneCodeHash }
    log.info(`Kod yuborildi: ${phone} (${isCodeViaApp ? 'ilova' : 'SMS'})`)
    return { viaApp: isCodeViaApp }
  } catch (e) {
    await client.disconnect().catch(() => {})
    throw mapTelegramError(e)
  }
}

export async function signIn(code: string): Promise<SignInResult> {
  const p = requirePending()
  const phoneCode = code.replace(/\D/g, '')
  if (!phoneCode) throw new AppError('PHONE_CODE_EMPTY', 'Kodni kiriting.')

  try {
    const result = await withTimeout(
      p.client.invoke(new Api.auth.SignIn({ phoneNumber: p.phone, phoneCodeHash: p.phoneCodeHash, phoneCode })),
      TELEGRAM_TIMEOUT_MS
    )
    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new AppError(
        'PHONE_NUMBER_UNOCCUPIED',
        "Bu raqamda Telegram akkaunt yo'q. Avval Telegram ilovasida ro'yxatdan o'ting."
      )
    }
    return { status: 'done', account: await finalizeLogin(p) }
  } catch (e) {
    const err = mapTelegramError(e)
    if (err.code === 'SESSION_PASSWORD_NEEDED') {
      const pwd = await p.client.invoke(new Api.account.GetPassword()).catch(() => null)
      return { status: 'password', hint: pwd?.hint ?? '' }
    }
    // Kod muddati tugagan yoki noto'g'ri — pending saqlanadi, foydalanuvchi qayta kiritadi
    throw err
  }
}

export async function check2FA(password: string): Promise<{ account: AccountView }> {
  const p = requirePending()
  if (!password) throw new AppError('PASSWORD_EMPTY', 'Parolni kiriting.')

  try {
    const pwd = await withTimeout(p.client.invoke(new Api.account.GetPassword()), TELEGRAM_TIMEOUT_MS)
    const srp = await computeCheck(pwd, password)
    await withTimeout(p.client.invoke(new Api.auth.CheckPassword({ password: srp })), TELEGRAM_TIMEOUT_MS)
    return { account: await finalizeLogin(p) }
  } catch (e) {
    throw mapTelegramError(e)
  }
}

/** Sessiyani shifrlab saqlaydi, klientni manager'ga beradi, avatarni yuklaydi. */
async function finalizeLogin(p: PendingLogin): Promise<AccountView> {
  const me = await p.client.getMe()
  if (me.className !== 'User') throw new AppError('INTERNAL', "Foydalanuvchi ma'lumotini olib bo'lmadi.")

  const session = p.client.session.save() as unknown as string
  const saved = accountsRepo.upsert({
    phone: p.phone,
    username: me.username ?? null,
    first_name: me.firstName ?? null,
    tg_user_id: me.id.toString(),
    session_encrypted: encrypt(session)
  })

  pending = null
  clientManager.adopt(saved.id, p.client)
  await downloadAvatar(p.client, 'me', 'account', saved.id)
  log.info(`Akkaunt kirdi: ${saved.id} ${saved.phone} @${saved.username ?? '-'}`)
  return toAccountView(saved)
}
