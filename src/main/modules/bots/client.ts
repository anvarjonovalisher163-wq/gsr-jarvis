import type { BotConfig, Context } from 'grammy'
import { proxiedFetch } from '../network/proxy'

/**
 * grammY Bot sozlamalari.
 * TGM_BOT_API_ROOT — Bot API manzilini almashtirish (self-hosted Bot API server
 * yoki dev/test uchun soxta server). Bo'sh bo'lsa api.telegram.org.
 */
export function botConfig(): BotConfig<Context> {
  const apiRoot = process.env.TGM_BOT_API_ROOT?.trim()
  // Electron net.fetch: Chromium tarmog'i — sozlamalardagi proksi va tizim CA ishlaydi
  return { client: { fetch: proxiedFetch as never, ...(apiRoot ? { apiRoot } : {}) } }
}
