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

const log = createLogger('app')

// Privileged sxemalar app ready'dan oldin ro'yxatga olinishi shart
registerSchemes()

// Ushlanmagan xatolar jimgina yo'qolmasin — logga yoziladi, ilova yiqilmaydi
process.on('unhandledRejection', (reason) => log.error('Ushlanmagan promise xatosi', reason))
process.on('uncaughtException', (err) => log.error('Ushlanmagan istisno', err))

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Tashqi havolalar tizim brauzerida ochiladi — faqat xavfsiz sxemalar
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:|tg:)/i.test(url)) shell.openExternal(url).catch((e) => log.warn('openExternal', e))
    else log.warn(`Ruxsat etilmagan havola bloklandi: ${url.slice(0, 80)}`)
    return { action: 'deny' }
  })

  // Renderer ichida boshqa sahifaga o'tish (drag-drop fayl, havola) bloklanadi
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    e.preventDefault()
    log.warn(`Navigatsiya bloklandi: ${url.slice(0, 80)}`)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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
  createWindow()
  startPeriodicCheck()
  initUpdater()

  // Saqlangan akkauntlarni fonda ulaymiz; oyna kutib turmaydi
  clientManager.connectAll().catch((e) => log.error('Akkauntlarni ulashda xato', e))
  botManager
    .startAll()
    .catch((e) => log.error('Botlarni ishga tushirishda xato', e))
    // Botlar ulangach yarim qolgan rassilkalar davom etadi, rejalilar kuzatiladi
    .finally(() => broadcastRunner.init())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  // Avval Telegram ulanishlarini toza yopamiz, keyin chiqamiz
  e.preventDefault()
  quitting = true
  broadcastRunner.stop()
  Promise.allSettled([clientManager.disconnectAll(), botManager.stopAll()]).finally(() => app.quit())
})

app.on('will-quit', () => {
  closeDatabase()
})
