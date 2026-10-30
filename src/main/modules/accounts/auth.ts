import { BrowserWindow, app, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { Api, TelegramClient } from 'telegram'
import { computeCheck } from 'telegram/Password'
import type { AccountView, SessionImportResult, SignInResult } from '@shared/ipc'
import { accountsRepo } from '../../db/repositories'
import { decrypt, encrypt, isEncryptionAvailable } from '../../security/crypto'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { clientManager } from './clientManager'
import { getApiCredentials } from './credentials'
import { mapTelegramError } from './errors'
import { downloadAvatar } from './avatars'
import { toAccountView } from './views'
import { TELEGRAM_TIMEOUT_MS, withTimeout } from '../../utils/timeout'
import { assertCanAddAccount } from '../license/limits'
import { parseSessionFiles } from './sessionFiles'

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
    throw new AppError(
      'PHONE_NUMBER_INVALID',
      "Telefon raqam noto'g'ri. Xalqaro formatda kiriting: +998901234567"
    )
  }
  return digits.startsWith('+') ? digits : `+${digits}`
}

function requirePending(): PendingLogin {
  if (!pending) {
    throw new AppError(
      'NO_PENDING_LOGIN',
      'Login jarayoni topilmadi. Telefon raqamni qaytadan kiriting.'
    )
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
  assertCanAddAccount()
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
      p.client.invoke(
        new Api.auth.SignIn({ phoneNumber: p.phone, phoneCodeHash: p.phoneCodeHash, phoneCode })
      ),
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
    const pwd = await withTimeout(
      p.client.invoke(new Api.account.GetPassword()),
      TELEGRAM_TIMEOUT_MS
    )
    const srp = await computeCheck(pwd, password)
    await withTimeout(
      p.client.invoke(new Api.auth.CheckPassword({ password: srp })),
      TELEGRAM_TIMEOUT_MS
    )
    return { account: await finalizeLogin(p) }
  } catch (e) {
    throw mapTelegramError(e)
  }
}

/** Sessiyani shifrlab saqlaydi, klientni manager'ga beradi, avatarni yuklaydi. */
async function finalizeLogin(p: PendingLogin): Promise<AccountView> {
  const me = await p.client.getMe()
  if (me.className !== 'User')
    throw new AppError('INTERNAL', "Foydalanuvchi ma'lumotini olib bo'lmadi.")

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

/**
 * Tayyor sessiyalarni import qilish (kodsiz): GramJS StringSession yoki Telethon string session
 * (formatlari mos). Har satr alohida: ulanish → isUserAuthorized → getMe → shifrlab saqlash.
 * Litsenziya limiti har akkaunt uchun tekshiriladi. Boshqa dasturdan ko'chib o'tish uchun.
 */
export async function importSessions(
  sessions: string[],
  labels: (string | null)[] = []
): Promise<SessionImportResult[]> {
  if (!isEncryptionAvailable()) {
    throw new AppError(
      'ENCRYPTION_UNAVAILABLE',
      "Tizimda shifrlash xizmati mavjud emas — sessiyani xavfsiz saqlab bo'lmaydi."
    )
  }
  getApiCredentials()
  const results: SessionImportResult[] = []

  for (let i = 0; i < sessions.length; i++) {
    const raw = sessions[i].trim()
    const srcLabel = labels[i] ?? null
    const fail = (error: string) => results.push({ index: i, ok: false, label: srcLabel, error })
    if (!raw) continue
    if (!/^1[A-Za-z0-9+/=_-]{40,}$/.test(raw)) {
      fail("Sessiya satri formati noto'g'ri (GramJS/Telethon StringSession '1' bilan boshlanadi).")
      continue
    }
    try {
      assertCanAddAccount()
    } catch (e) {
      fail(e instanceof AppError ? e.message : String(e))
      continue
    }

    let client: TelegramClient | null = null
    try {
      client = clientManager.createClient(raw)
      await withTimeout(client.connect(), TELEGRAM_TIMEOUT_MS)
      if (!(await withTimeout(client.isUserAuthorized(), TELEGRAM_TIMEOUT_MS))) {
        await client.disconnect().catch(() => {})
        fail('Sessiya bekor qilingan yoki muddati tugagan — bu akkauntga qaytadan kirish kerak.')
        continue
      }
      const me = await client.getMe()
      if (me.className !== 'User')
        throw new AppError('INTERNAL', "Foydalanuvchi ma'lumotini olib bo'lmadi.")
      const phone = me.phone ? `+${me.phone}` : `id${me.id.toString()}`
      const existing = accountsRepo.getByPhone(phone)
      if (existing && clientManager.isConnected(existing.id)) {
        await client.disconnect().catch(() => {})
        results.push({
          index: i,
          ok: true,
          label:
            `${srcLabel ? srcLabel + ': ' : ''}${me.firstName ?? ''} ${me.username ? '@' + me.username : phone} — allaqachon ulangan`.trim(),
          error: null
        })
        continue
      }
      const saved = accountsRepo.upsert({
        phone,
        username: me.username ?? null,
        first_name: me.firstName ?? null,
        tg_user_id: me.id.toString(),
        session_encrypted: encrypt(client.session.save() as unknown as string)
      })
      clientManager.adopt(saved.id, client)
      await downloadAvatar(client, 'me', 'account', saved.id)
      log.info(`Sessiya import qilindi: ${saved.id} ${phone} @${me.username ?? '-'}`)
      results.push({
        index: i,
        ok: true,
        label:
          `${srcLabel ? srcLabel + ': ' : ''}${me.firstName ?? ''} ${me.username ? '@' + me.username : phone}`.trim(),
        error: null
      })
    } catch (e) {
      await client?.disconnect().catch(() => {})
      fail(mapTelegramError(e).message)
    }
  }
  return results
}

/**
 * Fayl tanlash dialogi: .session (Telethon/Pyrogram), .zip, .json, .txt.
 * Fayllar StringSession'ga aylantirilib importSessions orqali ulanadi.
 */
export async function importSessionFiles(
  win: BrowserWindow | null
): Promise<SessionImportResult[]> {
  const opts: Electron.OpenDialogOptions = {
    title: 'Sessiya fayllarini tanlash',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Sessiya fayllari', extensions: ['session', 'zip', 'json', 'txt'] },
      { name: 'Barcha fayllar', extensions: ['*'] }
    ]
  }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (res.canceled || res.filePaths.length === 0) return []
  const parsed = parseSessionFiles(res.filePaths)
  const results = await importSessions(
    parsed.sessions.map((s) => s.session),
    parsed.sessions.map((s) => s.label)
  )
  const offset = parsed.sessions.length
  parsed.failures.forEach((f, i) =>
    results.push({ index: offset + i, ok: false, label: f.label, error: f.error })
  )
  return results
}

/**
 * Tanlangan akkauntlar sessiyalarini matn fayliga eksport qiladi (telefon<TAB>StringSession).
 * DIQQAT: fayl akkauntga to'liq kirish beradi — foydalanuvchi ogohlantiriladi (UI'da).
 */
export async function exportSessions(
  ids: number[],
  win: BrowserWindow | null
): Promise<{ path: string | null; count: number }> {
  const lines: string[] = []
  for (const id of ids) {
    const acc = accountsRepo.getById(id)
    if (!acc?.session_encrypted) continue
    try {
      lines.push(`${acc.phone}\t${decrypt(acc.session_encrypted)}`)
    } catch (e) {
      log.warn(`Eksport: akkaunt ${id} sessiyasi ochilmadi`, e)
    }
  }
  if (lines.length === 0) throw new AppError('NOT_FOUND', "Eksport qilinadigan faol sessiya yo'q.")
  const opts: Electron.SaveDialogOptions = {
    title: 'Sessiyalarni eksport qilish',
    defaultPath: join(
      app.getPath('documents'),
      `tg-manager-sessions-${new Date().toISOString().slice(0, 10)}.txt`
    ),
    filters: [{ name: 'Matn', extensions: ['txt'] }]
  }
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (res.canceled || !res.filePath) return { path: null, count: 0 }
  writeFileSync(res.filePath, lines.join('\n') + '\n', { mode: 0o600 })
  log.info(`${lines.length} ta sessiya eksport qilindi: ${res.filePath}`)
  return { path: res.filePath, count: lines.length }
}
