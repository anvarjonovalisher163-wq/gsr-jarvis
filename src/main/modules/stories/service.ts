import { statSync } from 'fs'
import { basename, extname } from 'path'
import bigInt from 'big-integer'
import { Api } from 'telegram'
import { CustomFile } from 'telegram/client/uploads'
import type { StoryInput, StoryResult } from '@shared/outreach'
import { channelsRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { assertCanSend } from '../license/limits'
import { isAllowedMediaPath } from '../posting/media'
import { toInputPeer } from '../posting/peer'

const log = createLogger('stories')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm'
}

/**
 * Story yuborish: o'z profiliga yoki admin bo'lgan kanalga. Rasm yoki video (60s gacha).
 * Foydalanuvchi profiliga story Telegram Premium talab qiladi; kanal uchun kanal "boost" darajasi.
 */
export async function sendStory(input: StoryInput): Promise<StoryResult> {
  const client = clientManager.getClient(input.accountId)
  if (!isAllowedMediaPath(input.media.path))
    throw new AppError('FORBIDDEN', 'Faylni dialog orqali tanlang.')
  if (input.media.kind === 'document')
    throw new AppError('STORY_MEDIA', 'Story uchun faqat rasm yoki video.')
  assertCanSend(1)

  let peer: Api.TypeInputPeer
  let label = 'profil'
  if (input.channelId) {
    const ch = channelsRepo.getById(input.channelId)
    if (!ch) throw new AppError('NOT_FOUND', 'Kanal topilmadi.')
    if (ch.account_id !== input.accountId)
      throw new AppError('BAD_REQUEST', 'Kanal boshqa akkauntga tegishli.')
    peer = toInputPeer(ch)
    label = ch.title
  } else {
    peer = new Api.InputPeerSelf()
  }

  try {
    const size = statSync(input.media.path).size
    const file = await client.uploadFile({
      file: new CustomFile(basename(input.media.path), size, input.media.path),
      workers: 2
    })
    const media =
      input.media.kind === 'photo'
        ? new Api.InputMediaUploadedPhoto({ file })
        : new Api.InputMediaUploadedDocument({
            file,
            mimeType: MIME[extname(input.media.path).toLowerCase()] ?? 'video/mp4',
            attributes: [
              new Api.DocumentAttributeVideo({ duration: 0, w: 0, h: 0, supportsStreaming: true })
            ]
          })
    const privacy =
      input.privacy === 'contacts'
        ? [new Api.InputPrivacyValueAllowContacts()]
        : input.privacy === 'close'
          ? [new Api.InputPrivacyValueAllowCloseFriends()]
          : [new Api.InputPrivacyValueAllowAll()]
    const res = await client.invoke(
      new Api.stories.SendStory({
        peer,
        media,
        caption: input.caption || undefined,
        privacyRules: privacy,
        randomId: bigInt.randBetween('-1e18', '1e18'),
        period: input.periodHours * 3600,
        pinned: input.pinned,
        noforwards: false
      })
    )
    let storyId: number | null = null
    if (res instanceof Api.Updates) {
      const u = res.updates.find((x): x is Api.UpdateStory => x instanceof Api.UpdateStory)
      if (u && u.story instanceof Api.StoryItem) storyId = u.story.id
    }
    log.info(`Story yuborildi: akkaunt ${input.accountId} → ${label} (${input.periodHours}s)`)
    return { storyId, target: label }
  } catch (e) {
    const err = mapTelegramError(e)
    if (err.code === 'PREMIUM_ACCOUNT_REQUIRED')
      throw new AppError(
        err.code,
        "Profilga story joylash uchun Telegram Premium kerak. Kanalga joylashga urinib ko'ring."
      )
    if (err.code === 'BOOSTS_REQUIRED' || err.code === 'STORIES_TOO_MUCH')
      throw new AppError(err.code, "Kanal uchun yetarli boost yo'q yoki story limiti to'lgan.")
    throw err
  }
}
