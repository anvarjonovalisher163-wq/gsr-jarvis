import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { IpcChannel, IpcReq, IpcRes } from '@shared/ipc'

/**
 * Typed ipcMain.handle o'rami. Kanal nomi va tiplar @shared/ipc dan olinadi.
 */
export function handle<C extends IpcChannel>(
  channel: C,
  handler: (event: IpcMainInvokeEvent, req: IpcReq<C>) => Promise<IpcRes<C>> | IpcRes<C>
): void {
  ipcMain.handle(channel, (event, req) => handler(event, req as IpcReq<C>))
}
