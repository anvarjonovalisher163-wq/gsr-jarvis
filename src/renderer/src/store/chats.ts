import { create } from 'zustand'
import type { DialogFilter, DialogView, MessageView, PeerKey } from '@shared/chats'
import { api } from '@renderer/lib/api'

interface AccountChats {
  dialogs: DialogView[]
  loaded: boolean
  loading: boolean
  nextOffsetDate: number | null
  selected: PeerKey | null
}

interface Thread {
  list: MessageView[]
  hasMore: boolean
  loading: boolean
}

interface ChatsState {
  byAccount: Record<number, AccountChats>
  threads: Record<string, Thread>
  avatars: Record<string, string | null>
  thumbs: Record<string, string | null>
  filter: DialogFilter
  search: string
  error: string | null

  account: (id: number) => AccountChats
  loadDialogs: (accountId: number, more?: boolean) => Promise<void>
  select: (accountId: number, peer: PeerKey | null) => void
  loadMessages: (accountId: number, peer: PeerKey, older?: boolean) => Promise<void>
  send: (accountId: number, peer: PeerKey, text: string, filePath?: string) => Promise<void>
  ensureAvatar: (accountId: number, peer: PeerKey) => void
  ensureThumb: (accountId: number, peer: PeerKey, msgId: number) => void
  setFilter: (f: DialogFilter) => void
  setSearch: (s: string) => void
  onNewMessage: (p: { accountId: number; peer: PeerKey; message: MessageView; dialog: DialogView | null }) => void
}

const EMPTY: AccountChats = { dialogs: [], loaded: false, loading: false, nextOffsetDate: null, selected: null }
const tkey = (a: number, p: PeerKey) => `${a}:${p}`

export const useChats = create<ChatsState>((set, get) => ({
  byAccount: {},
  threads: {},
  avatars: {},
  thumbs: {},
  filter: 'all',
  search: '',
  error: null,

  account: (id) => get().byAccount[id] ?? EMPTY,

  loadDialogs: async (accountId, more = false) => {
    const cur = get().account(accountId)
    if (cur.loading || (more && !cur.nextOffsetDate)) return
    set((s) => ({ byAccount: { ...s.byAccount, [accountId]: { ...cur, loading: true } }, error: null }))
    try {
      const page = await api.chats.dialogs(accountId, more ? (cur.nextOffsetDate ?? undefined) : undefined)
      set((s) => {
        const prev = s.byAccount[accountId] ?? EMPTY
        const merged = more ? [...prev.dialogs, ...page.dialogs.filter((d) => !prev.dialogs.some((x) => x.peer === d.peer))] : page.dialogs
        return { byAccount: { ...s.byAccount, [accountId]: { ...prev, dialogs: merged, loaded: true, loading: false, nextOffsetDate: page.nextOffsetDate } } }
      })
    } catch (e) {
      set((s) => ({ byAccount: { ...s.byAccount, [accountId]: { ...(s.byAccount[accountId] ?? EMPTY), loading: false, loaded: true } }, error: e instanceof Error ? e.message : String(e) }))
    }
  },

  select: (accountId, peer) => {
    set((s) => ({ byAccount: { ...s.byAccount, [accountId]: { ...(s.byAccount[accountId] ?? EMPTY), selected: peer } } }))
    if (peer) {
      const t = get().threads[tkey(accountId, peer)]
      if (!t) get().loadMessages(accountId, peer).catch(console.error)
      // O'qilgan deb belgilaymiz, unread ni nolga tushiramiz
      api.chats.markRead(accountId, peer).catch(() => {})
      set((s) => {
        const acc = s.byAccount[accountId]
        if (!acc) return s
        return { byAccount: { ...s.byAccount, [accountId]: { ...acc, dialogs: acc.dialogs.map((d) => (d.peer === peer ? { ...d, unread: 0 } : d)) } } }
      })
    }
  },

  loadMessages: async (accountId, peer, older = false) => {
    const k = tkey(accountId, peer)
    const t = get().threads[k] ?? { list: [], hasMore: true, loading: false }
    if (t.loading || (older && !t.hasMore)) return
    set((s) => ({ threads: { ...s.threads, [k]: { ...t, loading: true } } }))
    try {
      const offsetId = older && t.list.length ? t.list[0].id : undefined
      const page = await api.chats.messages(accountId, peer, offsetId)
      set((s) => {
        const prev = s.threads[k] ?? t
        const list = older ? [...page, ...prev.list] : page
        return { threads: { ...s.threads, [k]: { list, hasMore: page.length >= 40, loading: false } } }
      })
    } catch (e) {
      set((s) => ({ threads: { ...s.threads, [k]: { ...(s.threads[k] ?? t), loading: false } }, error: e instanceof Error ? e.message : String(e) }))
    }
  },

  send: async (accountId, peer, text, filePath) => {
    const m = await api.chats.send(accountId, peer, text, filePath)
    const k = tkey(accountId, peer)
    set((s) => {
      const t = s.threads[k] ?? { list: [], hasMore: false, loading: false }
      if (t.list.some((x) => x.id === m.id)) return s
      const acc = s.byAccount[accountId]
      const byAccount = acc
        ? { ...s.byAccount, [accountId]: { ...acc, dialogs: bump(acc.dialogs, peer, m, true) } }
        : s.byAccount
      return { threads: { ...s.threads, [k]: { ...t, list: [...t.list, m] } }, byAccount }
    })
  },

  ensureAvatar: (accountId, peer) => {
    const k = tkey(accountId, peer)
    if (k in get().avatars) return
    set((s) => ({ avatars: { ...s.avatars, [k]: null } }))
    api.chats.avatar(accountId, peer).then((url) => url && set((s) => ({ avatars: { ...s.avatars, [k]: url } }))).catch(() => {})
  },

  ensureThumb: (accountId, peer, msgId) => {
    const k = `${tkey(accountId, peer)}:${msgId}`
    if (k in get().thumbs) return
    set((s) => ({ thumbs: { ...s.thumbs, [k]: null } }))
    api.chats.thumb(accountId, peer, msgId).then((url) => url && set((s) => ({ thumbs: { ...s.thumbs, [k]: url } }))).catch(() => {})
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),

  onNewMessage: ({ accountId, peer, message, dialog }) => {
    const k = tkey(accountId, peer)
    set((s) => {
      const acc = s.byAccount[accountId]
      const selected = acc?.selected === peer
      let byAccount = s.byAccount
      if (acc) {
        const exists = acc.dialogs.some((d) => d.peer === peer)
        const dialogs = exists ? bump(acc.dialogs, peer, message, selected) : dialog ? [dialog, ...acc.dialogs] : acc.dialogs
        byAccount = { ...s.byAccount, [accountId]: { ...acc, dialogs } }
      }
      const t = s.threads[k]
      const threads = t && !t.list.some((x) => x.id === message.id) ? { ...s.threads, [k]: { ...t, list: [...t.list, message] } } : s.threads
      return { byAccount, threads }
    })
    if (get().account(accountId).selected === peer) api.chats.markRead(accountId, peer).catch(() => {})
  }
}))

/** Dialogni ro'yxat boshiga chiqarib, oxirgi xabarni yangilaydi. */
function bump(dialogs: DialogView[], peer: PeerKey, m: MessageView, read: boolean): DialogView[] {
  const d = dialogs.find((x) => x.peer === peer)
  if (!d) return dialogs
  const text = m.html.replace(/<[^>]+>/g, '').trim() || m.media?.label || (m.media ? 'Media' : '')
  const updated: DialogView = { ...d, lastText: text.length > 80 ? text.slice(0, 79) + '…' : text, lastDate: m.date, lastOut: m.out, unread: read || m.out ? d.unread : d.unread + 1 }
  const rest = dialogs.filter((x) => x.peer !== peer)
  // Pinned'lar tepada qoladi
  const pinned = rest.filter((x) => x.pinned)
  const others = rest.filter((x) => !x.pinned)
  return updated.pinned ? [updated, ...pinned, ...others] : [...pinned, updated, ...others]
}

export function initChatsSync(): () => void {
  return api.on('chats:newMessage', useChats.getState().onNewMessage)
}
