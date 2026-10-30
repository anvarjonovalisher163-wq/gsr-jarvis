import { create } from 'zustand'
import type { Tag } from '@shared/types'
import { api } from '@renderer/lib/api'

export const TAG_COLORS = ['#2f7cff', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

interface TagsState {
  tags: Tag[]
  loaded: boolean
  /** accountId → peer → tagIds */
  maps: Record<number, Record<string, number[]>>
  /** Dialog ro'yxati filtri: tanlangan teg */
  filterTagId: number | null
  load: () => Promise<void>
  create: (name: string, color: string) => Promise<Tag>
  update: (id: number, patch: { name?: string; color?: string }) => Promise<void>
  remove: (id: number) => Promise<void>
  loadMap: (accountId: number) => Promise<void>
  setPeerTags: (p: { accountId: number; peer: string; title: string; username: string | null; kind: string; tagIds: number[] }) => Promise<void>
  setFilterTag: (id: number | null) => void
}

export const useTags = create<TagsState>((set, get) => ({
  tags: [],
  loaded: false,
  maps: {},
  filterTagId: null,

  load: async () => set({ tags: await api.tags.list(), loaded: true }),
  create: async (name, color) => {
    const t = await api.tags.create(name, color)
    await get().load()
    return t
  },
  update: async (id, patch) => {
    await api.tags.update(id, patch)
    await get().load()
  },
  remove: async (id) => {
    await api.tags.delete(id)
    set((s) => ({ filterTagId: s.filterTagId === id ? null : s.filterTagId }))
    await get().load()
    // xaritalarni qayta yuklaymiz
    for (const acc of Object.keys(get().maps)) get().loadMap(Number(acc)).catch(console.error)
  },
  loadMap: async (accountId) => {
    const m = await api.contacts.tagMap(accountId)
    set((s) => ({ maps: { ...s.maps, [accountId]: m } }))
  },
  setPeerTags: async (p) => {
    await api.contacts.setTags(p)
    set((s) => ({ maps: { ...s.maps, [p.accountId]: { ...(s.maps[p.accountId] ?? {}), [p.peer]: p.tagIds } } }))
  },
  setFilterTag: (filterTagId) => set({ filterTagId })
}))
