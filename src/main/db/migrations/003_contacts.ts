import type { Migration } from './index'

/**
 * Kontakt kartasi: chat (akkaunt + peer) uchun ism/username nusxasi va eslatma.
 * Teglar contact_tags da (001). Ism saqlanishi — Kontaktlar tabida chatga ulanmasdan ko'rsatish uchun.
 */
export const migration003: Migration = {
  version: 3,
  name: 'contacts',
  up(db) {
    db.exec(`
      CREATE TABLE contacts (
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        peer_id    TEXT    NOT NULL,
        title      TEXT    NOT NULL DEFAULT '',
        username   TEXT,
        kind       TEXT    NOT NULL DEFAULT 'user',
        note       TEXT    NOT NULL DEFAULT '',
        updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (account_id, peer_id)
      );
    `)
  }
}
