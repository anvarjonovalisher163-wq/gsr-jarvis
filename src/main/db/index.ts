import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { runMigrations } from './migrations'

let instance: Database.Database | null = null

export const DB_FILENAME = 'tg-manager.db'

export function dbPath(): string {
  return join(app.getPath('userData'), DB_FILENAME)
}

/**
 * Bazani ochadi (yo'q bo'lsa yaratadi), migratsiyalarni bajaradi.
 * Faqat bir marta chaqiriladi (app ready'dan keyin).
 */
export function openDatabase(): { db: Database.Database; version: number } {
  if (instance) throw new Error('DB allaqachon ochilgan')

  mkdirSync(app.getPath('userData'), { recursive: true })
  const db = new Database(dbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  const version = runMigrations(db)
  instance = db
  return { db, version }
}

/** Ochilgan bazani qaytaradi. openDatabase() dan oldin chaqirilsa xato. */
export function getDb(): Database.Database {
  if (!instance) throw new Error('DB hali ochilmagan: openDatabase() chaqirilmagan')
  return instance
}

export function closeDatabase(): void {
  instance?.close()
  instance = null
}

/** SQLite 0/1 ni boolean'ga va aksincha. */
export const toBool = (v: number | null | undefined): boolean => v === 1
export const fromBool = (v: boolean): 0 | 1 => (v ? 1 : 0)
