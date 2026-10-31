import type { Migration } from './index'

/**
 * Tayyor xabarlar (shablonlar), qora ro'yxat, akkaunt kampaniyalari (faqat mavjud chatlarga),
 * yuborish jurnali (kunlik limit va "faqat yangilarga" uchun).
 */
export const migration004: Migration = {
  version: 4,
  name: 'outreach',
  up(db) {
    db.exec(`
      CREATE TABLE templates (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL,
        text         TEXT    NOT NULL DEFAULT '',
        media_json   TEXT,
        buttons_json TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE blacklist (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_user_id TEXT    NOT NULL UNIQUE,
        username   TEXT,
        title      TEXT    NOT NULL DEFAULT '',
        reason     TEXT    NOT NULL DEFAULT '',
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE campaigns (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT    NOT NULL DEFAULT '',
        account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        text          TEXT    NOT NULL DEFAULT '',
        media_json    TEXT,
        settings_json TEXT    NOT NULL DEFAULT '{}',
        status        TEXT    NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','scheduled','running','paused','done','cancelled','failed')),
        total         INTEGER NOT NULL DEFAULT 0,
        sent          INTEGER NOT NULL DEFAULT 0,
        failed        INTEGER NOT NULL DEFAULT 0,
        skipped       INTEGER NOT NULL DEFAULT 0,
        last_error    TEXT,
        scheduled_at  TEXT,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        finished_at   TEXT
      );

      CREATE TABLE campaign_recipients (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        peer_id     TEXT    NOT NULL,
        title       TEXT    NOT NULL DEFAULT '',
        username    TEXT,
        status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
        error       TEXT,
        sent_at     TEXT,
        UNIQUE (campaign_id, peer_id)
      );
      CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);

      CREATE TABLE send_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        peer_id    TEXT    NOT NULL,
        source     TEXT    NOT NULL CHECK (source IN ('campaign','api')),
        sent_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_send_log_account_time ON send_log(account_id, sent_at);
      CREATE INDEX idx_send_log_peer ON send_log(account_id, peer_id);
    `)
  }
}
