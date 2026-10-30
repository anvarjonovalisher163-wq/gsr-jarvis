import { api } from '@renderer/lib/api'
import { create } from 'zustand'
import type { AccountView } from '@shared/ipc'

interface AccountsState {
  accounts: AccountView[]
  loaded: boolean
  /** Chatlar tabida tanlangan akkaunt (4-qadamda ishlatiladi). */
  selectedId: number | null
  load: () => Promise<void>
  setAccounts: (list: AccountView[]) => void
  select: (id: number | null) => void
}

export const useAccounts = create<AccountsState>((set, get) => ({
  accounts: [],
  loaded: false,
  selectedId: null,

  load: async () => {
    const accounts = await api.accounts.list()
    get().setAccounts(accounts)
  },

  setAccounts: (accounts) => {
    const { selectedId } = get()
    const stillThere = accounts.some((a) => a.id === selectedId)
    set({
      accounts,
      loaded: true,
      selectedId: stillThere ? selectedId : (accounts.find((a) => a.status === 'active')?.id ?? null)
    })
  },

  select: (id) => set({ selectedId: id })
}))

/** Ilova ochilganda bir marta chaqiriladi: ro'yxatni yuklaydi va main'dan push'larga obuna bo'ladi. */
export function initAccountsSync(): () => void {
  const store = useAccounts.getState()
  store.load().catch(console.error)
  return api.on('accounts:changed', store.setAccounts)
}
