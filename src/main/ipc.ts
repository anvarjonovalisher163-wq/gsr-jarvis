import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { IpcChannel, IpcReq, IpcRes } from '@shared/ipc'
import type { IpcEnvelope } from '@shared/errors'
import { isAppError } from './errors'
import { createLogger } from './logger'
import { ipcSchemas } from './ipc-schemas'

const log = createLogger('ipc')

/**
 * So'rov bizning oynamizning asosiy frame'idan kelganmi?
 * Prod'da renderer file:// dan, dev'da ELECTRON_RENDERER_URL dan yuklanadi.
 * Boshqa manba (iframe, ochilgan tashqi sahifa) — rad etiladi.
 */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  if (!BrowserWindow.fromWebContents(event.sender)) return false
  const frame = event.senderFrame
  if (!frame || frame !== event.sender.mainFrame) return false
  const url = frame.url
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  return url.startsWith('file://') || (!!devUrl && url.startsWith(devUrl))
}

/**
 * Typed ipcMain.handle o'rami. Kanal nomi va tiplar @shared/ipc dan olinadi.
 *
 * Tartib: yuboruvchi tekshiruvi → zod validatsiya (ipc-schemas.ts) → handler.
 * Natija envelope'ga o'raladi: { ok: true, data } yoki { ok: false, error }.
 * AppError bo'lsa uning code/message'i, boshqa xato bo'lsa umumiy 'INTERNAL' ketadi
 * (ichki xato matni foydalanuvchiga ko'rsatilmaydi, faqat logga yoziladi).
 */
export function handle<C extends IpcChannel>(
  channel: C,
  handler: (event: IpcMainInvokeEvent, req: IpcReq<C>) => Promise<IpcRes<C>> | IpcRes<C>
): void {
  const schema = ipcSchemas[channel]
  ipcMain.handle(channel, async (event, raw): Promise<IpcEnvelope<IpcRes<C>>> => {
    if (!isTrustedSender(event)) {
      log.warn(`${channel}: ishonchsiz manbadan so'rov rad etildi (${event.senderFrame?.url ?? '?'})`)
      return { ok: false, error: { code: 'FORBIDDEN', message: 'Ruxsat yo\'q.' } }
    }

    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      log.warn(`${channel}: so'rov sxemaga mos emas`, parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`))
      return { ok: false, error: { code: 'BAD_REQUEST', message: "So'rov ma'lumotlari noto'g'ri." } }
    }

    try {
      const data = await handler(event, parsed.data as IpcReq<C>)
      return { ok: true, data }
    } catch (e) {
      if (isAppError(e)) {
        log.warn(`${channel}: ${e.code} — ${e.message}`)
        return { ok: false, error: e.toShape() }
      }
      log.error(`${channel}: kutilmagan xato`, e)
      return {
        ok: false,
        error: { code: 'INTERNAL', message: 'Ichki xato yuz berdi. Loglarni tekshiring.' }
      }
    }
  })
}
