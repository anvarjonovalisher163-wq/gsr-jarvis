/** Proksi va ilova sozlamalari (Sozlamalar tabi). */

export type ProxyType = 'none' | 'socks5' | 'http'

export interface ProxyConfig {
  type: ProxyType
  host: string
  port: number
  username: string
  password: string
}

export const NO_PROXY: ProxyConfig = { type: 'none', host: '', port: 1080, username: '', password: '' }

export type Language = 'uz' | 'ru' | 'en'

export interface AppSettings {
  /** Tizim bilan birga ishga tushish */
  autoStart: boolean
  /** Oyna yopilganda tray'da qolish (rejali ishlar uchun) */
  closeToTray: boolean
  language: Language
  proxy: ProxyConfig
}
