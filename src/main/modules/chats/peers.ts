import bigInt from 'big-integer'
import { Api, type TelegramClient } from 'telegram'
import type { Entity } from 'telegram/define'
import type { ChatKind, PeerKey } from '@shared/chats'
import { AppError } from '../../errors'

/**
 * Peer kaliti ↔ Telegram entity/InputPeer.
 * u<id> — foydalanuvchi/bot, c<id> — oddiy guruh, ch<id> — kanal/supergruppa.
 * InputPeer'lar (access_hash bilan) akkaunt bo'yicha xotirada keshlanadi; kesh bo'lmasa
 * GramJS'ning o'z sessiya keshidan (oxirgi getDialogs) olinadi.
 */
const inputPeers = new Map<number, Map<PeerKey, Api.TypeInputPeer>>()
const entities = new Map<number, Map<PeerKey, Entity>>()

export function peerKeyOf(peer: Api.TypePeer): PeerKey {
  if (peer instanceof Api.PeerUser) return `u${peer.userId.toString()}`
  if (peer instanceof Api.PeerChat) return `c${peer.chatId.toString()}`
  return `ch${(peer as Api.PeerChannel).channelId.toString()}`
}

export function peerKeyOfEntity(e: Entity): PeerKey {
  if (e instanceof Api.User) return `u${e.id.toString()}`
  if (e instanceof Api.Chat || e instanceof Api.ChatForbidden) return `c${e.id.toString()}`
  return `ch${e.id.toString()}`
}

export function kindOfEntity(e: Entity | undefined): ChatKind {
  if (!e) return 'user'
  if (e instanceof Api.User) return e.bot ? 'bot' : 'user'
  if (e instanceof Api.Chat || e instanceof Api.ChatForbidden) return 'group'
  if (e instanceof Api.Channel) return e.megagroup ? 'group' : 'channel'
  return 'channel'
}

export function remember(accountId: number, key: PeerKey, input: Api.TypeInputPeer, entity?: Entity): void {
  let m = inputPeers.get(accountId)
  if (!m) inputPeers.set(accountId, (m = new Map()))
  m.set(key, input)
  if (entity) {
    let em = entities.get(accountId)
    if (!em) entities.set(accountId, (em = new Map()))
    em.set(key, entity)
  }
}

export function forgetAccount(accountId: number): void {
  inputPeers.delete(accountId)
  entities.delete(accountId)
}

export function cachedEntity(accountId: number, key: PeerKey): Entity | undefined {
  return entities.get(accountId)?.get(key)
}

/** Kalitdan GramJS "marked id" (guruhlar manfiy, kanallar -100…). */
function markedId(key: PeerKey): bigInt.BigInteger {
  const m = /^(u|c|ch)(\d+)$/.exec(key)
  if (!m) throw new AppError('BAD_REQUEST', "Peer kaliti noto'g'ri.")
  const id = bigInt(m[2])
  if (m[1] === 'u') return id
  if (m[1] === 'c') return id.negate()
  return bigInt('-100' + m[2])
}

export async function inputPeerFor(client: TelegramClient, accountId: number, key: PeerKey): Promise<Api.TypeInputPeer> {
  const cached = inputPeers.get(accountId)?.get(key)
  if (cached) return cached
  try {
    const input = await client.getInputEntity(markedId(key))
    remember(accountId, key, input)
    return input
  } catch {
    throw new AppError('PEER_UNKNOWN', "Chat topilmadi — dialoglar ro'yxatini yangilang.")
  }
}
