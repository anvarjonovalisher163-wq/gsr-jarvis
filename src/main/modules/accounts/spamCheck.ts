import { Api } from 'telegram'
import type { SpamCheckResult } from '@shared/ipc'
import { createLogger } from '../../logger'
import { TELEGRAM_TIMEOUT_MS, withTimeout } from '../../utils/timeout'
import { clientManager } from './clientManager'
import { mapTelegramError } from './errors'

const log = createLogger('spam-check')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * @SpamBot'ga /start yuborib javobni o'qiydi — akkauntda cheklov bormi.
 * Bu faqat holatni so'rash; hech qanday cheklovni aylanib o'tmaydi.
 */
export async function spamCheck(accountId: number): Promise<SpamCheckResult> {
  const client = clientManager.getClient(accountId)
  try {
    const peer = await withTimeout(client.getInputEntity('SpamBot'), TELEGRAM_TIMEOUT_MS)
    const sent = await withTimeout(
      client.sendMessage(peer, { message: '/start' }),
      TELEGRAM_TIMEOUT_MS
    )
    let reply: Api.Message | null = null
    for (let i = 0; i < 6 && !reply; i++) {
      await sleep(1500)
      const msgs = await client.getMessages(peer, { limit: 3 })
      reply =
        (msgs.find((m) => m instanceof Api.Message && !m.out && m.id > sent.id) as
          Api.Message | undefined) ?? null
    }
    const checkedAt = new Date().toISOString()
    if (!reply)
      return {
        status: 'unknown',
        until: null,
        text: 'SpamBot javob bermadi. Keyinroq qayta urining.',
        checkedAt
      }
    const text = reply.message ?? ''
    if (
      /no limits|Ваш аккаунт свободен|не ограничен|free of any limitations|Good news/i.test(text)
    ) {
      return { status: 'free', until: null, text, checkedAt }
    }
    if (/limited|ограничен|restrict|spam/i.test(text)) {
      const m = /until\s+(.+?)(?:\.|\n|$)|до\s+(.+?)(?:\.|\n|$)/i.exec(text)
      return {
        status: 'limited',
        until: (m?.[1] ?? m?.[2] ?? null)?.trim() ?? null,
        text,
        checkedAt
      }
    }
    return { status: 'unknown', until: null, text, checkedAt }
  } catch (e) {
    const err = mapTelegramError(e)
    log.warn(`Spam test (${accountId}): ${err.code}`)
    throw err
  }
}
