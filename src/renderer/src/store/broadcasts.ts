import { create } from 'zustand'
import type { BroadcastInput, BroadcastReport, BroadcastView } from '@shared/ipc'
import { api } from '@renderer/lib/api'

interface BroadcastsState {
  items: BroadcastView[]
  loaded: boolean
  load: (botId: number) => Promise<void>
  upsert: (b: BroadcastView) => void
  create: (input: BroadcastInput) => Promise<BroadcastView>
  pause: (id: number) => Promise<void>
  resume: (id: number) => Promise<void>
  cancel: (id: number) => Promise<void>
  remove: (id: number) => Promise<void>
  report: (id: number) => Promise<BroadcastReport>
}

export const useBroadcasts = create<BroadcastsState>((set, get) => ({
  items: [],
  loaded: false,

  load: async (botId) => set({ items: await api.broadcasts.list(botId), loaded: true }),

  upsert: (b) =>
    set((s) => {
      const idx = s.items.findIndex((x) => x.id === b.id)
      if (idx < 0) return s.items.some((x) => x.bot_id === b.bot_id) || s.items.length === 0 ? { items: [b, ...s.items] } : s
      return { items: s.items.map((x, i) => (i === idx ? b : x)) }
    }),

  create: async (input) => {
    const b = await api.broadcasts.create(input)
    get().upsert(b)
    return b
  },
  pause: async (id) => get().upsert(await api.broadcasts.pause(id)),
  resume: async (id) => get().upsert(await api.broadcasts.resume(id)),
  cancel: async (id) => get().upsert(await api.broadcasts.cancel(id)),
  remove: async (id) => {
    await api.broadcasts.delete(id)
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
  },
  report: (id) => api.broadcasts.report(id)
}))

export function initBroadcastsSync(): () => void {
  return api.on('broadcasts:changed', useBroadcasts.getState().upsert)
}
