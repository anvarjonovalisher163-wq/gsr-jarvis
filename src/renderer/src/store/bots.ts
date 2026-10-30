import { create } from 'zustand'
import type { BotRuleInput, BotView, SubscriberQuery } from '@shared/ipc'
import type { BotRule, BotSubscriber } from '@shared/types'
import { api } from '@renderer/lib/api'

interface BotsState {
  bots: BotView[]
  loaded: boolean
  selectedId: number | null
  rules: BotRule[]
  subscribers: BotSubscriber[]
  tags: string[]
  subQuery: Omit<SubscriberQuery, 'botId'>

  load: () => Promise<void>
  setBots: (bots: BotView[]) => void
  select: (id: number | null) => void
  add: (token: string) => Promise<BotView>
  start: (id: number) => Promise<void>
  stop: (id: number) => Promise<void>
  remove: (id: number) => Promise<void>

  loadRules: () => Promise<void>
  saveRule: (input: BotRuleInput) => Promise<void>
  deleteRule: (id: number) => Promise<void>
  toggleRule: (id: number, active: boolean) => Promise<void>

  loadSubscribers: () => Promise<void>
  setSubQuery: (q: Omit<SubscriberQuery, 'botId'>) => void
}

export const useBots = create<BotsState>((set, get) => ({
  bots: [],
  loaded: false,
  selectedId: null,
  rules: [],
  subscribers: [],
  tags: [],
  subQuery: { activeOnly: true },

  load: async () => get().setBots(await api.bots.list()),

  setBots: (bots) => {
    const { selectedId } = get()
    const keep = bots.some((b) => b.id === selectedId) ? selectedId : (bots[0]?.id ?? null)
    set({ bots, loaded: true, selectedId: keep })
    if (keep !== selectedId) {
      get().loadRules().catch(console.error)
      get().loadSubscribers().catch(console.error)
    }
  },

  select: (id) => {
    set({ selectedId: id, rules: [], subscribers: [], tags: [] })
    if (id !== null) {
      get().loadRules().catch(console.error)
      get().loadSubscribers().catch(console.error)
    }
  },

  add: async (token) => {
    const bot = await api.bots.add(token)
    await get().load()
    get().select(bot.id)
    return bot
  },
  start: async (id) => {
    await api.bots.start(id)
    await get().load()
  },
  stop: async (id) => {
    await api.bots.stop(id)
    await get().load()
  },
  remove: async (id) => {
    await api.bots.remove(id)
    await get().load()
  },

  loadRules: async () => {
    const id = get().selectedId
    if (id === null) return
    const rules = await api.botRules.list(id)
    if (get().selectedId === id) set({ rules })
  },
  saveRule: async (input) => {
    await api.botRules.save(input)
    await get().loadRules()
  },
  deleteRule: async (id) => {
    await api.botRules.delete(id)
    await get().loadRules()
  },
  toggleRule: async (id, active) => {
    await api.botRules.toggle(id, active)
    await get().loadRules()
  },

  loadSubscribers: async () => {
    const id = get().selectedId
    if (id === null) return
    const [subscribers, tags] = await Promise.all([api.subscribers.list({ botId: id, ...get().subQuery }), api.subscribers.tags(id)])
    if (get().selectedId === id) set({ subscribers, tags })
  },
  setSubQuery: (subQuery) => {
    set({ subQuery })
    get().loadSubscribers().catch(console.error)
  }
}))

export function initBotsSync(): () => void {
  const store = useBots.getState()
  store.load().catch(console.error)
  const off1 = api.on('bots:changed', store.setBots)
  const off2 = api.on('subscribers:changed', ({ botId }) => {
    const s = useBots.getState()
    if (s.selectedId === botId) s.loadSubscribers().catch(console.error)
    // obunachilar soni ham o'zgardi
    s.load().catch(console.error)
  })
  return () => {
    off1()
    off2()
  }
}
