import { create } from 'zustand'
import type {
  BlacklistInput,
  CampaignInput,
  CampaignView,
  TemplateInput,
  TemplateView
} from '@shared/outreach'
import type { BlacklistEntry } from '@shared/types'
import { api } from '@renderer/lib/api'

interface OutreachState {
  campaigns: CampaignView[]
  campaignsLoaded: boolean
  templates: TemplateView[]
  templatesLoaded: boolean
  blacklist: BlacklistEntry[]
  blacklistLoaded: boolean

  loadCampaigns: () => Promise<void>
  upsertCampaign: (c: CampaignView) => void
  saveCampaign: (input: CampaignInput) => Promise<CampaignView>
  startCampaign: (id: number) => Promise<void>
  pauseCampaign: (id: number) => Promise<void>
  resumeCampaign: (id: number) => Promise<void>
  cancelCampaign: (id: number) => Promise<void>
  deleteCampaign: (id: number) => Promise<void>

  loadTemplates: () => Promise<void>
  saveTemplate: (input: TemplateInput) => Promise<TemplateView>
  deleteTemplate: (id: number) => Promise<void>

  loadBlacklist: (search?: string) => Promise<void>
  addBlacklist: (input: BlacklistInput) => Promise<void>
  removeBlacklist: (id: number) => Promise<void>
}

export const useOutreach = create<OutreachState>((set, get) => ({
  campaigns: [],
  campaignsLoaded: false,
  templates: [],
  templatesLoaded: false,
  blacklist: [],
  blacklistLoaded: false,

  loadCampaigns: async () => set({ campaigns: await api.campaigns.list(), campaignsLoaded: true }),
  upsertCampaign: (c) =>
    set((s) => {
      const idx = s.campaigns.findIndex((x) => x.id === c.id)
      return {
        campaigns: idx < 0 ? [c, ...s.campaigns] : s.campaigns.map((x, i) => (i === idx ? c : x))
      }
    }),
  saveCampaign: async (input) => {
    const c = await api.campaigns.save(input)
    get().upsertCampaign(c)
    return c
  },
  startCampaign: async (id) => get().upsertCampaign(await api.campaigns.start(id)),
  pauseCampaign: async (id) => get().upsertCampaign(await api.campaigns.pause(id)),
  resumeCampaign: async (id) => get().upsertCampaign(await api.campaigns.resume(id)),
  cancelCampaign: async (id) => get().upsertCampaign(await api.campaigns.cancel(id)),
  deleteCampaign: async (id) => {
    await api.campaigns.delete(id)
    set((s) => ({ campaigns: s.campaigns.filter((x) => x.id !== id) }))
  },

  loadTemplates: async () => set({ templates: await api.templates.list(), templatesLoaded: true }),
  saveTemplate: async (input) => {
    const t = await api.templates.save(input)
    await get().loadTemplates()
    return t
  },
  deleteTemplate: async (id) => {
    await api.templates.delete(id)
    set((s) => ({ templates: s.templates.filter((x) => x.id !== id) }))
  },

  loadBlacklist: async (search) =>
    set({ blacklist: await api.blacklist.list(search), blacklistLoaded: true }),
  addBlacklist: async (input) => {
    await api.blacklist.add(input)
    await get().loadBlacklist()
  },
  removeBlacklist: async (id) => {
    await api.blacklist.remove(id)
    set((s) => ({ blacklist: s.blacklist.filter((x) => x.id !== id) }))
  }
}))

export function initOutreachSync(): () => void {
  return api.on('campaigns:changed', useOutreach.getState().upsertCampaign)
}
