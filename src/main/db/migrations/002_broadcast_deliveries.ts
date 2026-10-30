import type { Migration } from './index'

/**
 * Rassilka yetkazilishi obunachi bo'yicha: ilova yopilib qolsa to'xtagan joyidan
 * davom etish va hisobot (yetkazildi / xato / bloklaganlar) uchun.
 */
export const migration002: Migration = {
  version: 2,
  name: 'broadcast_deliveries',
  up(db) {
    db.exec(`
      CREATE TABLE broadcast_deliveries (
        broadcast_id  INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
        subscriber_id INTEGER NOT NULL REFERENCES bot_subscribers(id) ON DELETE CASCADE,
        status        TEXT    NOT NULL CHECK (status IN ('sent','failed','blocked')),
        error         TEXT,
        sent_at       TEXT    NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (broadcast_id, subscriber_id)
      );
      CREATE INDEX idx_broadcast_deliveries_status ON broadcast_deliveries(broadcast_id, status);
    `)
  }
}
