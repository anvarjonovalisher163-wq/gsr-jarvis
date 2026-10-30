import type { Bot, PublicBot } from '@shared/types'
import { getDb } from '../index'

const PUBLIC_COLS = 'id, username, title, is_running, created_at'

export const botsRepo = {
  listPublic(): PublicBot[] {
    return getDb().prepare(`SELECT ${PUBLIC_COLS} FROM bots ORDER BY created_at`).all() as PublicBot[]
  },

  listRunning(): Bot[] {
    return getDb().prepare('SELECT * FROM bots WHERE is_running = 1').all() as Bot[]
  },

  getById(id: number): Bot | undefined {
    return getDb().prepare('SELECT * FROM bots WHERE id = ?').get(id) as Bot | undefined
  },

  upsert(b: { username: string; title: string; token_encrypted: Buffer }): PublicBot {
    const db = getDb()
    db.prepare(
      `INSERT INTO bots (username, title, token_encrypted)
       VALUES (@username, @title, @token_encrypted)
       ON CONFLICT(username) DO UPDATE SET title = excluded.title, token_encrypted = excluded.token_encrypted`
    ).run(b)
    return db.prepare(`SELECT ${PUBLIC_COLS} FROM bots WHERE username = ?`).get(b.username) as PublicBot
  },

  setRunning(id: number, running: boolean): void {
    getDb().prepare('UPDATE bots SET is_running = ? WHERE id = ?').run(running ? 1 : 0, id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM bots WHERE id = ?').run(id)
  },

  count(): number {
    return (getDb().prepare('SELECT COUNT(*) AS c FROM bots').get() as { c: number }).c
  }
}
