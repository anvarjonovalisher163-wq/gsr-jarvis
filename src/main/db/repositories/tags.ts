import type { ContactTag, Tag } from '@shared/types'
import { getDb } from '../index'

export const tagsRepo = {
  list(): Tag[] {
    return getDb().prepare('SELECT * FROM tags ORDER BY name').all() as Tag[]
  },

  getById(id: number): Tag | undefined {
    return getDb().prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | undefined
  },

  create(name: string, color: string): Tag {
    const res = getDb().prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name.trim(), color)
    return this.getById(Number(res.lastInsertRowid))!
  },

  update(id: number, p: { name?: string; color?: string }): Tag | undefined {
    getDb()
      .prepare('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?')
      .run(p.name?.trim() ?? null, p.color ?? null, id)
    return this.getById(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM tags WHERE id = ?').run(id)
  },

  // --- contact_tags: akkaunt + peer (chat) uchun teglar ---

  listForPeer(accountId: number, peerId: string): Tag[] {
    return getDb()
      .prepare(
        `SELECT t.* FROM tags t
         JOIN contact_tags ct ON ct.tag_id = t.id
         WHERE ct.account_id = ? AND ct.peer_id = ? ORDER BY t.name`
      )
      .all(accountId, peerId) as Tag[]
  },

  /** Teg bo'yicha filtr: shu tegli peer id'lar. */
  peersWithTag(accountId: number, tagId: number): string[] {
    return (
      getDb()
        .prepare('SELECT peer_id FROM contact_tags WHERE account_id = ? AND tag_id = ?')
        .all(accountId, tagId) as { peer_id: string }[]
    ).map((r) => r.peer_id)
  },

  /** Akkauntdagi barcha peer→teglar xaritasi (dialoglar ro'yxatini bezash uchun). */
  mapForAccount(accountId: number): Record<string, number[]> {
    const rows = getDb()
      .prepare('SELECT peer_id, tag_id FROM contact_tags WHERE account_id = ?')
      .all(accountId) as ContactTag[]
    const map: Record<string, number[]> = {}
    for (const r of rows) (map[r.peer_id] ??= []).push(r.tag_id)
    return map
  },

  attach(accountId: number, peerId: string, tagId: number): void {
    getDb()
      .prepare('INSERT OR IGNORE INTO contact_tags (account_id, peer_id, tag_id) VALUES (?, ?, ?)')
      .run(accountId, peerId, tagId)
  },

  detach(accountId: number, peerId: string, tagId: number): void {
    getDb()
      .prepare('DELETE FROM contact_tags WHERE account_id = ? AND peer_id = ? AND tag_id = ?')
      .run(accountId, peerId, tagId)
  }
}
