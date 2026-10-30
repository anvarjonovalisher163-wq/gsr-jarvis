import { Api } from 'telegram'
import type { ChannelSyncResult, ChannelView } from '@shared/ipc'
import type { Channel } from '@shared/types'
import { accountsRepo, channelsRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { clientManager } from '../accounts/clientManager'
import { mapTelegramError } from '../accounts/errors'
import { avatarUrl, deleteAvatar, downloadAvatar } from '../accounts/avatars'
import { withTimeout } from '../../utils/timeout'

const log = createLogger('channels')

/** getDialogs katta akkauntlarda sekin — alohida kengroq chegara. */
const DIALOGS_TIMEOUT_MS = 90_000

/** Bir sinxronlashda nechta yangi avatar yuklanadi (FLOOD_WAIT'dan saqlanish uchun). */
const MAX_AVATAR_DOWNLOADS = 40

export function toChannelView(c: Channel): ChannelView {
  return { ...c, avatarUrl: avatarUrl('channel', c.id) }
}

export function listChannelViews(accountId?: number): ChannelView[] {
  return channelsRepo.list(accountId).map(toChannelView)
}

/**
 * Post yozish huquqi bormi?
 * - kanal (broadcast): creator yoki adminRights.postMessages
 * - supergruppa (megagroup): creator yoki har qanday admin huquqi
 * Oddiy a'zolik hisobga olinmaydi — faqat foydalanuvchi boshqaradigan joylar.
 */
function canPost(ch: Api.Channel): boolean {
  if (ch.left) return false
  if (ch.creator) return true
  if (!ch.adminRights) return false
  return ch.broadcast ? ch.adminRights.postMessages === true : true
}

/**
 * Akkaunt dialoglarini o'qib, admin bo'lgan kanal/supergruppalarni channels jadvaliga yozadi.
 * Ro'yxatdan chiqib ketganlar (endi admin emas) o'chiriladi. Avatarlar keshlanadi.
 */
export async function syncChannels(accountId: number): Promise<ChannelSyncResult> {
  const account = accountsRepo.getById(accountId)
  if (!account) throw new AppError('NOT_FOUND', 'Akkaunt topilmadi.')
  const client = clientManager.getClient(accountId)

  let dialogs
  try {
    dialogs = await withTimeout(
      client.getDialogs({ limit: 1000 }),
      DIALOGS_TIMEOUT_MS,
      'NETWORK',
      "Dialoglar ro'yxatini olib bo'lmadi: Telegram javob bermadi."
    )
  } catch (e) {
    throw mapTelegramError(e)
  }

  const found: Api.Channel[] = []
  let scanned = 0
  for (const d of dialogs) {
    const e = d.entity
    if (!(e instanceof Api.Channel)) continue
    scanned++
    if (canPost(e)) found.push(e)
  }

  const before = new Map(channelsRepo.list(accountId).map((c) => [c.tg_id, c]))
  const saved: Channel[] = []
  let downloads = 0

  for (const ch of found) {
    const row = channelsRepo.upsert({
      account_id: accountId,
      tg_id: ch.id.toString(),
      access_hash: ch.accessHash?.toString() ?? null,
      title: ch.title,
      username: ch.username ?? null,
      type: ch.broadcast ? 'channel' : 'group',
      is_admin: true
    })
    saved.push(row)

    // Avatar: faqat hali keshlanmagan yoki yangi kanal uchun yuklaymiz
    if (downloads < MAX_AVATAR_DOWNLOADS && !avatarUrl('channel', row.id)) {
      downloads++
      await downloadAvatar(client, ch, 'channel', row.id)
    }
  }

  // Endi admin bo'lmagan / chiqib ketilgan kanallar
  const keep = saved.map((c) => c.tg_id)
  for (const [tgId, old] of before) {
    if (!keep.includes(tgId)) deleteAvatar('channel', old.id)
  }
  const removed = channelsRepo.removeMissing(accountId, keep)

  log.info(
    `Akkaunt ${accountId}: ${scanned} ta kanal/guruh ko'rildi, ${saved.length} tasida post huquqi bor, ${removed} ta o'chirildi`
  )
  return { channels: listChannelViews(accountId), scanned }
}
