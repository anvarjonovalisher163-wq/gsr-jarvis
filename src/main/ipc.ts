import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { IpcChannel, IpcReq, IpcRes } from '@shared/ipc'
import type { IpcEnvelope } from '@shared/errors'
import { isAppError } from './errors'
import { createLogger } from './logger'

const log = createLogger('ipc')

/**
 * Typed ipcMain.handle o'rami. Kanal nomi va tiplar @shared/ipc dan olinadi.
 *
 * Handler natijasi envelope'ga o'raladi: { ok: true, data } yoki { ok: false, error }.
 * AppError bo'lsa uning code/message'i, boshqa xato bo'lsa umumiy 'INTERNAL' ketadi
 * (ichki xato matni foydalanuvchiga ko'rsatilmaydi, faqat logga yoziladi).
 */
export function handle<C extends IpcChannel>(
  channel: C,
  handler: (event: IpcMainInvokeEvent, req: IpcReq<C>) => Promise<IpcRes<C>> | IpcRes<C>
): void {
  ipcMain.handle(channel, async (event, req): Promise<IpcEnvelope<IpcRes<C>>> => {
    try {
      const data = await handler(event, req as IpcReq<C>)
      return { ok: true, data }
    } catch (e) {
      if (isAppError(e)) {
        log.warn(`${channel}: ${e.code} — ${e.message}`)
        return { ok: false, error: e.toShape() }
      }
      log.error(`${channel}: kutilmagan xato`, e)
      return {
        ok: false,
        error: { code: 'INTERNAL', message: "Ichki xato yuz berdi. Loglarni tekshiring." }
      }
    }
  })
}
