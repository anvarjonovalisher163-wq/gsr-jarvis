import { handle } from '../../ipc'
import { settingsRepo, SettingKeys } from '../../db/repositories'
import { AppError } from '../../errors'

/** Renderer o'qishi/yozishi mumkin bo'lgan kalitlar. Boshqalari rad etiladi. */
const ALLOWED = new Set<string>(Object.values(SettingKeys))

function assertAllowed(keys: string[]): void {
  const bad = keys.filter((k) => !ALLOWED.has(k))
  if (bad.length) throw new AppError('SETTING_KEY_INVALID', `Ruxsat etilmagan sozlama: ${bad.join(', ')}`)
}

export function registerSettingsIpc(): void {
  handle('settings:get', (_e, { keys }) => {
    assertAllowed(keys)
    const out: Record<string, string> = {}
    for (const k of keys) {
      const v = settingsRepo.get(k)
      if (v !== undefined) out[k] = v
    }
    return out
  })

  handle('settings:set', (_e, { values }) => {
    const keys = Object.keys(values)
    assertAllowed(keys)
    for (const k of keys) {
      const v = String(values[k] ?? '').trim()
      if (v === '') settingsRepo.remove(k)
      else settingsRepo.set(k, v)
    }
  })
}
