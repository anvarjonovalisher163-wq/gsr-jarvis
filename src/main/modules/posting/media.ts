import { BrowserWindow, dialog, net, protocol } from 'electron'
import { statSync } from 'fs'
import { basename } from 'path'
import { pathToFileURL } from 'url'
import { MEDIA_SCHEME, mediaKindFromName, mediaUrl, type MediaFile } from '@shared/media'
import type { MediaItem } from '@shared/types'

/**
 * Renderer faqat shu to'plamdagi yo'llarni tgm-file:// orqali o'qiy oladi:
 * foydalanuvchi dialogda tanlagan yoki bazadagi postlarga tegishli fayllar.
 */
const allowed = new Set<string>()

export function allowMediaPaths(items: MediaItem[]): void {
  for (const m of items) allowed.add(m.path)
}

export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const url = new URL(request.url)
    const path = url.searchParams.get('p')
    if (!path || !allowed.has(path)) return new Response('', { status: 403 })
    try {
      statSync(path)
    } catch {
      return new Response('', { status: 404 })
    }
    return net.fetch(pathToFileURL(path).toString(), { headers: request.headers })
  })
}

export async function pickMedia(win: BrowserWindow | null): Promise<MediaFile[]> {
  const opts: Electron.OpenDialogOptions = {
    title: 'Media tanlash',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Rasm va video', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'm4v', 'webm', 'mkv'] },
      { name: 'Barcha fayllar', extensions: ['*'] }
    ]
  }
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (result.canceled) return []

  const files: MediaFile[] = []
  for (const path of result.filePaths) {
    const name = basename(path)
    let size = 0
    try {
      size = statSync(path).size
    } catch {
      continue
    }
    allowed.add(path)
    files.push({ path, name, size, kind: mediaKindFromName(name), url: mediaUrl(path) })
  }
  return files
}
