import { app, BrowserWindow, dialog } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Api, type TelegramClient } from 'telegram'
import { HTMLParser } from 'telegram/extensions/html'
import { NewMessage, type NewMessageEvent } from 'telegram/events'
import type { Entity } from 'telegram/define'
import type { DialogsPage, DialogView, MessageMedia, MessageView, PeerKey } from '@shared/chats'
import { mediaUrl } from '@shared/media'
import { AppError } from '../../errors'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'
import { TELEGRAM_TIMEOUT_MS, withTimeout } from '../../utils/timeout'
import { avatarUrl, downloadAvatar } from '../accounts/avatars'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { allowMediaPaths, isAllowedMediaPath } from '../posting/media'
import {
  cachedEntity,
  forgetAccount,
  inputPeerFor,
  kindOfEntity,
  peerKeyOf,
  peerKeyOfEntity,
  remember
} from './peers'

const log = createLogger('chats')

const DIALOGS_PAGE = 50
const MESSAGES_PAGE = 40

// --- Konvertatsiya ---

function displayName(e: Entity | undefined): string {
  if (!e) return "Noma'lum"
  if (e instanceof Api.User)
    return (
      [e.firstName, e.lastName].filter(Boolean).join(' ') || e.username || e.phone || `#${e.id}`
    )
  if ('title' in e && typeof e.title === 'string') return e.title
  return `#${(e as { id: unknown }).id}`
}

function usernameOf(e: Entity | undefined): string | null {
  if (!e) return null
  if ('username' in e && typeof e.username === 'string') return e.username
  return null
}

function fileNameOf(doc: Api.Document): string | null {
  const a = doc.attributes.find(
    (x): x is Api.DocumentAttributeFilename => x instanceof Api.DocumentAttributeFilename
  )
  return a?.fileName ?? null
}

function toMedia(m: Api.TypeMessageMedia | undefined): MessageMedia | null {
  if (!m || m instanceof Api.MessageMediaEmpty || m instanceof Api.MessageMediaWebPage) return null
  const base: MessageMedia = {
    kind: 'other',
    fileName: null,
    size: null,
    width: null,
    height: null,
    label: null,
    hasThumb: false
  }

  if (m instanceof Api.MessageMediaPhoto && m.photo instanceof Api.Photo) {
    const big = m.photo.sizes.find((s): s is Api.PhotoSize => s instanceof Api.PhotoSize)
    return { ...base, kind: 'photo', width: big?.w ?? null, height: big?.h ?? null, hasThumb: true }
  }
  if (m instanceof Api.MessageMediaDocument && m.document instanceof Api.Document) {
    const d = m.document
    const attrs = d.attributes
    const hasThumb = !!d.thumbs?.some(
      (t) => t instanceof Api.PhotoSize || t instanceof Api.PhotoStrippedSize
    )
    const video = attrs.find(
      (x): x is Api.DocumentAttributeVideo => x instanceof Api.DocumentAttributeVideo
    )
    const audio = attrs.find(
      (x): x is Api.DocumentAttributeAudio => x instanceof Api.DocumentAttributeAudio
    )
    const size = Number(d.size)
    if (attrs.some((x) => x instanceof Api.DocumentAttributeSticker))
      return { ...base, kind: 'sticker', size, hasThumb, label: 'Stiker' }
    if (attrs.some((x) => x instanceof Api.DocumentAttributeAnimated))
      return {
        ...base,
        kind: 'gif',
        size,
        width: video?.w ?? null,
        height: video?.h ?? null,
        hasThumb,
        label: 'GIF'
      }
    if (video)
      return {
        ...base,
        kind: 'video',
        fileName: fileNameOf(d),
        size,
        width: video.w,
        height: video.h,
        hasThumb,
        label: video.roundMessage ? 'Video xabar' : 'Video'
      }
    if (audio)
      return {
        ...base,
        kind: audio.voice ? 'voice' : 'audio',
        fileName: fileNameOf(d),
        size,
        hasThumb,
        label: audio.voice ? 'Ovozli xabar' : audio.title || 'Audio'
      }
    return { ...base, kind: 'document', fileName: fileNameOf(d) ?? 'fayl', size, hasThumb }
  }
  if (
    m instanceof Api.MessageMediaGeo ||
    m instanceof Api.MessageMediaGeoLive ||
    m instanceof Api.MessageMediaVenue
  )
    return { ...base, label: 'Joylashuv' }
  if (m instanceof Api.MessageMediaContact)
    return { ...base, label: `Kontakt: ${[m.firstName, m.lastName].filter(Boolean).join(' ')}` }
  if (m instanceof Api.MessageMediaPoll)
    return { ...base, label: `So'rovnoma: ${m.poll.question.text}` }
  return { ...base, label: 'Media' }
}

function toMessageView(m: Api.Message | Api.MessageService, isPrivate: boolean): MessageView {
  const date = new Date(m.date * 1000).toISOString()
  if (m instanceof Api.MessageService) {
    return {
      id: m.id,
      date,
      out: !!m.out,
      senderName: null,
      html: 'Xizmat xabari',
      media: null,
      replyToId: null,
      service: true
    }
  }
  let senderName: string | null = null
  if (!isPrivate && !m.out) {
    try {
      const sender = (m as unknown as { sender?: Entity }).sender
      senderName = sender ? displayName(sender) : null
    } catch {
      senderName = null
    }
  }
  const replyTo =
    m.replyTo instanceof Api.MessageReplyHeader ? (m.replyTo.replyToMsgId ?? null) : null
  return {
    id: m.id,
    date,
    out: !!m.out,
    senderName,
    html: HTMLParser.unparse(m.message ?? '', m.entities),
    media: toMedia(m.media),
    replyToId: replyTo,
    service: false
  }
}

function lastTextOf(m: Api.Message | Api.MessageService | undefined): string {
  if (!m) return ''
  if (m instanceof Api.MessageService) return 'Xizmat xabari'
  const media = toMedia(m.media)
  const text = (m.message ?? '').replace(/\s+/g, ' ').trim()
  if (text) return text.length > 80 ? text.slice(0, 79) + '…' : text
  if (media)
    return (
      media.label ??
      (media.kind === 'photo'
        ? 'Rasm'
        : media.kind === 'video'
          ? 'Video'
          : (media.fileName ?? 'Media'))
    )
  return ''
}

// --- Dialoglar ---

export async function getDialogs(accountId: number, offsetDate?: number): Promise<DialogsPage> {
  const client = clientManager.getClient(accountId)
  let dialogs
  try {
    dialogs = await withTimeout(
      client.getDialogs({ limit: DIALOGS_PAGE, offsetDate, ignoreMigrated: true }),
      TELEGRAM_TIMEOUT_MS
    )
  } catch (e) {
    throw mapTelegramError(e)
  }
  const me = await client.getMe()
  const out: DialogView[] = []
  for (const d of dialogs) {
    const e = d.entity
    if (!e) continue
    const key = peerKeyOfEntity(e)
    remember(accountId, key, d.inputEntity, e)
    const isSelf = e instanceof Api.User && e.id.eq(me.id)
    out.push({
      peer: key,
      kind: kindOfEntity(e),
      title: isSelf ? 'Saqlangan xabarlar' : d.title || d.name || displayName(e),
      username: usernameOf(e),
      unread: d.unreadCount,
      pinned: d.pinned,
      lastText: lastTextOf(d.message),
      lastDate: d.message ? new Date(d.message.date * 1000).toISOString() : null,
      lastOut: !!d.message?.out,
      isSelf
    })
  }
  const last = dialogs[dialogs.length - 1]
  return {
    dialogs: out,
    nextOffsetDate: dialogs.length >= DIALOGS_PAGE && last?.message ? last.message.date : null
  }
}

// --- Xabarlar ---

export async function getMessages(
  accountId: number,
  peer: PeerKey,
  offsetId?: number
): Promise<MessageView[]> {
  const client = clientManager.getClient(accountId)
  const input = await inputPeerFor(client, accountId, peer)
  try {
    const msgs = await withTimeout(
      client.getMessages(input, { limit: MESSAGES_PAGE, offsetId: offsetId ?? 0 }),
      TELEGRAM_TIMEOUT_MS
    )
    const isPrivate = peer.startsWith('u')
    // Eskidan yangiga tartib
    return msgs
      .filter(Boolean)
      .map((m) => toMessageView(m as unknown as Api.Message | Api.MessageService, isPrivate))
      .reverse()
  } catch (e) {
    throw mapTelegramError(e)
  }
}

export async function sendMessage(
  accountId: number,
  peer: PeerKey,
  text: string,
  filePath?: string
): Promise<MessageView> {
  const client = clientManager.getClient(accountId)
  const input = await inputPeerFor(client, accountId, peer)
  const body = text.trim()
  if (!body && !filePath) throw new AppError('MESSAGE_EMPTY', 'Xabar matni yoki fayl kiriting.')
  // Faqat fayl dialogida tanlangan yo'llar (renderer ixtiyoriy faylni yubora olmasin)
  if (filePath && !isAllowedMediaPath(filePath))
    throw new AppError('FORBIDDEN', 'Fayl tanlash dialogi orqali tanlang.')
  try {
    const sent = filePath
      ? await client.sendFile(input, { file: filePath, caption: body || undefined })
      : await client.sendMessage(input, { message: body })
    const m = Array.isArray(sent) ? sent[0] : sent
    return toMessageView(m as Api.Message, peer.startsWith('u'))
  } catch (e) {
    throw mapTelegramError(e)
  }
}

export async function markRead(accountId: number, peer: PeerKey): Promise<void> {
  const client = clientManager.getClient(accountId)
  const input = await inputPeerFor(client, accountId, peer)
  await client.markAsRead(input).catch((e) => log.warn(`markAsRead ${peer}`, e))
}

// --- Avatar va media ---

export async function peerAvatar(accountId: number, peer: PeerKey): Promise<string | null> {
  const id = `${accountId}-${peer}`
  const existing = avatarUrl('peer', id)
  if (existing) return existing
  const client = clientManager.tryGetClient(accountId)
  if (!client) return null
  const entity = cachedEntity(accountId, peer) ?? (await inputPeerFor(client, accountId, peer))
  await downloadAvatar(client, entity, 'peer', id)
  return avatarUrl('peer', id)
}

function mediaCacheDir(): string {
  const dir = join(app.getPath('userData'), 'media-cache')
  mkdirSync(dir, { recursive: true })
  return dir
}

async function fetchMessage(
  client: TelegramClient,
  accountId: number,
  peer: PeerKey,
  msgId: number
): Promise<Api.Message> {
  const input = await inputPeerFor(client, accountId, peer)
  const msgs = await client.getMessages(input, { ids: [msgId] })
  const m = msgs[0]
  if (!(m instanceof Api.Message)) throw new AppError('NOT_FOUND', 'Xabar topilmadi.')
  return m
}

/** Kichik thumbnail (rasm 'm' o'lchami yoki hujjat/video thumb'i) — keshlanadi. */
export async function messageThumb(
  accountId: number,
  peer: PeerKey,
  msgId: number
): Promise<string | null> {
  const file = join(mediaCacheDir(), `${accountId}-${peer}-${msgId}-thumb.jpg`)
  if (existsSync(file)) {
    allowMediaPaths([{ path: file, kind: 'photo' }])
    return mediaUrl(file)
  }
  const client = clientManager.getClient(accountId)
  try {
    const m = await fetchMessage(client, accountId, peer, msgId)
    let thumb: number | undefined
    if (m.media instanceof Api.MessageMediaPhoto && m.media.photo instanceof Api.Photo) {
      // 'm' (320px) o'lchamini tanlaymiz
      const idx = m.media.photo.sizes.findIndex((s) => s instanceof Api.PhotoSize && s.type === 'm')
      thumb = idx >= 0 ? idx : 1
    } else if (
      m.media instanceof Api.MessageMediaDocument &&
      m.media.document instanceof Api.Document
    ) {
      if (!m.media.document.thumbs?.length) return null
      thumb = m.media.document.thumbs.length - 1
    } else return null
    const buf = await withTimeout(client.downloadMedia(m, { thumb }), TELEGRAM_TIMEOUT_MS)
    if (!buf || !(buf instanceof Buffer) || buf.length === 0) return null
    writeFileSync(file, buf)
    allowMediaPaths([{ path: file, kind: 'photo' }])
    return mediaUrl(file)
  } catch (e) {
    log.warn(`Thumbnail yuklanmadi ${peer}/${msgId}`, mapTelegramError(e).message)
    return null
  }
}

export async function downloadMessageFile(
  accountId: number,
  peer: PeerKey,
  msgId: number,
  win: BrowserWindow | null
): Promise<{ path: string | null }> {
  const client = clientManager.getClient(accountId)
  const m = await fetchMessage(client, accountId, peer, msgId)
  const media = toMedia(m.media)
  const defaultName =
    media?.fileName ??
    (media?.kind === 'photo'
      ? `photo-${msgId}.jpg`
      : media?.kind === 'video'
        ? `video-${msgId}.mp4`
        : `file-${msgId}`)
  const opts: Electron.SaveDialogOptions = {
    title: 'Faylni saqlash',
    defaultPath: join(app.getPath('downloads'), defaultName)
  }
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (res.canceled || !res.filePath) return { path: null }
  try {
    await client.downloadMedia(m, { outputFile: res.filePath })
    log.info(`Fayl saqlandi: ${res.filePath}`)
    return { path: res.filePath }
  } catch (e) {
    throw mapTelegramError(e)
  }
}

// --- Real vaqt: yangi xabarlar ---

const handlers = new Map<number, (e: NewMessageEvent) => Promise<void>>()

export function initChatEvents(): void {
  clientManager.onClientReady((accountId, client) => {
    if (handlers.has(accountId)) return
    const handler = async (event: NewMessageEvent) => {
      try {
        const m = event.message
        const key = peerKeyOf(m.peerId)
        const isPrivate = key.startsWith('u')
        let dialogView: DialogView | null = null
        if (!cachedEntity(accountId, key)) {
          // Yangi chat — entity'ni olib keshlaymiz
          try {
            const chat = await event.getChat()
            const input = await event.getInputChat()
            if (chat && input) {
              remember(accountId, key, input as Api.TypeInputPeer, chat as Entity)
              dialogView = {
                peer: key,
                kind: kindOfEntity(chat as Entity),
                title: displayName(chat as Entity),
                username: usernameOf(chat as Entity),
                unread: m.out ? 0 : 1,
                pinned: false,
                lastText: lastTextOf(m),
                lastDate: new Date(m.date * 1000).toISOString(),
                lastOut: !!m.out,
                isSelf: false
              }
            }
          } catch {
            /* ignore */
          }
        }
        broadcast('chats:newMessage', {
          accountId,
          peer: key,
          message: toMessageView(m, isPrivate),
          dialog: dialogView
        })
      } catch (e) {
        log.warn(`Yangi xabar qayta ishlanmadi (akkaunt ${accountId})`, e)
      }
    }
    handlers.set(accountId, handler)
    client.addEventHandler(handler, new NewMessage({}))
    log.debug(`Akkaunt ${accountId}: xabar hodisalari ulandi`)
  })

  clientManager.onClientGone((accountId) => {
    handlers.delete(accountId)
    forgetAccount(accountId)
  })
}

/**
 * @username yoki +telefon bo'yicha bitta foydalanuvchini topish — Telegram ilovasidagi qidiruv kabi.
 * Topilgan entity keshlanadi, shunda chat ochib yozish mumkin. Faqat bittalab (ro'yxat emas).
 */
export async function resolvePeer(accountId: number, rawQuery: string): Promise<DialogView> {
  const client = clientManager.getClient(accountId)
  const q = rawQuery.trim()
  let entity: Entity
  try {
    if (/^\+?\d{7,15}$/.test(q)) {
      const r = await withTimeout(
        client.invoke(new Api.contacts.ResolvePhone({ phone: q.replace(/\D/g, '') })),
        TELEGRAM_TIMEOUT_MS
      )
      if (!r.users[0]) throw new AppError('NOT_FOUND', 'Topilmadi.')
      entity = r.users[0] as Entity
    } else {
      entity = (await withTimeout(
        client.getEntity(q.startsWith('@') ? q : `@${q}`),
        TELEGRAM_TIMEOUT_MS
      )) as Entity
    }
  } catch (e) {
    const err = mapTelegramError(e)
    if (err.code === 'PHONE_NOT_OCCUPIED')
      throw new AppError('NOT_FOUND', "Bu telefonda Telegram yo'q.")
    if (
      err.code === 'USERNAME_NOT_OCCUPIED' ||
      err.code === 'USERNAME_INVALID' ||
      /No user has|Cannot find any entity/i.test(err.message)
    ) {
      throw new AppError('NOT_FOUND', `${q} topilmadi.`)
    }
    if (/^\+?\d/.test(q))
      throw new AppError(
        'NOT_FOUND',
        "Telefon bo'yicha topilmadi — foydalanuvchi maxfiylik sozlamalari ruxsat bermaydi."
      )
    throw err
  }
  const key = peerKeyOfEntity(entity)
  const input = await client.getInputEntity(entity)
  remember(accountId, key, input, entity)
  return {
    peer: key,
    kind: kindOfEntity(entity),
    title: displayName(entity),
    username: usernameOf(entity),
    unread: 0,
    pinned: false,
    lastText: '',
    lastDate: null,
    lastOut: false,
    isSelf: false
  }
}
