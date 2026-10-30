import type { Account, AccountStatus, PublicAccount } from '@shared/types'
import { getDb } from '../index'

const PUBLIC_COLS = 'id, phone, username, first_name, tg_user_id, status, created_at'

export interface NewAccount {
  phone: string
  username?: string | null
  first_name?: string | null
  tg_user_id?: string | null
  session_encrypted: Buffer
}

export const accountsRepo = {
  /** Renderer uchun: sessiyasiz ro'yxat. */
  listPublic(): PublicAccount[] {
    return getDb().prepare(`SELECT ${PUBLIC_COLS} FROM accounts ORDER BY created_at`).all() as PublicAccount[]
  },

  listActive(): Account[] {
    return getDb().prepare(`SELECT * FROM accounts WHERE status = 'active' ORDER BY created_at`).all() as Account[]
  },

  getById(id: number): Account | undefined {
    return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined
  },

  getByPhone(phone: string): Account | undefined {
    return getDb().prepare('SELECT * FROM accounts WHERE phone = ?').get(phone) as Account | undefined
  },

  /** Telefon bo'yicha bor bo'lsa yangilaydi, bo'lmasa qo'shadi. */
  upsert(a: NewAccount): PublicAccount {
    const db = getDb()
    db.prepare(
      `INSERT INTO accounts (phone, username, first_name, tg_user_id, session_encrypted, status)
       VALUES (@phone, @username, @first_name, @tg_user_id, @session_encrypted, 'active')
       ON CONFLICT(phone) DO UPDATE SET
         username = excluded.username,
         first_name = excluded.first_name,
         tg_user_id = excluded.tg_user_id,
         session_encrypted = excluded.session_encrypted,
         status = 'active'`
    ).run({
      phone: a.phone,
      username: a.username ?? null,
      first_name: a.first_name ?? null,
      tg_user_id: a.tg_user_id ?? null,
      session_encrypted: a.session_encrypted
    })
    return db.prepare(`SELECT ${PUBLIC_COLS} FROM accounts WHERE phone = ?`).get(a.phone) as PublicAccount
  },

  updateProfile(id: number, p: { username?: string | null; first_name?: string | null }): void {
    getDb()
      .prepare('UPDATE accounts SET username = COALESCE(?, username), first_name = COALESCE(?, first_name) WHERE id = ?')
      .run(p.username ?? null, p.first_name ?? null, id)
  },

  setStatus(id: number, status: AccountStatus): void {
    getDb().prepare('UPDATE accounts SET status = ? WHERE id = ?').run(status, id)
  },

  /** Chiqish: sessiya o'chiriladi, status logged_out. */
  clearSession(id: number): void {
    getDb().prepare(`UPDATE accounts SET session_encrypted = NULL, status = 'logged_out' WHERE id = ?`).run(id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id)
  },

  count(): number {
    return (getDb().prepare('SELECT COUNT(*) AS c FROM accounts').get() as { c: number }).c
  }
}
