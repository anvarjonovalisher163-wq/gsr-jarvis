import bigInt from 'big-integer'
import { Api } from 'telegram'
import type { Channel } from '@shared/types'
import { AppError } from '../../errors'

/** Bazadagi kanal yozuvidan InputPeer. access_hash bo'lmasa sinxronlash kerak. */
export function toInputPeer(channel: Channel): Api.InputPeerChannel {
  if (!channel.access_hash) {
    throw new AppError('CHANNEL_NO_ACCESS_HASH', `"${channel.title}" uchun kirish kaliti yo'q — kanallarni yangilang.`)
  }
  return new Api.InputPeerChannel({
    channelId: bigInt(channel.tg_id),
    accessHash: bigInt(channel.access_hash)
  })
}
