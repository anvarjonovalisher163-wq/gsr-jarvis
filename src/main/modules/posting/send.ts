import { Api, type TelegramClient } from 'telegram'
import type { PostDetail } from '@shared/ipc'
import type { MediaItem, PostTarget } from '@shared/types'
import { channelsRepo, postsRepo, postTargetsRepo } from '../../db/repositories'
import { AppError, isAppError } from '../../errors'
import { createLogger } from '../../logger'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { toInputPeer } from './peer'
import { emitPostChanged, parseMedia, rollupStatus } from './service'

const log = createLogger('posting')

/** Kanallar orasida pauza: 2–3 soniya (limitlarga hurmat). */
const PAUSE_MIN_MS = 2000
const PAUSE_JITTER_MS = 1000

/** Rejali vaqt shu qadar yaqin/o'tgan bo'lsa, darhol yuboramiz. */
const SCHEDULE_GRACE_SEC = 30

/** Bir vaqtda bitta post bir marta yuboriladi. */
const inFlight = new Set<number>()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function firstMessageId(result: unknown): number | null {
  if (Array.isArray(result)) return result[0]?.id ?? null
  if (result && typeof result === 'object' && 'id' in result) return (result as { id: number }).id
  return null
}

/** Bitta kanalga matn yoki media yuboradi/rejalashtiradi, Telegram xabar id'sini qaytaradi. */
async function sendOne(
  client: TelegramClient,
  peer: Api.InputPeerChannel,
  text: string,
  media: MediaItem[],
  scheduleSec: number | undefined
): Promise<number | null> {
  if (media.length === 0) {
    const msg = await client.sendMessage(peer, {
      message: text,
      parseMode: 'html',
      linkPreview: true,
      schedule: scheduleSec
    })
    return firstMessageId(msg)
  }
  const files = media.map((m) => m.path)
  const result = await client.sendFile(peer, {
    file: files.length === 1 ? files[0] : files,
    caption: text,
    parseMode: 'html',
    forceDocument: media.some((m) => m.kind === 'document'),
    supportsStreaming: media.some((m) => m.kind === 'video'),
    scheduleDate: scheduleSec
  })
  return firstMessageId(result)
}

/**
 * Postning nishonlarini ketma-ket yuboradi (yoki scheduled_at bo'lsa Telegram'da rejalashtiradi).
 *
 * FLOOD_WAIT qoidasi: xato kelgan akkauntning qolgan nishonlari ham "failed" bo'ladi,
 * kutish vaqti logga va xato matniga yoziladi. Boshqa akkauntga o'tib davom etilmaydi.
 *
 * onlyFailed=true — faqat failed nishonlar (Qayta urinish).
 */
export async function sendPost(postId: number, onlyFailed = false): Promise<PostDetail> {
  const post = postsRepo.getById(postId)
  if (!post) throw new AppError('NOT_FOUND', 'Post topilmadi.')
  if (inFlight.has(postId)) throw new AppError('POST_IN_FLIGHT', 'Bu post hozir yuborilmoqda.')

  const all = postTargetsRepo.listByPost(postId)
  const todo = all.filter((t) =>
    onlyFailed ? t.status === 'failed' : t.status === 'pending' || (t.status === 'scheduled' && !t.tg_message_id)
  )
  if (all.length === 0) throw new AppError('NO_TARGETS', 'Kamida bitta kanal tanlang.')
  if (todo.length === 0) return emitPostChanged(postId)

  const media = parseMedia(post)
  const flooded = new Map<number, number>() // accountId → seconds
  inFlight.add(postId)
  log.info(`Post ${postId}: ${todo.length} ta kanalga yuborish boshlandi${onlyFailed ? ' (qayta urinish)' : ''}`)

  try {
    for (let i = 0; i < todo.length; i++) {
      const t = todo[i]
      await sendToTarget(t, post.text, media, flooded)
      emitPostChanged(postId)
      if (i < todo.length - 1) await sleep(PAUSE_MIN_MS + Math.random() * PAUSE_JITTER_MS)
    }
  } finally {
    inFlight.delete(postId)
  }

  const status = rollupStatus(postId)
  log.info(`Post ${postId}: yakunlandi, holat = ${status}`)
  return emitPostChanged(postId)
}

async function sendToTarget(
  t: PostTarget,
  text: string,
  media: MediaItem[],
  flooded: Map<number, number>
): Promise<void> {
  const channel = channelsRepo.getById(t.channel_id)
  if (!channel) {
    postTargetsRepo.markFailed(t.id, "Kanal topilmadi — kanallarni yangilang.")
    return
  }

  const waitSec = flooded.get(channel.account_id)
  if (waitSec !== undefined) {
    postTargetsRepo.markFailed(t.id, `FLOOD_WAIT: akkaunt ${waitSec} soniya kutishi kerak, yuborilmadi.`)
    return
  }

  let scheduleSec: number | undefined
  if (t.scheduled_at) {
    const sec = Math.floor(Date.parse(t.scheduled_at) / 1000)
    scheduleSec = sec - Date.now() / 1000 > SCHEDULE_GRACE_SEC ? sec : undefined
  }

  try {
    const client = clientManager.getClient(channel.account_id)
    const msgId = await sendOne(client, toInputPeer(channel), text, media, scheduleSec)
    if (scheduleSec) {
      postTargetsRepo.markScheduled(t.id, msgId, t.scheduled_at!)
      log.info(`Rejalashtirildi: "${channel.title}" → ${t.scheduled_at} (msg ${msgId})`)
    } else {
      postTargetsRepo.markSent(t.id, msgId)
      log.info(`Yuborildi: "${channel.title}" (msg ${msgId})`)
    }
  } catch (e) {
    const err = isAppError(e) ? e : mapTelegramError(e)
    if (err.code === 'FLOOD_WAIT') {
      flooded.set(channel.account_id, err.retryAfter ?? 0)
      log.warn(`FLOOD_WAIT ${err.retryAfter}s: akkaunt ${channel.account_id}, kanal "${channel.title}". Kutish kerak, boshqa akkauntga o'tilmaydi.`)
    } else {
      log.error(`Yuborilmadi: "${channel.title}" — ${err.code}`, err.message)
    }
    postTargetsRepo.markFailed(t.id, `${err.code}: ${err.message}`)
  }
}
