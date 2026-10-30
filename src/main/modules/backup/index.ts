import { app, BrowserWindow, dialog } from 'electron'
import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, readdirSync, rmSync, renameSync, copyFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { closeDatabase, DB_FILENAME, dbPath, getDb } from '../../db'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'

const log = createLogger('backup')

/**
 * Zaxira nusxa: tg-manager.db (SQLite backup API orqali izchil nusxa) + avatars/ → .zip.
 * Import: zip tekshiriladi, baza yopiladi, fayllar almashtiriladi, ilova qayta ishga tushadi.
 * Sessiya/tokenlar shifrlangan holda ko'chadi — boshqa kompyuterda ochilmaydi (safeStorage kaliti boshqa).
 */
export async function exportBackup(win: BrowserWindow | null): Promise<{ path: string | null }> {
  const opts: Electron.SaveDialogOptions = {
    title: 'Zaxira nusxa saqlash',
    defaultPath: `tg-manager-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  }
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (res.canceled || !res.filePath) return { path: null }

  const tmp = join(app.getPath('temp'), `tgm-backup-${Date.now()}.db`)
  await getDb().backup(tmp)
  const zip = new AdmZip()
  zip.addLocalFile(tmp, '', DB_FILENAME)
  const avatars = join(app.getPath('userData'), 'avatars')
  if (existsSync(avatars)) zip.addLocalFolder(avatars, 'avatars')
  zip.addFile('meta.json', Buffer.from(JSON.stringify({ app: 'tg-manager', version: app.getVersion(), created_at: new Date().toISOString() })))
  zip.writeZip(res.filePath)
  unlinkSync(tmp)
  log.info(`Zaxira nusxa saqlandi: ${res.filePath}`)
  return { path: res.filePath }
}

export async function importBackup(win: BrowserWindow | null): Promise<{ restarted: boolean }> {
  const opts: Electron.OpenDialogOptions = {
    title: 'Zaxira nusxani tiklash',
    properties: ['openFile'],
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (res.canceled || !res.filePaths[0]) return { restarted: false }

  const zip = new AdmZip(res.filePaths[0])
  if (!zip.getEntry(DB_FILENAME)) throw new AppError('BACKUP_INVALID', `Zip ichida ${DB_FILENAME} topilmadi — bu TG Manager zaxira nusxasi emas.`)

  const confirm = await dialog.showMessageBox(win!, {
    type: 'warning',
    buttons: ['Tiklash va qayta ishga tushirish', 'Bekor'],
    cancelId: 1,
    defaultId: 1,
    title: 'Zaxirani tiklash',
    message: "Hozirgi barcha ma'lumotlar zaxira nusxadagi bilan almashtiriladi.",
    detail: "Akkauntlar, botlar, postlar, obunachilar — hammasi. Davom etilsinmi?"
  })
  if (confirm.response !== 0) return { restarted: false }

  const userData = app.getPath('userData')
  const stage = join(userData, 'restore-tmp')
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  zip.extractAllTo(stage, true)

  // Bazani yopib, fayllarni almashtiramiz
  closeDatabase()
  const db = dbPath()
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(db + suffix)) renameSync(db + suffix, db + suffix + '.bak')
  }
  copyFileSync(join(stage, DB_FILENAME), db)
  const avatarsSrc = join(stage, 'avatars')
  const avatarsDst = join(userData, 'avatars')
  if (existsSync(avatarsSrc)) {
    rmSync(avatarsDst, { recursive: true, force: true })
    mkdirSync(avatarsDst, { recursive: true })
    for (const f of readdirSync(avatarsSrc)) copyFileSync(join(avatarsSrc, f), join(avatarsDst, f))
  }
  rmSync(stage, { recursive: true, force: true })
  log.info(`Zaxira tiklandi: ${res.filePaths[0]} — ilova qayta ishga tushmoqda`)

  app.relaunch()
  setTimeout(() => app.exit(0), 300)
  return { restarted: true }
}
