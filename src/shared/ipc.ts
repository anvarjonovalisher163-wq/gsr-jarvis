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
import type {
  BotRule,
  BotRuleTrigger,
  BotSubscriber,
  Broadcast,
  BroadcastDelivery,
  Channel,
  ChannelType,
  MediaItem,
  Post,
  PostStatus,
  PostTarget,
  PublicAccount,
  PublicBot,
  UrlButton
} from './types'

/** Renderer ko'radigan bot: tokensiz, ishlash holati va obunachilar soni bilan. */
export interface BotView extends PublicBot {
  running: boolean
  subscribers: number
  /** Oxirgi ishga tushirish/polling xatosi (to'xtagan bo'lsa). */
  lastError: string | null
}

export interface BotRuleInput {
  id?: number
  bot_id: number
  trigger_type: BotRuleTrigger
  /** command: "narx" (slashsiz), keyword: "narx", any: null */
  trigger_value: string | null
  /** Telegram HTML */
  reply_text: string
  reply_media: MediaItem | null
  /** Qatorlar → tugmalar (URL). */
  reply_buttons: UrlButton[][]
  is_active: boolean
}

export interface SubscriberQuery {
  botId: number
  search?: string
  tag?: string
  activeOnly?: boolean
}

export interface BroadcastView extends Broadcast {
  bot_username: string
  /** 403 — foydalanuvchi botni bloklagan (obunadan chiqarildi). */
  blocked: number
}

export interface BroadcastInput {
  bot_id: number
  /** Telegram HTML */
  text: string
  media: MediaItem | null
  buttons: UrlButton[][]
  /** null — barcha faol obunachilar */
  tag_filter: string | null
  /** ISO (UTC). null — hozir boshlanadi. */
  scheduledAt: string | null
}

export interface BroadcastReport {
  broadcast: BroadcastView
  problems: BroadcastDelivery[]
}
import type { IpcEnvelope } from './errors'
import type { MediaFile } from './media'
import type { LicenseStatus } from './license'
import type { UpdaterStatus } from './updater'
import type { LogQuery, TaskView } from './tasks'
import type { AppSettings } from './network'
import type { LogEntry } from './types'
import type { DialogsPage, MessageView } from './chats'
import type { Contact, Tag } from './types'
import type { ChannelViewsReport, StatsOverview } from './stats'

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

export interface SessionImportResult {
  index: number
  ok: boolean
  /** Muvaffaqiyatda: ism/username/telefon */
  label: string | null
  error: string | null
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
  /** StringSession (GramJS/Telethon) satrlari orqali kodsiz import. Har satr uchun natija. */
  'accounts:importSessions': { req: { sessions: string[] }; res: SessionImportResult[] }

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
  /** Vaqtni o'zgartiradi: Telegram'dagi rejali xabar o'chirilib yangi vaqt bilan qayta rejalanadi. */
  'posts:reschedule': { req: { id: number; scheduledAt: string }; res: PostDetail }

  /** Fayl tanlash dialogi (main'da). Bekor qilinsa bo'sh massiv. */
  'media:pick': { req: void; res: MediaFile[] }

  'bots:list': { req: void; res: BotView[] }
  /** Token getMe bilan tekshiriladi, shifrlanib saqlanadi va bot ishga tushadi. */
  'bots:add': { req: { token: string }; res: BotView }
  'bots:start': { req: { id: number }; res: BotView }
  'bots:stop': { req: { id: number }; res: BotView }
  'bots:remove': { req: { id: number }; res: void }

  'botRules:list': { req: { botId: number }; res: BotRule[] }
  'botRules:save': { req: BotRuleInput; res: BotRule }
  'botRules:delete': { req: { id: number }; res: void }
  'botRules:toggle': { req: { id: number; active: boolean }; res: BotRule }

  'subscribers:list': { req: SubscriberQuery; res: BotSubscriber[] }
  'subscribers:tags': { req: { botId: number }; res: string[] }
  /** Saqlash dialogi ochiladi; bekor qilinsa path null. */
  'subscribers:exportCsv': { req: { botId: number }; res: { path: string | null; count: number } }
  /** Rassilka auditoriyasi hajmi (faol, ixtiyoriy teg). */
  'subscribers:count': { req: { botId: number; tag?: string | null }; res: number }

  'broadcasts:list': { req: { botId?: number }; res: BroadcastView[] }
  /** Yaratadi va (rejali bo'lmasa) darhol boshlaydi. */
  'broadcasts:create': { req: BroadcastInput; res: BroadcastView }
  'broadcasts:pause': { req: { id: number }; res: BroadcastView }
  'broadcasts:resume': { req: { id: number }; res: BroadcastView }
  'broadcasts:cancel': { req: { id: number }; res: BroadcastView }
  /** Faqat tugagan/bekor qilingan/qoralama. */
  'broadcasts:delete': { req: { id: number }; res: void }
  'broadcasts:report': { req: { id: number }; res: BroadcastReport }

  'license:status': { req: void; res: LicenseStatus }
  /** Email bilan 7 kunlik trial (qurilma bo'yicha bir marta). */
  'license:startTrial': { req: { email: string }; res: LicenseStatus }
  'license:activate': { req: { key: string }; res: LicenseStatus }
  /** Serverdan yangi holat (kuniga 1 marta avtomatik, qo'lda ham). */
  'license:check': { req: void; res: LicenseStatus }
  'license:deactivate': { req: void; res: LicenseStatus }

  'updater:status': { req: void; res: UpdaterStatus }
  'updater:check': { req: void; res: UpdaterStatus }
  /** Foydalanuvchi tasdiqlagach yuklab olish boshlanadi. */
  'updater:download': { req: void; res: UpdaterStatus }
  /** Yuklab olingan yangilanishni o'rnatib qayta ishga tushiradi. */
  'updater:install': { req: void; res: void }

  'tasks:list': { req: void; res: TaskView[] }
  /** Rassilkani bekor qiladi yoki rejali postni Telegram'dan olib tashlaydi (draft'ga qaytadi). */
  'tasks:stop': { req: { key: string }; res: void }

  'logs:list': { req: LogQuery; res: LogEntry[] }
  'logs:modules': { req: void; res: string[] }
  'logs:export': { req: LogQuery; res: { path: string | null; count: number } }
  'logs:clear': { req: void; res: void }

  'backup:export': { req: void; res: { path: string | null } }
  /** Zip tanlanadi, baza almashtiriladi va ilova qayta ishga tushadi. */
  'backup:import': { req: void; res: { restarted: boolean } }

  'chats:dialogs': { req: { accountId: number; offsetDate?: number }; res: DialogsPage }
  'chats:messages': { req: { accountId: number; peer: string; offsetId?: number }; res: MessageView[] }
  'chats:send': { req: { accountId: number; peer: string; text: string; filePath?: string }; res: MessageView }
  'chats:markRead': { req: { accountId: number; peer: string }; res: void }
  /** Dialog avatari (keshlanadi) — URL yoki null */
  'chats:avatar': { req: { accountId: number; peer: string }; res: string | null }
  /** Rasm/video thumbnail (keshlanadi) — tgm-file URL yoki null */
  'chats:thumb': { req: { accountId: number; peer: string; msgId: number }; res: string | null }
  /** Faylni saqlash dialogi bilan yuklab olish */
  'chats:download': { req: { accountId: number; peer: string; msgId: number }; res: { path: string | null } }

  'tags:list': { req: void; res: Tag[] }
  'tags:create': { req: { name: string; color: string }; res: Tag }
  'tags:update': { req: { id: number; name?: string; color?: string }; res: Tag }
  'tags:delete': { req: { id: number }; res: void }

  /** Chat kontakt kartasi (teglar + eslatma). Kontakt yozuvi bo'lmasa bo'sh qaytadi. */
  'contacts:get': { req: { accountId: number; peer: string }; res: { contact: Contact | null; tagIds: number[] } }
  'contacts:setTags': { req: { accountId: number; peer: string; title: string; username: string | null; kind: string; tagIds: number[] }; res: void }
  'contacts:setNote': { req: { accountId: number; peer: string; title: string; username: string | null; kind: string; note: string }; res: void }
  /** Akkaunt bo'yicha peer → tagIds (dialog ro'yxati filtri uchun) */
  'contacts:tagMap': { req: { accountId: number }; res: Record<string, number[]> }
  'contacts:list': { req: { accountId?: number; tagId?: number; search?: string }; res: (Contact & { tagIds: number[] })[] }
  'subscribers:setTags': { req: { id: number; tags: string[] }; res: void }

  'stats:overview': { req: { days: number }; res: StatsOverview }
  /** GramJS orqali kanal postlari ko'rishlari (ulangan akkauntlar) */
  'stats:channelViews': { req: void; res: ChannelViewsReport[] }

  'app:getSettings': { req: void; res: AppSettings }
  'app:setSettings': { req: Partial<AppSettings>; res: AppSettings }
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
  /** Bot ro'yxati yoki holati o'zgardi. */
  'bots:changed': BotView[]
  /** Botga /start yoki /stop bosildi. */
  'subscribers:changed': { botId: number }
  /** Rassilka progressi/holati o'zgardi. */
  'broadcasts:changed': BroadcastView
  'license:changed': LicenseStatus
  'updater:changed': UpdaterStatus
  /** Yangi xabar (kiruvchi yoki boshqa qurilmadan chiquvchi) */
  'chats:newMessage': { accountId: number; peer: string; message: MessageView; dialog: DialogsPage['dialogs'][number] | null }
}

export type IpcEvent = keyof IpcEvents
export type IpcEventPayload<E extends IpcEvent> = IpcEvents[E]

/**
 * Renderer'ga contextBridge orqali ochiladigan API shakli.
 * window.api shu interfeysga mos bo'ladi.
 */
export interface RendererApi {
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
    importSessions: (sessions: string[]) => Promise<SessionImportResult[]>
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
    reschedule: (id: number, scheduledAt: string) => Promise<PostDetail>
  }
  media: {
    pick: () => Promise<MediaFile[]>
  }
  bots: {
    list: () => Promise<BotView[]>
    add: (token: string) => Promise<BotView>
    start: (id: number) => Promise<BotView>
    stop: (id: number) => Promise<BotView>
    remove: (id: number) => Promise<void>
  }
  botRules: {
    list: (botId: number) => Promise<BotRule[]>
    save: (input: BotRuleInput) => Promise<BotRule>
    delete: (id: number) => Promise<void>
    toggle: (id: number, active: boolean) => Promise<BotRule>
  }
  subscribers: {
    list: (q: SubscriberQuery) => Promise<BotSubscriber[]>
    tags: (botId: number) => Promise<string[]>
    exportCsv: (botId: number) => Promise<{ path: string | null; count: number }>
    count: (botId: number, tag?: string | null) => Promise<number>
    setTags: (id: number, tags: string[]) => Promise<void>
  }
  broadcasts: {
    list: (botId?: number) => Promise<BroadcastView[]>
    create: (input: BroadcastInput) => Promise<BroadcastView>
    pause: (id: number) => Promise<BroadcastView>
    resume: (id: number) => Promise<BroadcastView>
    cancel: (id: number) => Promise<BroadcastView>
    delete: (id: number) => Promise<void>
    report: (id: number) => Promise<BroadcastReport>
  }
  license: {
    status: () => Promise<LicenseStatus>
    startTrial: (email: string) => Promise<LicenseStatus>
    activate: (key: string) => Promise<LicenseStatus>
    check: () => Promise<LicenseStatus>
    deactivate: () => Promise<LicenseStatus>
  }
  updater: {
    status: () => Promise<UpdaterStatus>
    check: () => Promise<UpdaterStatus>
    download: () => Promise<UpdaterStatus>
    install: () => Promise<void>
  }
  tasks: {
    list: () => Promise<TaskView[]>
    stop: (key: string) => Promise<void>
  }
  logs: {
    list: (q?: LogQuery) => Promise<LogEntry[]>
    modules: () => Promise<string[]>
    export: (q?: LogQuery) => Promise<{ path: string | null; count: number }>
    clear: () => Promise<void>
  }
  backup: {
    export: () => Promise<{ path: string | null }>
    import: () => Promise<{ restarted: boolean }>
  }
  chats: {
    dialogs: (accountId: number, offsetDate?: number) => Promise<DialogsPage>
    messages: (accountId: number, peer: string, offsetId?: number) => Promise<MessageView[]>
    send: (accountId: number, peer: string, text: string, filePath?: string) => Promise<MessageView>
    markRead: (accountId: number, peer: string) => Promise<void>
    avatar: (accountId: number, peer: string) => Promise<string | null>
    thumb: (accountId: number, peer: string, msgId: number) => Promise<string | null>
    download: (accountId: number, peer: string, msgId: number) => Promise<{ path: string | null }>
  }
  tags: {
    list: () => Promise<Tag[]>
    create: (name: string, color: string) => Promise<Tag>
    update: (id: number, patch: { name?: string; color?: string }) => Promise<Tag>
    delete: (id: number) => Promise<void>
  }
  contacts: {
    get: (accountId: number, peer: string) => Promise<{ contact: Contact | null; tagIds: number[] }>
    setTags: (p: { accountId: number; peer: string; title: string; username: string | null; kind: string; tagIds: number[] }) => Promise<void>
    setNote: (p: { accountId: number; peer: string; title: string; username: string | null; kind: string; note: string }) => Promise<void>
    tagMap: (accountId: number) => Promise<Record<string, number[]>>
    list: (f?: { accountId?: number; tagId?: number; search?: string }) => Promise<(Contact & { tagIds: number[] })[]>
  }
  stats: {
    overview: (days: number) => Promise<StatsOverview>
    channelViews: () => Promise<ChannelViewsReport[]>
  }
  app: {
    getVersion: () => Promise<string>
    getSettings: () => Promise<AppSettings>
    setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
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
