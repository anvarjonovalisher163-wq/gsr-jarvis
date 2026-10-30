/**
 * Typed IPC kontrakt.
 *
 * Har bir kanal uchun so'rov (req) va javob (res) tiplari shu yerda e'lon qilinadi.
 * Main va preload shu tiplardan foydalanadi, shuning uchun kanal nomi yoki
 * tiplarda xatolik bo'lsa TypeScript kompilyatsiya paytida ushlaydi.
 *
 * Yangi kanal qo'shish: IpcChannels ga yozuv qo'shing, keyin main'da handle qiling
 * va preload'da api ga chiqaring.
 */

export interface IpcChannels {
  'app:getVersion': { req: void; res: string }
}

export type IpcChannel = keyof IpcChannels
export type IpcReq<C extends IpcChannel> = IpcChannels[C]['req']
export type IpcRes<C extends IpcChannel> = IpcChannels[C]['res']

/** Main → renderer yo'nalishidagi push hodisalar (keyingi qadamlarda to'ldiriladi). */
export interface IpcEvents {
  'app:ping': { at: number }
}

export type IpcEvent = keyof IpcEvents
export type IpcEventPayload<E extends IpcEvent> = IpcEvents[E]

/**
 * Renderer'ga contextBridge orqali ochiladigan API shakli.
 * window.api shu interfeysga mos bo'ladi.
 */
export interface RendererApi {
  app: {
    getVersion: () => Promise<string>
  }
  on: <E extends IpcEvent>(event: E, cb: (payload: IpcEventPayload<E>) => void) => () => void
}
