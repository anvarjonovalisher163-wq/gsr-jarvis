import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdaterStatus } from '@shared/updater'
import { AppError } from '../../errors'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'

const log = createLogger('updater')

/** Ishga tushgach necha soniyadan keyin birinchi tekshiruv. */
const FIRST_CHECK_DELAY_MS = 15_000
/** Keyingi avtomatik tekshiruvlar. */
const CHECK_INTERVAL_MS = 6 * 3_600_000

let status: UpdaterStatus = {
  state: app.isPackaged ? 'idle' : 'disabled',
  currentVersion: app.getVersion(),
  version: null,
  percent: null,
  releaseNotes: null,
  error: null,
  lastCheckedAt: null
}

function set(patch: Partial<UpdaterStatus>): void {
  status = { ...status, ...patch }
  broadcast('updater:changed', status)
}

export function getUpdaterStatus(): UpdaterStatus {
  return status
}

function notesToText(notes: unknown): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes.replace(/<[^>]+>/g, '').trim() || null
  if (Array.isArray(notes)) return notes.map((n) => (typeof n === 'object' && n && 'note' in n ? String((n as { note: unknown }).note) : '')).join('\n').trim() || null
  return null
}

/**
 * GitHub Releases orqali avto-yangilanish. Faqat paketlangan ilovada.
 * Yuklab olish avtomatik emas — foydalanuvchi "Yuklab olish" bosadi (trafik va kutilmagan qayta ishga tushish bo'lmasin).
 */
export function initUpdater(): void {
  if (!app.isPackaged) {
    log.info('Dev rejim: avto-yangilanish o\'chiq')
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (m: unknown) => log.debug(String(m)),
    warn: (m: unknown) => log.warn(String(m)),
    error: (m: unknown) => log.error(String(m)),
    debug: (m: unknown) => log.debug(String(m))
  }

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: null }))
  autoUpdater.on('update-available', (info) => {
    log.info(`Yangi versiya bor: ${info.version}`)
    set({ state: 'available', version: info.version, releaseNotes: notesToText(info.releaseNotes), lastCheckedAt: new Date().toISOString() })
  })
  autoUpdater.on('update-not-available', () => set({ state: 'up-to-date', version: null, lastCheckedAt: new Date().toISOString() }))
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => {
    log.info(`Yangilanish yuklab olindi: ${info.version}`)
    set({ state: 'downloaded', version: info.version, percent: 100 })
  })
  autoUpdater.on('error', (e) => {
    log.warn('Yangilanish xatosi', e)
    set({ state: 'error', error: e.message })
  })

  setTimeout(() => checkForUpdates().catch(() => {}), FIRST_CHECK_DELAY_MS)
  setInterval(() => checkForUpdates().catch(() => {}), CHECK_INTERVAL_MS)
}

export async function checkForUpdates(): Promise<UpdaterStatus> {
  if (!app.isPackaged) throw new AppError('UPDATER_DISABLED', "Dev rejimda yangilanish tekshirilmaydi.")
  if (status.state === 'downloading') return status
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set({ state: 'error', error: e instanceof Error ? e.message : String(e) })
  }
  return status
}

export async function downloadUpdate(): Promise<UpdaterStatus> {
  if (status.state !== 'available') throw new AppError('UPDATER_NOT_AVAILABLE', 'Yuklab olinadigan yangilanish yo\'q.')
  set({ state: 'downloading', percent: 0 })
  autoUpdater.downloadUpdate().catch((e) => set({ state: 'error', error: e instanceof Error ? e.message : String(e) }))
  return status
}

export function installUpdate(): void {
  if (status.state !== 'downloaded') throw new AppError('UPDATER_NOT_READY', 'Yangilanish hali yuklab olinmagan.')
  log.info('Yangilanish o\'rnatilmoqda, ilova qayta ishga tushadi')
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
}
