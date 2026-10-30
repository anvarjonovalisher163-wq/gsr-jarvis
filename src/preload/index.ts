import { contextBridge, ipcRenderer } from 'electron'
import type { BridgeApi, IpcChannel, IpcReq, IpcRes, IpcEvent, IpcEventPayload } from '@shared/ipc'
import type { IpcEnvelope } from '@shared/errors'

/**
 * Envelope'ni o'zgartirmasdan qaytaradi. Bridge Error'larning code maydonini
 * yo'qotgani uchun ochish renderer'da (@renderer/lib/api) bajariladi.
 */
function invoke<C extends IpcChannel>(channel: C, req?: IpcReq<C>): Promise<IpcEnvelope<IpcRes<C>>> {
  return ipcRenderer.invoke(channel, req)
}

const api: BridgeApi = {
  app: {
    getVersion: () => invoke('app:getVersion')
  },
  settings: {
    get: (keys) => invoke('settings:get', { keys }),
    set: (values) => invoke('settings:set', { values })
  },
  accounts: {
    list: () => invoke('accounts:list'),
    sendCode: (phone) => invoke('accounts:sendCode', { phone }),
    signIn: (code) => invoke('accounts:signIn', { code }),
    check2FA: (password) => invoke('accounts:check2FA', { password }),
    cancelLogin: () => invoke('accounts:cancelLogin'),
    logout: (id) => invoke('accounts:logout', { id }),
    remove: (id) => invoke('accounts:remove', { id })
  },
  channels: {
    sync: (accountId) => invoke('channels:sync', { accountId }),
    list: (accountId) => invoke('channels:list', { accountId })
  },
  on: <E extends IpcEvent>(event: E, cb: (payload: IpcEventPayload<E>) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: IpcEventPayload<E>) => cb(payload)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('platform', process.platform)
