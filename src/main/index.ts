import { app, shell, dialog, safeStorage, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { handle } from './ipc'
import { openDatabase, closeDatabase, dbPath } from './db'
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

const log = createLogger('app')

// Privileged sxemalar app ready'dan oldin ro'yxatga olinishi shart
registerSchemes()

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
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Tashqi havolalar tizim brauzerida ochiladi
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
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

  // Saqlangan akkauntlarni fonda ulaymiz; oyna kutib turmaydi
  clientManager.connectAll().catch((e) => log.error('Akkauntlarni ulashda xato', e))
  botManager.startAll().catch((e) => log.error('Botlarni ishga tushirishda xato', e))

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
  Promise.allSettled([clientManager.disconnectAll(), botManager.stopAll()]).finally(() => app.quit())
})

app.on('will-quit', () => {
  closeDatabase()
})
