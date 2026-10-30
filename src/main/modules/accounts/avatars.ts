import { app, net, protocol } from 'electron'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import type { TelegramClient } from 'telegram'
import type { EntityLike } from 'telegram/define'
import { createLogger } from '../../logger'

const log = createLogger('avatars')

/**
 * Avatarlar userData/avatars/ da keshlanadi va renderer'ga
 * tgm-avatar://<kind>/<id>?v=<mtime> URL orqali beriladi (dev'da ham, build'da ham ishlaydi;
 * file:// dev rejimda http origin'dan bloklanadi).
 *
 *   tgm-avatar://account/<accountId>  → avatars/account-<id>.jpg
 *   tgm-avatar://channel/<channelId>  → avatars/channel-<id>.jpg   (channels.id — bazadagi id)
 */
export const AVATAR_SCHEME = 'tgm-avatar'

type AvatarKind = 'account' | 'channel'
const KINDS: AvatarKind[] = ['account', 'channel']

/** app.whenReady() dan KEYIN chaqiriladi (protocols.ts orqali). Sxema protocols.ts da ro'yxatga olinadi. */
export function registerAvatarProtocol(): void {
  protocol.handle(AVATAR_SCHEME, (request) => {
    const url = new URL(request.url)
    const kind = url.hostname as AvatarKind
    const id = Number(url.pathname.replace('/', ''))
    if (!KINDS.includes(kind) || !Number.isInteger(id)) return new Response('', { status: 400 })
    const file = avatarFile(kind, id)
    if (!existsSync(file)) return new Response('', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

export function avatarDir(): string {
  const dir = join(app.getPath('userData'), 'avatars')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function avatarFile(kind: AvatarKind, id: number): string {
  return join(avatarDir(), `${kind}-${id}.jpg`)
}

/** Renderer uchun URL; fayl yo'q bo'lsa null. mtime — kesh buzish uchun. */
export function avatarUrl(kind: AvatarKind, id: number): string | null {
  const file = avatarFile(kind, id)
  if (!existsSync(file)) return null
  return `${AVATAR_SCHEME}://${kind}/${id}?v=${statSync(file).mtimeMs}`
}

/**
 * Profil/kanal rasmini yuklab keshlaydi. Rasm yo'q bo'lsa yoki xato bo'lsa null —
 * chaqiruvchi jarayon (login, sinxronlash) buzilmaydi.
 */
export async function downloadAvatar(
  client: TelegramClient,
  entity: EntityLike,
  kind: AvatarKind,
  id: number
): Promise<string | null> {
  try {
    const buf = await client.downloadProfilePhoto(entity, { isBig: false })
    if (!buf || !(buf instanceof Buffer) || buf.length === 0) return null
    const file = avatarFile(kind, id)
    writeFileSync(file, buf)
    return file
  } catch (e) {
    log.warn(`Avatar yuklanmadi (${kind} ${id})`, e)
    return null
  }
}

export function deleteAvatar(kind: AvatarKind, id: number): void {
  const file = avatarFile(kind, id)
  if (existsSync(file)) unlinkSync(file)
}
