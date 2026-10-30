import { app, net, session } from 'electron'
import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy'
import { NO_PROXY, type ProxyConfig } from '@shared/network'
import { settingsRepo, SettingKeys } from '../../db/repositories'
import { createLogger } from '../../logger'

const log = createLogger('network')

/**
 * Bitta umumiy proksi (ixtiyoriy):
 *  - Chromium tarmog'i (session.setProxy) → Electron net.fetch orqali grammY (botlar), litsenziya, yangilanish
 *  - GramJS (MTProto TCP) → SOCKS5/4; HTTP proksi MTProto uchun ishlamaydi (GramJS qo'llamaydi)
 */
export function getProxy(): ProxyConfig {
  const p = settingsRepo.getJson<Partial<ProxyConfig> | null>(SettingKeys.proxy, null)
  if (!p || !p.type || p.type === 'none') return NO_PROXY
  return { ...NO_PROXY, ...p }
}

export function saveProxy(p: ProxyConfig): void {
  if (p.type === 'none') settingsRepo.remove(SettingKeys.proxy)
  else settingsRepo.setJson(SettingKeys.proxy, p)
}

function proxyRules(p: ProxyConfig): string | null {
  if (p.type === 'none' || !p.host) return null
  return `${p.type === 'socks5' ? 'socks5' : 'http'}://${p.host}:${p.port}`
}

let loginHandlerSet = false

/** Chromium sessiyasiga proksini qo'llaydi (ilova ochilganda va sozlama o'zgarganda). */
export async function applyProxy(): Promise<void> {
  const p = getProxy()
  const rules = proxyRules(p)
  await session.defaultSession.setProxy(rules ? { proxyRules: rules, proxyBypassRules: '<local>' } : { mode: 'direct' })
  log.info(rules ? `Proksi qo'llandi: ${p.type}://${p.host}:${p.port}` : 'Proksi: to\'g\'ridan-to\'g\'ri')

  // HTTP proksi autentifikatsiyasi (SOCKS5 parolini Chromium qo'llamaydi)
  if (!loginHandlerSet) {
    loginHandlerSet = true
    app.on('login', (event, _wc, _req, authInfo, callback) => {
      const cur = getProxy()
      if (authInfo.isProxy && cur.username) {
        event.preventDefault()
        callback(cur.username, cur.password)
      }
    })
  }
}

/** GramJS uchun SOCKS proksi (faqat socks5). */
export function gramjsProxy(): ProxyInterface | undefined {
  const p = getProxy()
  if (p.type !== 'socks5' || !p.host) return undefined
  return {
    ip: p.host,
    port: p.port,
    socksType: 5,
    username: p.username || undefined,
    password: p.password || undefined,
    timeout: 10
  }
}

/**
 * Electron'ning net.fetch'i — Chromium tarmog'i orqali (proksi va tizim CA bilan).
 * grammY (`client.fetch`) va litsenziya mijozi shuni ishlatadi.
 */
export const proxiedFetch: typeof fetch = (input, init) => net.fetch(input as string | Request, init as RequestInit)
