import { app, shell, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { handle } from './ipc'
import { openDatabase, closeDatabase, dbPath } from './db'
import { attachLoggerToDb, createLogger } from './logger'
import { isEncryptionAvailable } from './security/crypto'

const log = createLogger('app')

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

  if (!isEncryptionAvailable()) {
    log.warn('safeStorage shifrlash mavjud emas — akkaunt qo\'shishda xato beriladi')
  }

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  closeDatabase()
})
