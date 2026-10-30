/**
 * Typed IPC kontrakt.
 *
 * Har bir kanal uchun so'rov (req) va javob (res) tiplari shu yerda e'lon qilinadi.
 * Main va preload shu tiplardan foydalanadi, shuning uchun kanal nomi yoki
 * tiplarda xatolik bo'lsa TypeScript kompilyatsiya paytida ushlaydi.
 *
 * Yangi kanal qo'shish: IpcChannels ga yozuv qo'shing, keyin main'da handle qiling
 * va preload'da api ga chiqaring.
 *
 * Xatolar: main'dagi handler AppError tashlasa, renderer'da IpcError (code, message,
 * retryAfter) sifatida reject bo'ladi. Qarang: @shared/errors.
 */
import type { Channel, PublicAccount } from './types'
import type { IpcEnvelope } from './errors'

/** Renderer ko'radigan akkaunt: sessiyasiz, ulanish holati va avatar bilan. */
export interface AccountView extends PublicAccount {
  connected: boolean
  avatarUrl: string | null
}

/** Renderer ko'radigan kanal: avatar URL bilan. */
export interface ChannelView extends Channel {
  avatarUrl: string | null
}

export interface ChannelSyncResult {
  channels: ChannelView[]
  /** Sinxronlashda topilgan jami kanal/guruhlar (admin bo'lmaganlar ham). */
  scanned: number
}

export type SignInResult =
  | { status: 'done'; account: AccountView }
  | { status: 'password'; hint: string }

export interface IpcChannels {
  'app:getVersion': { req: void; res: string }

  'settings:get': { req: { keys: string[] }; res: Record<string, string> }
  'settings:set': { req: { values: Record<string, string> }; res: void }

  'accounts:list': { req: void; res: AccountView[] }
  /** Telefon raqamga kod yuboradi. viaApp=true bo'lsa kod Telegram ilovasiga kelgan. */
  'accounts:sendCode': { req: { phone: string }; res: { viaApp: boolean } }
  'accounts:signIn': { req: { code: string }; res: SignInResult }
  'accounts:check2FA': { req: { password: string }; res: { account: AccountView } }
  'accounts:cancelLogin': { req: void; res: void }
  /** Telegram'dan chiqadi, sessiya o'chiriladi, akkaunt ro'yxatda qoladi (logged_out). */
  'accounts:logout': { req: { id: number }; res: void }
  /** Akkauntni bazadan butunlay o'chiradi (kanallari, teglari bilan). */
  'accounts:remove': { req: { id: number }; res: void }

  /** Akkaunt dialoglaridan post yozish huquqi bor kanal/supergruppalarni yig'adi. */
  'channels:sync': { req: { accountId: number }; res: ChannelSyncResult }
  'channels:list': { req: { accountId?: number }; res: ChannelView[] }
}

export type IpcChannel = keyof IpcChannels
export type IpcReq<C extends IpcChannel> = IpcChannels[C]['req']
export type IpcRes<C extends IpcChannel> = IpcChannels[C]['res']

/** Main → renderer yo'nalishidagi push hodisalar. */
export interface IpcEvents {
  /** Akkauntlar ro'yxati yoki ulanish holati o'zgardi. */
  'accounts:changed': AccountView[]
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
  settings: {
    get: (keys: string[]) => Promise<Record<string, string>>
    set: (values: Record<string, string>) => Promise<void>
  }
  accounts: {
    list: () => Promise<AccountView[]>
    sendCode: (phone: string) => Promise<{ viaApp: boolean }>
    signIn: (code: string) => Promise<SignInResult>
    check2FA: (password: string) => Promise<{ account: AccountView }>
    cancelLogin: () => Promise<void>
    logout: (id: number) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  channels: {
    sync: (accountId: number) => Promise<ChannelSyncResult>
    list: (accountId?: number) => Promise<ChannelView[]>
  }
  on: <E extends IpcEvent>(event: E, cb: (payload: IpcEventPayload<E>) => void) => () => void
}

/**
 * contextBridge orqali o'tadigan HAQIQIY shakl (window.api).
 *
 * Bridge Error obyektlarini faqat message bilan ko'chiradi — code/retryAfter yo'qoladi.
 * Shuning uchun preload xato tashlamaydi, envelope qaytaradi; renderer'dagi
 * @renderer/lib/api uni ochib IpcError tashlaydi. Komponentlar window.api ga emas,
 * o'sha api ga murojaat qiladi.
 */
type Enveloped<F> = F extends (...args: infer A) => Promise<infer R>
  ? (...args: A) => Promise<IpcEnvelope<R>>
  : F

export type BridgeApi = {
  [NS in keyof RendererApi]: NS extends 'on'
    ? RendererApi['on']
    : { [M in keyof RendererApi[NS]]: Enveloped<RendererApi[NS][M]> }
}
