import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcReq, IpcRes, IpcEvent, IpcEventPayload, RendererApi } from '@shared/ipc'

function invoke<C extends IpcChannel>(channel: C, req?: IpcReq<C>): Promise<IpcRes<C>> {
  return ipcRenderer.invoke(channel, req)
}

const api: RendererApi = {
  app: {
    getVersion: () => invoke('app:getVersion')
  },
  on: <E extends IpcEvent>(event: E, cb: (payload: IpcEventPayload<E>) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: IpcEventPayload<E>) => cb(payload)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('platform', process.platform)
