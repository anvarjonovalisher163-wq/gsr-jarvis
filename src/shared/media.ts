import type { MediaItem } from './types'

/**
 * Mahalliy media fayllar renderer'ga tgm-file:// protokoli orqali beriladi.
 * Main faqat foydalanuvchi dialogda tanlagan yoki bazadagi postlarga tegishli
 * yo'llarga ruxsat beradi (whitelist) — ixtiyoriy fayl o'qilmaydi.
 */
export const MEDIA_SCHEME = 'tgm-file'

export function mediaUrl(path: string): string {
  return `${MEDIA_SCHEME}://local/?p=${encodeURIComponent(path)}`
}

/** Dialogdan tanlangan fayl: MediaItem + ko'rsatish uchun qo'shimcha maydonlar. */
export interface MediaFile extends MediaItem {
  name: string
  size: number
  url: string
}

/** Telegram cheklovlari. */
export const LIMITS = {
  textMax: 4096,
  captionMax: 1024,
  albumMax: 10,
  /** Rejalashtirish eng kami: hozirdan 1 daqiqa keyin */
  scheduleMinSec: 60,
  /** Eng ko'pi: 365 kun */
  scheduleMaxSec: 365 * 24 * 3600
} as const

const PHOTO_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'heic'])
const VIDEO_EXT = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'])

/** Kengaytma bo'yicha tur. GIF animatsiya hisoblanadi → document (albomga kirmaydi). */
export function mediaKindFromName(name: string): MediaItem['kind'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (PHOTO_EXT.has(ext)) return 'photo'
  if (VIDEO_EXT.has(ext)) return 'video'
  return 'document'
}

/**
 * Media to'plami Telegram qoidalariga mos keladimi?
 * - 1–10 ta rasm/video → albom
 * - 1 ta fayl (document) → yakka
 * - document bilan boshqa narsani aralashtirib bo'lmaydi
 */
export function validateMediaSet(items: MediaItem[]): string | null {
  if (items.length === 0) return null
  const docs = items.filter((m) => m.kind === 'document')
  if (docs.length > 0 && items.length > 1) return "Fayl (document) faqat yakka yuboriladi — rasm/video bilan birga bo'lmaydi."
  if (items.length > LIMITS.albumMax) return `Albomda ko'pi bilan ${LIMITS.albumMax} ta rasm/video bo'lishi mumkin.`
  return null
}
