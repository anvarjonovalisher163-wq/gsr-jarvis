import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tgm.theme'

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* localStorage mavjud bo'lmasa, tizim sozlamasiga qaraymiz */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

interface ThemeState {
  theme: Theme
  toggle: () => void
  set: (theme: Theme) => void
}

const initial = readInitial()
apply(initial)

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initial,
  toggle: () => get().set(get().theme === 'dark' ? 'light' : 'dark'),
  set: (theme) => {
    apply(theme)
    set({ theme })
  }
}))
