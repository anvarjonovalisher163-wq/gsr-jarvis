import type { BlacklistInput } from '@shared/outreach'
import type { BlacklistEntry } from '@shared/types'
import { blacklistRepo } from '../../db/repositories'
import { createLogger } from '../../logger'

const log = createLogger('blacklist')

export function addToBlacklist(input: BlacklistInput): BlacklistEntry {
  const tgUserId = input.tgUserId.replace(/^u/, '')
  const e = blacklistRepo.add({
    tg_user_id: tgUserId,
    username: input.username,
    title: input.title.trim(),
    reason: input.reason.trim()
  })
  log.info(`Qora ro'yxatga qo'shildi: ${tgUserId} ${input.username ? '@' + input.username : ''}`)
  return e
}

/** Peer kaliti (u<id>) yoki tg id qora ro'yxatdami. */
export function isBlacklisted(peerOrId: string): boolean {
  return blacklistRepo.has(peerOrId.replace(/^u/, ''))
}
