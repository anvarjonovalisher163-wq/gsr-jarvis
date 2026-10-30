import { create } from 'zustand'
import type { UpdaterStatus } from '@shared/updater'
import { api } from '@renderer/lib/api'

interface UpdaterStore {
  status: UpdaterStatus | null
  /** Foydalanuvchi bannerni yopdi (shu versiya uchun). */
  dismissedVersion: string | null
  load: () => Promise<void>
  set: (s: UpdaterStatus) => void
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
  dismiss: () => void
}

export const useUpdater = create<UpdaterStore>((set, get) => ({
  status: null,
  dismissedVersion: null,
  load: async () => set({ status: await api.updater.status() }),
  set: (status) => set({ status }),
  check: async () => set({ status: await api.updater.check() }),
  download: async () => set({ status: await api.updater.download() }),
  install: () => api.updater.install(),
  dismiss: () => set({ dismissedVersion: get().status?.version ?? null })
}))

export function initUpdaterSync(): () => void {
  const store = useUpdater.getState()
  store.load().catch(console.error)
  return api.on('updater:changed', store.set)
}
