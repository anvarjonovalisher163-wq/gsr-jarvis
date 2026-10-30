import { create } from 'zustand'
import type { LicenseStatus } from '@shared/license'
import { api } from '@renderer/lib/api'

interface LicenseStore {
  status: LicenseStatus | null
  /** Modal ochiq: 'trial' (email), 'key' (kalit) yoki null */
  modal: 'trial' | 'key' | null
  load: () => Promise<void>
  set: (s: LicenseStatus) => void
  openModal: (m: 'trial' | 'key') => void
  closeModal: () => void
  startTrial: (email: string) => Promise<void>
  activate: (key: string) => Promise<void>
  check: () => Promise<void>
  deactivate: () => Promise<void>
}

export const useLicense = create<LicenseStore>((set, get) => ({
  status: null,
  modal: null,
  load: async () => set({ status: await api.license.status() }),
  set: (status) => set({ status }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  startTrial: async (email) => set({ status: await api.license.startTrial(email), modal: null }),
  activate: async (key) => set({ status: await api.license.activate(key), modal: null }),
  check: async () => set({ status: await api.license.check() }),
  deactivate: async () => {
    set({ status: await api.license.deactivate() })
    get().load().catch(console.error)
  }
}))

export function initLicenseSync(): () => void {
  const store = useLicense.getState()
  store
    .load()
    .then(() => {
      // Birinchi ochilish: litsenziya yo'q → trial oynasi
      const s = useLicense.getState().status
      if (s?.state === 'none') useLicense.getState().openModal('trial')
    })
    .catch(console.error)
  return api.on('license:changed', store.set)
}
