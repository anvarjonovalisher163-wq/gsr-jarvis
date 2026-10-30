import { Api } from 'telegram'
import type { PostDetail, PostFilter, PostInput, TargetView } from '@shared/ipc'
import type { MediaItem, Post, PostStatus, PostTarget } from '@shared/types'
import { LIMITS, validateMediaSet } from '@shared/media'
import { channelsRepo, postsRepo, postTargetsRepo } from '../../db/repositories'
import { getDb } from '../../db'
import { AppError } from '../../errors'
import { broadcast } from '../../events'
import { createLogger } from '../../logger'
import { avatarUrl } from '../accounts/avatars'
import { clientManager } from '../accounts/clientManager'
import { allowMediaPaths } from './media'
import { toInputPeer } from './peer'

const log = createLogger('posting')

export function parseMedia(post: Post): MediaItem[] {
  if (!post.media_json) return []
  try {
    const arr = JSON.parse(post.media_json)
    return Array.isArray(arr) ? (arr as MediaItem[]) : []
  } catch {
    return []
  }
}

function targetViews(postId: number): TargetView[] {
  const rows = getDb()
    .prepare(
      `SELECT t.*, c.title AS channel_title, c.username AS channel_username, c.type AS channel_type,
              c.account_id AS account_id
       FROM post_targets t JOIN channels c ON c.id = t.channel_id
       WHERE t.post_id = ? ORDER BY t.id`
    )
    .all(postId) as (PostTarget & {
    channel_title: string
    channel_username: string | null
    channel_type: 'channel' | 'group'
    account_id: number
  })[]
  return rows.map((r) => ({ ...r, avatarUrl: avatarUrl('channel', r.channel_id) }))
}

export function getDetail(id: number): PostDetail {
  const post = postsRepo.getById(id)
  if (!post) throw new AppError('NOT_FOUND', 'Post topilmadi.')
  const media = parseMedia(post)
  allowMediaPaths(media)
  return { post, targets: targetViews(id), media }
}

export function emitPostChanged(id: number): PostDetail {
  const d = getDetail(id)
  broadcast('posts:changed', d)
  return d
}

export function listPosts(f: PostFilter): PostDetail[] {
  const conds: string[] = []
  const params: Record<string, unknown> = { limit: f.limit ?? 200 }
  if (f.status) {
    conds.push('p.status = @status')
    params.status = f.status
  }
  if (f.channelId) {
    conds.push('EXISTS (SELECT 1 FROM post_targets t WHERE t.post_id = p.id AND t.channel_id = @channelId)')
    params.channelId = f.channelId
  }
  if (f.from) {
    conds.push(`COALESCE((SELECT MIN(scheduled_at) FROM post_targets t WHERE t.post_id = p.id), p.created_at) >= @from`)
    params.from = f.from
  }
  if (f.to) {
    conds.push(`COALESCE((SELECT MIN(scheduled_at) FROM post_targets t WHERE t.post_id = p.id), p.created_at) <= @to`)
    params.to = f.to
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const posts = getDb()
    .prepare(`SELECT p.* FROM posts p ${where} ORDER BY p.updated_at DESC LIMIT @limit`)
    .all(params) as Post[]
  return posts.map((post) => {
    const media = parseMedia(post)
    allowMediaPaths(media)
    return { post, targets: targetViews(post.id), media }
  })
}

/** Nishonlar holatidan post holatini hisoblaydi. */
export function rollupStatus(postId: number): PostStatus {
  const targets = postTargetsRepo.listByPost(postId)
  let status: PostStatus
  if (targets.length === 0) status = 'draft'
  else if (targets.some((t) => t.status === 'failed')) status = 'failed'
  else if (targets.every((t) => t.status === 'sent')) status = 'sent'
  else if (targets.some((t) => t.status === 'scheduled' && t.tg_message_id)) status = 'scheduled'
  else status = 'draft'
  postsRepo.setStatus(postId, status)
  return status
}

function validateInput(input: PostInput): void {
  const text = input.text.trim()
  if (!text && input.media.length === 0) throw new AppError('POST_EMPTY', 'Matn yoki media kiriting.')
  const mediaErr = validateMediaSet(input.media)
  if (mediaErr) throw new AppError('MEDIA_INVALID', mediaErr)
  const max = input.media.length > 0 ? LIMITS.captionMax : LIMITS.textMax
  if (text.length > max) {
    throw new AppError('TEXT_TOO_LONG', `Matn ${max} belgidan oshmasligi kerak (hozir ${text.length}).`)
  }
  if (input.scheduledAt) {
    const at = Date.parse(input.scheduledAt)
    if (Number.isNaN(at)) throw new AppError('SCHEDULE_INVALID', "Rejalashtirish vaqti noto'g'ri.")
    const diff = (at - Date.now()) / 1000
    if (diff < LIMITS.scheduleMinSec) throw new AppError('SCHEDULE_TOO_SOON', "Rejalashtirish vaqti kamida 1 daqiqa keyin bo'lishi kerak.")
    if (diff > LIMITS.scheduleMaxSec) throw new AppError('SCHEDULE_TOO_FAR', "Rejalashtirish ko'pi bilan 365 kun oldindan bo'lishi mumkin.")
  }
  for (const id of input.channelIds) {
    if (!channelsRepo.getById(id)) throw new AppError('NOT_FOUND', `Kanal topilmadi (id ${id}). Kanallarni yangilang.`)
  }
}

/**
 * Telegram'da rejalashtirilgan xabarlarni bekor qiladi (tahrirlash/o'chirishdan oldin).
 * Ulanmagan akkaunt bo'lsa AppError — foydalanuvchi avval ulashi kerak.
 */
export async function cancelScheduledOnTelegram(postId: number): Promise<void> {
  const targets = postTargetsRepo.listByPost(postId).filter((t) => t.status === 'scheduled' && t.tg_message_id)
  for (const t of targets) {
    const channel = channelsRepo.getById(t.channel_id)
    if (!channel) continue
    const client = clientManager.getClient(channel.account_id)
    try {
      await client.invoke(new Api.messages.DeleteScheduledMessages({ peer: toInputPeer(channel), id: [t.tg_message_id!] }))
      log.info(`Rejali xabar bekor qilindi: post ${postId}, kanal ${channel.title}, msg ${t.tg_message_id}`)
    } catch (e) {
      // Allaqachon chiqib ketgan yoki o'chirilgan bo'lishi mumkin — to'xtatmaymiz
      log.warn(`Rejali xabarni bekor qilib bo'lmadi (post ${postId}, msg ${t.tg_message_id})`, e)
    }
  }
}

export async function savePost(input: PostInput): Promise<PostDetail> {
  validateInput(input)
  const text = input.text.trim()
  const mediaJson = input.media.length ? JSON.stringify(input.media) : null

  let id: number
  if (input.id) {
    const existing = postsRepo.getById(input.id)
    if (!existing) throw new AppError('NOT_FOUND', 'Post topilmadi.')
    if (existing.status === 'sent') {
      throw new AppError('POST_ALREADY_SENT', "Yuborilgan postni tahrirlab bo'lmaydi. Dublikat qiling.")
    }
    // Telegram'da turgan rejali nusxalarni avval bekor qilamiz
    await cancelScheduledOnTelegram(input.id)
    postsRepo.update(input.id, { title: input.title, text, media_json: mediaJson })
    id = input.id
  } else {
    id = postsRepo.create({ title: input.title, text, media_json: mediaJson }).id
  }

  postTargetsRepo.replaceForPost(id, input.channelIds, input.scheduledAt)
  rollupStatus(id)
  allowMediaPaths(input.media)
  return emitPostChanged(id)
}

export async function deletePost(id: number): Promise<void> {
  const post = postsRepo.getById(id)
  if (!post) return
  await cancelScheduledOnTelegram(id)
  postsRepo.remove(id)
  log.info(`Post o'chirildi: ${id}`)
}

export function duplicatePost(id: number): PostDetail {
  const src = getDetail(id)
  const copy = postsRepo.create({
    title: src.post.title ? `${src.post.title} (nusxa)` : '',
    text: src.post.text,
    media_json: src.post.media_json
  })
  postTargetsRepo.replaceForPost(
    copy.id,
    src.targets.map((t) => t.channel_id),
    null
  )
  return getDetail(copy.id)
}

/**
 * Kalendardan sudrab vaqtni o'zgartirish. Telegram'da turgan rejali xabarlar o'chiriladi,
 * nishonlar yangi vaqt bilan pending bo'ladi; avval Telegram'da bo'lgan bo'lsa darhol qayta
 * rejalanadi (sendPost), aks holda (qoralama) faqat vaqt yangilanadi.
 */
export async function reschedulePost(id: number, scheduledAt: string): Promise<PostDetail> {
  const post = postsRepo.getById(id)
  if (!post) throw new AppError('NOT_FOUND', 'Post topilmadi.')
  if (post.status === 'sent') throw new AppError('POST_ALREADY_SENT', "Yuborilgan postning vaqtini o'zgartirib bo'lmaydi.")
  const at = Date.parse(scheduledAt)
  if (Number.isNaN(at)) throw new AppError('SCHEDULE_INVALID', "Vaqt noto'g'ri.")
  const diff = (at - Date.now()) / 1000
  if (diff < LIMITS.scheduleMinSec) throw new AppError('SCHEDULE_TOO_SOON', "Vaqt kamida 1 daqiqa keyin bo'lishi kerak.")
  if (diff > LIMITS.scheduleMaxSec) throw new AppError('SCHEDULE_TOO_FAR', "Ko'pi bilan 365 kun oldindan.")

  const targets = postTargetsRepo.listByPost(id)
  const wasOnTelegram = targets.some((t) => t.status === 'scheduled' && t.tg_message_id)
  await cancelScheduledOnTelegram(id)
  getDb()
    .prepare(
      `UPDATE post_targets SET scheduled_at = ?, status = 'pending', tg_message_id = NULL, error = NULL
       WHERE post_id = ? AND status != 'sent'`
    )
    .run(new Date(at).toISOString(), id)
  rollupStatus(id)
  log.info(`Post ${id} vaqti o'zgartirildi → ${new Date(at).toISOString()}${wasOnTelegram ? ' (Telegram\'da qayta rejalanadi)' : ''}`)

  if (wasOnTelegram) {
    const { sendPost } = await import('./send')
    return sendPost(id)
  }
  return emitPostChanged(id)
}
