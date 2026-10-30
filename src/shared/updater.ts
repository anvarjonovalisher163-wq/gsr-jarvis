/** Avto-yangilanish holati (electron-updater). */
export type UpdaterState =
  /** Dev rejim yoki paketlanmagan — yangilanish ishlamaydi. */
  | 'disabled'
  | 'idle'
  | 'checking'
  /** Yangi versiya bor, yuklab olish boshlanmagan (foydalanuvchi tasdiqlaydi). */
  | 'available'
  | 'downloading'
  /** Yuklab olindi — o'rnatish va qayta ishga tushirish mumkin. */
  | 'downloaded'
  | 'up-to-date'
  | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  currentVersion: string
  /** Yangi versiya (available/downloading/downloaded). */
  version: string | null
  /** 0–100 (downloading). */
  percent: number | null
  releaseNotes: string | null
  error: string | null
  lastCheckedAt: string | null
}
