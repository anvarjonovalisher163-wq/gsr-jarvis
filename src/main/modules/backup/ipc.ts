import { BrowserWindow } from 'electron'
import { handle } from '../../ipc'
import { exportBackup, importBackup } from './index'

export function registerBackupIpc(): void {
  handle('backup:export', (e) => exportBackup(BrowserWindow.fromWebContents(e.sender)))
  handle('backup:import', (e) => importBackup(BrowserWindow.fromWebContents(e.sender)))
}
