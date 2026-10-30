import type { BotConfig, Context } from 'grammy'

/**
 * grammY Bot sozlamalari.
 * TGM_BOT_API_ROOT — Bot API manzilini almashtirish (self-hosted Bot API server
 * yoki dev/test uchun soxta server). Bo'sh bo'lsa api.telegram.org.
 */
export function botConfig(): BotConfig<Context> | undefined {
  const apiRoot = process.env.TGM_BOT_API_ROOT?.trim()
  return apiRoot ? { client: { apiRoot } } : undefined
}
