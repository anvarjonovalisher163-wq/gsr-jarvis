import { getDb } from '../index'

/**
 * Kalit-qiymat sozlamalar. Ma'lum kalitlar shu yerda ro'yxatga olinadi, shunda
 * butun loyihada bitta nomdan foydalaniladi.
 */
export const SettingKeys = {
  apiId: 'telegram.api_id',
  apiHash: 'telegram.api_hash',
  timezone: 'app.timezone',
  language: 'app.language',
  theme: 'app.theme',
  proxy: 'network.proxy',
  autoStart: 'app.auto_start',
  closeToTray: 'app.close_to_tray',
  broadcastFooter: 'broadcast.footer_enabled'
} as const

export type SettingKey = (typeof SettingKeys)[keyof typeof SettingKeys]

export const settingsRepo = {
  get(key: SettingKey | string): string | undefined {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value
  },

  getOr(key: SettingKey | string, fallback: string): string {
    return this.get(key) ?? fallback
  },

  getJson<T>(key: SettingKey | string, fallback: T): T {
    const raw = this.get(key)
    if (raw === undefined) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },

  set(key: SettingKey | string, value: string): void {
    getDb()
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  },

  setJson(key: SettingKey | string, value: unknown): void {
    this.set(key, JSON.stringify(value))
  },

  remove(key: SettingKey | string): void {
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(key)
  },

  all(): Record<string, string> {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }
}
