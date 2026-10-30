import { handle } from '../../ipc'
import { botSubscribersRepo, contactsRepo, tagsRepo } from '../../db/repositories'
import { AppError } from '../../errors'

export function registerContactsIpc(): void {
  handle('tags:list', () => tagsRepo.list())
  handle('tags:create', (_e, { name, color }) => {
    if (tagsRepo.list().some((t) => t.name.toLowerCase() === name.trim().toLowerCase())) {
      throw new AppError('TAG_EXISTS', 'Bunday teg allaqachon bor.')
    }
    return tagsRepo.create(name, color)
  })
  handle('tags:update', (_e, { id, name, color }) => {
    const t = tagsRepo.update(id, { name, color })
    if (!t) throw new AppError('NOT_FOUND', 'Teg topilmadi.')
    return t
  })
  handle('tags:delete', (_e, { id }) => tagsRepo.remove(id))

  handle('contacts:get', (_e, { accountId, peer }) => ({
    contact: contactsRepo.get(accountId, peer) ?? null,
    tagIds: tagsRepo.listForPeer(accountId, peer).map((t) => t.id)
  }))

  handle('contacts:setTags', (_e, { accountId, peer, title, username, kind, tagIds }) => {
    contactsRepo.upsert({ account_id: accountId, peer_id: peer, title, username, kind })
    const current = new Set(tagsRepo.listForPeer(accountId, peer).map((t) => t.id))
    const wanted = new Set(tagIds)
    for (const id of current) if (!wanted.has(id)) tagsRepo.detach(accountId, peer, id)
    for (const id of wanted) if (!current.has(id)) tagsRepo.attach(accountId, peer, id)
  })

  handle('contacts:setNote', (_e, { accountId, peer, title, username, kind, note }) => {
    contactsRepo.upsert({ account_id: accountId, peer_id: peer, title, username, kind, note })
  })

  handle('contacts:tagMap', (_e, { accountId }) => tagsRepo.mapForAccount(accountId))

  handle('contacts:list', (_e, { accountId, tagId, search }) =>
    contactsRepo.list(accountId, tagId, search).map((c) => ({ ...c, tagIds: tagsRepo.listForPeer(c.account_id, c.peer_id).map((t) => t.id) }))
  )

  handle('subscribers:setTags', (_e, { id, tags }) => {
    botSubscribersRepo.setTags(id, tags.map((t) => t.trim().replace(/[^\w-]/g, '')).filter(Boolean))
  })
}
