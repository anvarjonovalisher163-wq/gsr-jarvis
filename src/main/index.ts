import { app, shell, dialog, safeStorage, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { handle } from './ipc'
import { openDatabase, closeDatabase, dbPath } from './db'
import { logsRepo } from './db/repositories'
import { attachLoggerToDb, createLogger } from './logger'
import { isEncryptionAvailable } from './security/crypto'
import { registerSettingsIpc } from './modules/settings/ipc'
import { registerAccountsIpc } from './modules/accounts/ipc'
import { registerChannelsIpc } from './modules/channels/ipc'
import { clientManager } from './modules/accounts/clientManager'
import { registerProtocolHandlers, registerSchemes } from './protocols'
import { registerPostingIpc } from './modules/posting/ipc'
import { registerBotsIpc } from './modules/bots/ipc'
import { botManager } from './modules/bots/botManager'
import { broadcastRunner } from './modules/bots/broadcast'
import { registerLicenseIpc } from './modules/license/ipc'
import { startPeriodicCheck } from './modules/license/service'
import { registerUpdaterIpc } from './modules/updater/ipc'
import { initUpdater } from './modules/updater'
import { registerTasksIpc } from './modules/tasks/ipc'
import { registerLogsIpc } from './modules/logs/ipc'
import { registerBackupIpc } from './modules/backup/ipc'
import { applyAutoStart, getAppSettings, registerAppSettingsIpc } from './modules/appSettings/ipc'
import { applyProxy } from './modules/network/proxy'
import { createTray, destroyTray } from './modules/tray'
import { registerChatsIpc } from './modules/chats/ipc'
import { initChatEvents } from './modules/chats/service'
import { registerContactsIpc } from './modules/contacts/ipc'
import { registerStatsIpc } from './modules/stats/ipc'

const log = createLogger('app')

// Privileged sxemalar app ready'dan oldin ro'yxatga olinishi shart
registerSchemes()

// Ushlanmagan xatolar jimgina yo'qolmasin — logga yoziladi, ilova yiqilmaydi
process.on('unhandledRejection', (reason) => log.error('Ushlanmagan promise xatosi', reason))
process.on('uncaughtException', (err) => log.error('Ushlanmagan istisno', err))

let mainWindow: BrowserWindow | null = null
let quitting = false

/** Tray/dock'dan: oyna bo'lsa ko'rsatadi, yo'q bo'lsa yangisini yaratadi. */
function openWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    title: 'TG Manager',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 16 } }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const win = mainWindow
  win.on('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) win.show()
  })

  // Tray'ga yopish: rejali postlar/rassilkalar va botlar fonda ishlashda davom etadi
  win.on('close', (e) => {
    if (quitting || !getAppSettings().closeToTray) return
    e.preventDefault()
    win.hide()
    log.info("Oyna tray'ga yashirildi (fon ishlar davom etadi)")
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  // Tashqi havolalar tizim brauzerida ochiladi — faqat xavfsiz sxemalar
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:|tg:)/i.test(url)) shell.openExternal(url).catch((e) => log.warn('openExternal', e))
    else log.warn(`Ruxsat etilmagan havola bloklandi: ${url.slice(0, 80)}`)
    return { action: 'deny' }
  })

  // Renderer ichida boshqa sahifaga o'tish (drag-drop fayl, havola) bloklanadi
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    e.preventDefault()
    log.warn(`Navigatsiya bloklandi: ${url.slice(0, 80)}`)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  handle('app:getVersion', () => app.getVersion())
  registerSettingsIpc()
  registerAccountsIpc()
  registerChannelsIpc()
  registerPostingIpc()
  registerBotsIpc()
  registerLicenseIpc()
  registerUpdaterIpc()
  registerTasksIpc()
  registerLogsIpc()
  registerBackupIpc()
  registerAppSettingsIpc()
  registerChatsIpc()
  registerContactsIpc()
  registerStatsIpc()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('uz.gsr.tgmanager')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    const { version } = openDatabase()
    attachLoggerToDb()
    console.log(`DB ready, version ${version}`)
    log.info(`DB ready, version ${version}`, { path: dbPath() })
    const pruned = logsRepo.prune(30)
    if (pruned > 0) log.info(`${pruned} ta eski log yozuvi tozalandi`)
  } catch (e) {
    log.error("Ma'lumotlar bazasini ochib bo'lmadi", e)
    dialog.showErrorBox(
      'TG Manager',
      "Ma'lumotlar bazasini ochib bo'lmadi. Ilova yopiladi.\n\n" + (e instanceof Error ? e.message : String(e))
    )
    app.quit()
    return
  }

  // Faqat Linux dev/test uchun: keyring bo'lmagan muhitda (CI, konteyner) oddiy shifrlashga ruxsat.
  // macOS/Windows'da Keychain/DPAPI doim bor, bu tarmoq hech qachon ishlamaydi.
  if (process.platform === 'linux' && process.env.TGM_ALLOW_PLAINTEXT_STORAGE === '1') {
    safeStorage.setUsePlainTextEncryption(true)
    log.warn('TGM_ALLOW_PLAINTEXT_STORAGE=1: sessiyalar kuchsiz shifrlanadi (faqat dev/test!)')
  }

  if (!isEncryptionAvailable()) {
    const backend = process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'n/a'
    log.warn(`safeStorage shifrlash mavjud emas (backend: ${backend}) — akkaunt qo'shishda xato beriladi`)
  }

  registerProtocolHandlers()
  registerIpc()
  initChatEvents()
  // Proksi Telegram ulanishlaridan OLDIN qo'llanadi
  applyProxy().catch((e) => log.warn('Proksi qo\'llanmadi', e))
  applyAutoStart()
  createWindow()
  createTray(openWindow, () => app.quit())
  startPeriodicCheck()
  initUpdater()

  // Saqlangan akkauntlarni fonda ulaymiz; oyna kutib turmaydi
  clientManager.connectAll().catch((e) => log.error('Akkauntlarni ulashda xato', e))
  botManager
    .startAll()
    .catch((e) => log.error('Botlarni ishga tushirishda xato', e))
    // Botlar ulangach yarim qolgan rassilkalar davom etadi, rejalilar kuzatiladi
    .finally(() => broadcastRunner.init())

  app.on('activate', () => openWindow())
})

app.on('window-all-closed', () => {
  // Tray'ga yopish yoqilgan bo'lsa ilova fonda qoladi (tray → Ochish yangi oyna yaratadi)
  if (process.platform === 'darwin') return
  if (getAppSettings().closeToTray) {
    log.info("Oyna yopildi — ilova tray'da ishlashda davom etadi")
    return
  }
  app.quit()
})

app.on('before-quit', (e) => {
  // Ikkinchi marta (tozalashdan keyingi app.exit) — hech narsa qilmaymiz
  if (quitting) return
  log.info('before-quit: tozalash boshlandi')
  e.preventDefault()
  quitting = true
  broadcastRunner.stop()
  destroyTray()
  // Avval Telegram ulanishlari va botlar toza yopiladi, keyin chiqamiz
  Promise.allSettled([clientManager.disconnectAll(), botManager.stopAll()]).finally(() => app.exit(0))
})

app.on('will-quit', () => {
  closeDatabase()
})
