import { app, net, protocol } from 'electron'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import type { TelegramClient } from 'telegram'
import { createLogger } from '../../logger'

const log = createLogger('avatars')

/**
 * Avatarlar userData/avatars/<accountId>.jpg da keshlanadi va renderer'ga
 * tgm-avatar://account/<id>?v=<mtime> URL orqali beriladi (dev'da ham, build'da ham ishlaydi;
 * file:// dev rejimda http origin'dan bloklanadi).
 */
export const AVATAR_SCHEME = 'tgm-avatar'

/** app.whenReady() dan OLDIN chaqirilishi shart. */
export function registerAvatarScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: AVATAR_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

/** app.whenReady() dan KEYIN chaqiriladi. */
export function registerAvatarProtocol(): void {
  protocol.handle(AVATAR_SCHEME, (request) => {
    const url = new URL(request.url)
    // tgm-avatar://account/12 → host "account", pathname "/12"
    const id = Number(url.pathname.replace('/', ''))
    const file = Number.isInteger(id) ? avatarFile(id) : null
    if (!file || !existsSync(file)) return new Response('', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

export function avatarDir(): string {
  const dir = join(app.getPath('userData'), 'avatars')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function avatarFile(accountId: number): string {
  return join(avatarDir(), `${accountId}.jpg`)
}

/** Renderer uchun URL; fayl yo'q bo'lsa null. mtime — kesh buzish uchun. */
export function avatarUrl(accountId: number): string | null {
  const file = avatarFile(accountId)
  if (!existsSync(file)) return null
  return `${AVATAR_SCHEME}://account/${accountId}?v=${statSync(file).mtimeMs}`
}

/** Profil rasmini yuklab keshlaydi. Rasm yo'q bo'lsa yoki xato bo'lsa null (login buzilmaydi). */
export async function downloadAvatar(client: TelegramClient, accountId: number): Promise<string | null> {
  try {
    const buf = await client.downloadProfilePhoto('me', { isBig: false })
    if (!buf || !(buf instanceof Buffer) || buf.length === 0) return null
    const file = avatarFile(accountId)
    writeFileSync(file, buf)
    return file
  } catch (e) {
    log.warn(`Avatar yuklanmadi (akkaunt ${accountId})`, e)
    return null
  }
}

export function deleteAvatar(accountId: number): void {
  const file = avatarFile(accountId)
  if (existsSync(file)) unlinkSync(file)
}
