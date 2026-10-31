import { handle } from '../../ipc'
import { apiServer } from './server'

export function registerApiServerIpc(): void {
  handle('apiServer:status', () => apiServer.status())
  handle('apiServer:configure', (_e, patch) => apiServer.configure(patch))
  handle('apiServer:regenerateKey', () => apiServer.regenerateKey())
}
