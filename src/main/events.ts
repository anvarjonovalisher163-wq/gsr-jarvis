import { BrowserWindow } from 'electron'
import type { IpcEvent, IpcEventPayload } from '@shared/ipc'

/** Main → barcha renderer oynalariga typed hodisa yuboradi. */
export function broadcast<E extends IpcEvent>(event: E, payload: IpcEventPayload<E>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(event, payload)
  }
}
