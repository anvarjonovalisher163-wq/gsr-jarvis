import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'path'
import { createLogger } from '../../logger'
import { botManager } from '../bots/botManager'

const log = createLogger('tray')

let tray: Tray | null = null

/** Paketlangan ilovada extraResources (process.resourcesPath), dev'da loyiha papkasi. */
export function assetPath(name: string): string {
  return app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), 'resources', name)
}

export function createTray(openWindow: () => void, requestQuit: () => void): void {
  if (tray) return
  let icon = nativeImage.createFromPath(assetPath('icon.png'))
  if (icon.isEmpty()) {
    log.warn('Tray ikonkasi topilmadi')
    return
  }
  icon = icon.resize({ width: process.platform === 'darwin' ? 18 : 16, height: process.platform === 'darwin' ? 18 : 16 })
  if (process.platform === 'darwin') icon.setTemplateImage(false)

  tray = new Tray(icon)
  tray.setToolTip('TG Manager')

  const show = openWindow

  const rebuild = () => {
    const running = botManager.runningCount()
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Ochish', click: show },
        { type: 'separator' },
        {
          label: running > 0 ? `Botlarni to'xtatish (${running})` : 'Botlar ishlamayapti',
          enabled: running > 0,
          click: () => botManager.stopAll().catch((e) => log.warn('Botlarni to\'xtatishda xato', e))
        },
        { type: 'separator' },
        { label: 'Chiqish', click: requestQuit }
      ])
    )
  }
  rebuild()
  botManager.setOnChangeExtra(rebuild)

  tray.on('click', show)
  tray.on('double-click', show)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
