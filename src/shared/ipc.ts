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
import type { Channel, ChannelType, MediaItem, Post, PostStatus, PostTarget, PublicAccount } from './types'
import type { IpcEnvelope } from './errors'
import type { MediaFile } from './media'

/** Post nishoni (kanal) — kanal ma'lumotlari bilan. */
export interface TargetView extends PostTarget {
  channel_title: string
  channel_username: string | null
  channel_type: ChannelType
  account_id: number
  avatarUrl: string | null
}

export interface PostDetail {
  post: Post
  targets: TargetView[]
  media: MediaItem[]
}

export interface PostInput {
  /** Bo'lsa — mavjud post tahrirlanadi (faqat draft/failed/scheduled). */
  id?: number
  title: string
  /** Telegram HTML (b, i, u, s, a, code, pre, spoiler, blockquote). */
  text: string
  media: MediaItem[]
  channelIds: number[]
  /** ISO (UTC). null — rejalashtirilmagan (hozir yuboriladi yoki qoralama). */
  scheduledAt: string | null
}

export interface PostFilter {
  status?: PostStatus
  channelId?: number
  /** ISO oraliq (created_at yoki scheduled_at bo'yicha). */
  from?: string
  to?: string
  limit?: number
}

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

  'posts:list': { req: PostFilter; res: PostDetail[] }
  'posts:get': { req: { id: number }; res: PostDetail }
  /** Saqlaydi (yubormaydi). Rejali bo'lsa status=scheduled emas — yuborilguncha draft. */
  'posts:save': { req: PostInput; res: PostDetail }
  /** Nishonlarni yuboradi yoki (scheduled_at bo'lsa) Telegram'da rejalashtiradi. */
  'posts:send': { req: { id: number }; res: PostDetail }
  /** Faqat failed nishonlarni qayta yuboradi. */
  'posts:retry': { req: { id: number }; res: PostDetail }
  /** Telegram'dagi rejali xabarlarni ham bekor qiladi. */
  'posts:delete': { req: { id: number }; res: void }
  'posts:duplicate': { req: { id: number }; res: PostDetail }

  /** Fayl tanlash dialogi (main'da). Bekor qilinsa bo'sh massiv. */
  'media:pick': { req: void; res: MediaFile[] }
}

export type IpcChannel = keyof IpcChannels
export type IpcReq<C extends IpcChannel> = IpcChannels[C]['req']
export type IpcRes<C extends IpcChannel> = IpcChannels[C]['res']

/** Main → renderer yo'nalishidagi push hodisalar. */
export interface IpcEvents {
  /** Akkauntlar ro'yxati yoki ulanish holati o'zgardi. */
  'accounts:changed': AccountView[]
  /** Post yoki uning nishonlari o'zgardi (yuborish jarayoni, qayta urinish). */
  'posts:changed': PostDetail
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
  posts: {
    list: (filter?: PostFilter) => Promise<PostDetail[]>
    get: (id: number) => Promise<PostDetail>
    save: (input: PostInput) => Promise<PostDetail>
    send: (id: number) => Promise<PostDetail>
    retry: (id: number) => Promise<PostDetail>
    delete: (id: number) => Promise<void>
    duplicate: (id: number) => Promise<PostDetail>
  }
  media: {
    pick: () => Promise<MediaFile[]>
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
