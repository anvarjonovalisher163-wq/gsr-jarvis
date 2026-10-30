import { app } from 'electron'
import type { AppSettings } from '@shared/network'
import { handle } from '../../ipc'
import { settingsRepo, SettingKeys } from '../../db/repositories'
import { createLogger } from '../../logger'
import { clientManager } from '../accounts/clientManager'
import { botManager } from '../bots/botManager'
import { applyProxy, getProxy, saveProxy } from '../network/proxy'

const log = createLogger('settings')

export function getAppSettings(): AppSettings {
  return {
    autoStart: settingsRepo.get(SettingKeys.autoStart) === '1',
    closeToTray: settingsRepo.get(SettingKeys.closeToTray) !== '0', // default: yoqilgan
    language: (settingsRepo.get(SettingKeys.language) as AppSettings['language']) || 'uz',
    proxy: getProxy()
  }
}

export function applyAutoStart(): void {
  const on = settingsRepo.get(SettingKeys.autoStart) === '1'
  if (process.platform === 'linux') return // Linux'da .desktop autostart alohida; hozircha yo'q
  app.setLoginItemSettings({ openAtLogin: on, openAsHidden: true, args: ['--hidden'] })
}

export function registerAppSettingsIpc(): void {
  handle('app:getSettings', () => getAppSettings())

  handle('app:setSettings', async (_e, patch) => {
    if (patch.autoStart !== undefined) {
      settingsRepo.set(SettingKeys.autoStart, patch.autoStart ? '1' : '0')
      applyAutoStart()
    }
    if (patch.closeToTray !== undefined) settingsRepo.set(SettingKeys.closeToTray, patch.closeToTray ? '1' : '0')
    if (patch.language !== undefined) settingsRepo.set(SettingKeys.language, patch.language)

    if (patch.proxy !== undefined) {
      const before = JSON.stringify(getProxy())
      saveProxy(patch.proxy)
      if (JSON.stringify(getProxy()) !== before) {
        await applyProxy()
        // Telegram ulanishlari yangi proksi bilan qayta quriladi
        log.info('Proksi o\'zgardi — akkauntlar va botlar qayta ulanmoqda')
        await clientManager.disconnectAll()
        clientManager.connectAll().catch((e) => log.error('Qayta ulashda xato', e))
        const wasRunning = botManager.runningIds()
        await botManager.stopAll()
        for (const id of wasRunning) botManager.start(id).catch((e) => log.warn(`Bot ${id} qayta ishga tushmadi`, e))
      }
    }
    return getAppSettings()
  })
}
