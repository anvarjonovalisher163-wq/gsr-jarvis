/**
 * Vaqt zonasi yordamchilari (kutubxonasiz, Intl asosida).
 * Foydalanuvchi datetime-local'da "devor vaqti"ni kiritadi, biz uni sozlamalardagi
 * zonada talqin qilib UTC'ga o'tkazamiz. Telegram'ga UTC soniya ketadi.
 */

export const DEFAULT_TIMEZONE = 'Asia/Tashkent'

export const TIMEZONES: { id: string; label: string }[] = [
  { id: 'Asia/Tashkent', label: 'Toshkent (UTC+5)' },
  { id: 'Asia/Almaty', label: 'Almati (UTC+5)' },
  { id: 'Asia/Bishkek', label: 'Bishkek (UTC+6)' },
  { id: 'Asia/Dushanbe', label: 'Dushanbe (UTC+5)' },
  { id: 'Asia/Ashgabat', label: 'Ashxobod (UTC+5)' },
  { id: 'Asia/Baku', label: 'Boku (UTC+4)' },
  { id: 'Europe/Moscow', label: 'Moskva (UTC+3)' },
  { id: 'Europe/Istanbul', label: 'Istanbul (UTC+3)' },
  { id: 'Asia/Dubai', label: 'Dubay (UTC+4)' },
  { id: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)' },
  { id: 'Europe/London', label: 'London (UTC+0/+1)' },
  { id: 'UTC', label: 'UTC' }
]

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

interface Parts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function partsIn(date: Date, tz: string): Parts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const p: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour === 24 ? 0 : +p.hour,
    minute: +p.minute,
    second: +p.second
  }
}

/** Berilgan paytda zonaning UTC'dan farqi (ms). */
function tzOffsetMs(date: Date, tz: string): number {
  const p = partsIn(date, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * "YYYY-MM-DDTHH:mm" (zona devor vaqti) → Date (UTC).
 * DST o'tishlari uchun ikki marta tekshiradi.
 */
export function wallTimeToUtc(wall: string, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall)
  if (!m) throw new Error(`Noto'g'ri vaqt formati: ${wall}`)
  const [, y, mo, d, h, mi] = m.map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const off1 = tzOffsetMs(new Date(guess), tz)
  let utc = guess - off1
  const off2 = tzOffsetMs(new Date(utc), tz)
  if (off2 !== off1) utc = guess - off2
  return new Date(utc)
}

/** ISO/Date → "YYYY-MM-DDTHH:mm" zona devor vaqti (datetime-local uchun). */
export function utcToWallTime(date: Date | string, tz: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const p = partsIn(d, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** "30.10.2026 18:45" ko'rinishida. */
export function formatInTz(date: Date | string, tz: string, withSeconds = false): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  const p = partsIn(d, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = `${pad(p.day)}.${pad(p.month)}.${p.year} ${pad(p.hour)}:${pad(p.minute)}`
  return withSeconds ? `${base}:${pad(p.second)}` : base
}

/** Faqat soat: "18:45" */
export function formatTimeInTz(date: Date | string, tz: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const p = partsIn(d, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) → ISO. */
export function sqliteToIso(s: string): string {
  return s.includes('T') ? s : s.replace(' ', 'T') + 'Z'
}
