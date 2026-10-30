import type { Contact } from '@shared/types'
import { getDb } from '../index'

export const contactsRepo = {
  get(accountId: number, peerId: string): Contact | undefined {
    return getDb().prepare('SELECT * FROM contacts WHERE account_id = ? AND peer_id = ?').get(accountId, peerId) as Contact | undefined
  },

  /** Ism/username yangilanadi, eslatma saqlanadi (bo'lsa). */
  upsert(c: { account_id: number; peer_id: string; title: string; username: string | null; kind: string; note?: string }): Contact {
    const db = getDb()
    db.prepare(
      `INSERT INTO contacts (account_id, peer_id, title, username, kind, note)
       VALUES (@account_id, @peer_id, @title, @username, @kind, COALESCE(@note, ''))
       ON CONFLICT(account_id, peer_id) DO UPDATE SET
         title = excluded.title, username = excluded.username, kind = excluded.kind,
         note = COALESCE(@note, contacts.note), updated_at = datetime('now')`
    ).run({ ...c, note: c.note ?? null })
    return this.get(c.account_id, c.peer_id)!
  },

  setNote(accountId: number, peerId: string, note: string): void {
    getDb().prepare(`UPDATE contacts SET note = ?, updated_at = datetime('now') WHERE account_id = ? AND peer_id = ?`).run(note, accountId, peerId)
  },

  /** Teg yoki eslatmasi bor kontaktlar (Kontaktlar tabi). */
  list(accountId?: number, tagId?: number, search?: string): Contact[] {
    const conds: string[] = ['(c.note != \'\' OR EXISTS (SELECT 1 FROM contact_tags t WHERE t.account_id = c.account_id AND t.peer_id = c.peer_id))']
    const p: Record<string, unknown> = {}
    if (accountId) {
      conds.push('c.account_id = @accountId')
      p.accountId = accountId
    }
    if (tagId) {
      conds.push('EXISTS (SELECT 1 FROM contact_tags t WHERE t.account_id = c.account_id AND t.peer_id = c.peer_id AND t.tag_id = @tagId)')
      p.tagId = tagId
    }
    if (search) {
      conds.push('(c.title LIKE @q OR c.username LIKE @q OR c.note LIKE @q)')
      p.q = `%${search}%`
    }
    return getDb().prepare(`SELECT c.* FROM contacts c WHERE ${conds.join(' AND ')} ORDER BY c.updated_at DESC LIMIT 1000`).all(p) as Contact[]
  }
}
