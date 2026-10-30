import { create } from 'zustand'
import type { ChannelView } from '@shared/ipc'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'

interface ChannelsState {
  channels: ChannelView[]
  loaded: boolean
  /** Post yuborish uchun tanlangan kanallar (channels.id). */
  selectedIds: number[]
  /** Hozir sinxronlanayotgan akkauntlar. */
  syncing: number[]
  /** Akkaunt bo'yicha oxirgi sinxronlash xatosi. */
  errors: Record<number, string>

  load: () => Promise<void>
  sync: (accountId: number) => Promise<void>
  toggle: (id: number) => void
  setSelected: (ids: number[]) => void
  selectAllFor: (accountId: number, on: boolean) => void
}

export const useChannels = create<ChannelsState>((set, get) => ({
  channels: [],
  loaded: false,
  selectedIds: [],
  syncing: [],
  errors: {},

  load: async () => {
    const channels = await api.channels.list()
    set((s) => ({
      channels,
      loaded: true,
      selectedIds: s.selectedIds.filter((id) => channels.some((c) => c.id === id))
    }))
  },

  sync: async (accountId) => {
    if (get().syncing.includes(accountId)) return
    set((s) => ({ syncing: [...s.syncing, accountId], errors: { ...s.errors, [accountId]: '' } }))
    try {
      await api.channels.sync(accountId)
      await get().load()
    } catch (e) {
      set((s) => ({ errors: { ...s.errors, [accountId]: describeError(e).message } }))
    } finally {
      set((s) => ({ syncing: s.syncing.filter((id) => id !== accountId) }))
    }
  },

  toggle: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id]
    })),

  setSelected: (ids) => set({ selectedIds: ids }),

  selectAllFor: (accountId, on) =>
    set((s) => {
      const ids = s.channels.filter((c) => c.account_id === accountId).map((c) => c.id)
      const rest = s.selectedIds.filter((id) => !ids.includes(id))
      return { selectedIds: on ? [...rest, ...ids] : rest }
    })
}))
