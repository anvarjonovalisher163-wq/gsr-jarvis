import { handle } from '../../ipc'
import { checkForUpdates, downloadUpdate, getUpdaterStatus, installUpdate } from './index'

export function registerUpdaterIpc(): void {
  handle('updater:status', () => getUpdaterStatus())
  handle('updater:check', () => checkForUpdates())
  handle('updater:download', () => downloadUpdate())
  handle('updater:install', () => installUpdate())
}
