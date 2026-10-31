import type Database from 'better-sqlite3'
import { migration001 } from './001_init'
import { migration002 } from './002_broadcast_deliveries'
import { migration003 } from './003_contacts'
import { migration004 } from './004_outreach'

export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

/** Versiya tartibida. Yangi migratsiya — oxiriga qo'shiladi, mavjudlari o'zgartirilmaydi. */
export const migrations: Migration[] = [migration001, migration002, migration003, migration004]

/**
 * schema_version jadvali orqali qo'llanmagan migratsiyalarni tranzaksiyada bajaradi.
 * Joriy versiyani qaytaradi.
 */
export function runMigrations(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as {
    v: number | null
  }
  let current = row.v ?? 0

  const insert = db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)')

  for (const m of migrations) {
    if (m.version <= current) continue
    const apply = db.transaction(() => {
      m.up(db)
      insert.run(m.version, m.name)
    })
    apply()
    current = m.version
  }

  return current
}
