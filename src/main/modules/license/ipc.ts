import { handle } from '../../ipc'
import { activate, checkNow, deactivate, getStatus, startTrial } from './service'

export function registerLicenseIpc(): void {
  handle('license:status', () => getStatus())
  handle('license:startTrial', (_e, { email }) => startTrial(email))
  handle('license:activate', (_e, { key }) => activate(key))
  handle('license:check', () => checkNow())
  handle('license:deactivate', () => deactivate())
}
