/** Chatlar tabi tiplari. */

export type ChatKind = 'user' | 'bot' | 'group' | 'channel'

/** Peer kaliti: u<id> (foydalanuvchi/bot), c<id> (oddiy guruh), ch<id> (kanal/supergruppa). */
export type PeerKey = string

export interface DialogView {
  peer: PeerKey
  kind: ChatKind
  title: string
  username: string | null
  unread: number
  pinned: boolean
  /** Oxirgi xabar matni (teglarsiz, qisqartirilgan) yoki media tavsifi */
  lastText: string
  /** ISO */
  lastDate: string | null
  lastOut: boolean
  isSelf: boolean
}

export type MediaKind = 'photo' | 'video' | 'gif' | 'sticker' | 'voice' | 'audio' | 'document' | 'other'

export interface MessageMedia {
  kind: MediaKind
  fileName: string | null
  size: number | null
  /** Rasm/video uchun o'lcham */
  width: number | null
  height: number | null
  /** Boshqa media (so'rovnoma, joylashuv…) uchun qisqa tavsif */
  label: string | null
  /** Thumbnail yuklab olish mumkinmi */
  hasThumb: boolean
}

export interface MessageView {
  id: number
  /** ISO */
  date: string
  out: boolean
  /** Guruhlarda yuboruvchi ismi; shaxsiy chatda null */
  senderName: string | null
  /** Telegram HTML (entity'lardan) */
  html: string
  media: MessageMedia | null
  replyToId: number | null
  /** Xizmat xabari (qo'shildi, chiqdi…) */
  service: boolean
}

export interface DialogsPage {
  dialogs: DialogView[]
  /** Keyingi sahifa uchun offset (unix soniya) yoki null */
  nextOffsetDate: number | null
}

export type DialogFilter = 'all' | 'private' | 'groups' | 'channels'
