import { create } from 'zustand'
import type { PostDetail, PostFilter, PostInput } from '@shared/ipc'
import { DEFAULT_TIMEZONE } from '@shared/time'
import { api } from '@renderer/lib/api'

export type PostingView = 'editor' | 'list' | 'calendar' | 'stories'

interface PostsState {
  posts: PostDetail[]
  loaded: boolean
  filter: PostFilter
  view: PostingView
  /** Tahrirlanayotgan post; null — yangi post. */
  editing: PostDetail | null
  timezone: string
  /** Kalendarda bo'sh kunga bosilganda: yangi post uchun oldindan tanlangan vaqt (ISO). */
  presetSchedule: string | null

  load: () => Promise<void>
  setFilter: (f: PostFilter) => void
  setView: (v: PostingView) => void
  openNew: (presetSchedule?: string | null) => void
  reschedule: (id: number, scheduledAt: string) => Promise<PostDetail>
  openEdit: (d: PostDetail) => void
  upsert: (d: PostDetail) => void

  save: (input: PostInput) => Promise<PostDetail>
  send: (id: number) => Promise<PostDetail>
  retry: (id: number) => Promise<PostDetail>
  remove: (id: number) => Promise<void>
  duplicate: (id: number) => Promise<PostDetail>
  loadTimezone: () => Promise<void>
}

export const usePosts = create<PostsState>((set, get) => ({
  posts: [],
  loaded: false,
  filter: {},
  view: 'editor',
  editing: null,
  timezone: DEFAULT_TIMEZONE,
  presetSchedule: null,

  load: async () => {
    const posts = await api.posts.list(get().filter)
    set({ posts, loaded: true })
  },

  setFilter: (filter) => {
    set({ filter })
    get().load().catch(console.error)
  },

  setView: (view) => set({ view }),
  openNew: (presetSchedule = null) => set({ editing: null, view: 'editor', presetSchedule }),
  openEdit: (d) => set({ editing: d, view: 'editor' }),

  upsert: (d) =>
    set((s) => {
      const idx = s.posts.findIndex((p) => p.post.id === d.post.id)
      const posts = idx >= 0 ? s.posts.map((p, i) => (i === idx ? d : p)) : [d, ...s.posts]
      return { posts, editing: s.editing?.post.id === d.post.id ? d : s.editing }
    }),

  save: async (input) => {
    const d = await api.posts.save(input)
    get().upsert(d)
    return d
  },
  send: async (id) => {
    const d = await api.posts.send(id)
    get().upsert(d)
    return d
  },
  retry: async (id) => {
    const d = await api.posts.retry(id)
    get().upsert(d)
    return d
  },
  remove: async (id) => {
    await api.posts.delete(id)
    set((s) => ({
      posts: s.posts.filter((p) => p.post.id !== id),
      editing: s.editing?.post.id === id ? null : s.editing
    }))
  },
  reschedule: async (id, scheduledAt) => {
    const d = await api.posts.reschedule(id, scheduledAt)
    get().upsert(d)
    return d
  },
  duplicate: async (id) => {
    const d = await api.posts.duplicate(id)
    get().upsert(d)
    return d
  },

  loadTimezone: async () => {
    const v = await api.settings.get(['app.timezone'])
    set({ timezone: v['app.timezone'] || DEFAULT_TIMEZONE })
  }
}))

/** Ilova ochilganda bir marta: posts:changed push'lariga obuna. */
export function initPostsSync(): () => void {
  const store = usePosts.getState()
  store.loadTimezone().catch(console.error)
  return api.on('posts:changed', store.upsert)
}
