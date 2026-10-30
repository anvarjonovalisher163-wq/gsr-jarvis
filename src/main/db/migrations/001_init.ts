import type { Migration } from './index'

export const migration001: Migration = {
  version: 1,
  name: 'init',
  up(db) {
    db.exec(`
      CREATE TABLE accounts (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        phone             TEXT    NOT NULL UNIQUE,
        username          TEXT,
        first_name        TEXT,
        tg_user_id        TEXT,
        session_encrypted BLOB,
        status            TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','logged_out','banned')),
        created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE bots (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        token_encrypted BLOB    NOT NULL,
        username        TEXT    NOT NULL UNIQUE,
        title           TEXT    NOT NULL,
        is_running      INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE channels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        tg_id       TEXT    NOT NULL,
        access_hash TEXT,
        title       TEXT    NOT NULL,
        username    TEXT,
        type        TEXT    NOT NULL CHECK (type IN ('channel','group')),
        is_admin    INTEGER NOT NULL DEFAULT 0,
        photo_path  TEXT,
        synced_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE (account_id, tg_id)
      );

      CREATE TABLE posts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT    NOT NULL DEFAULT '',
        text         TEXT    NOT NULL DEFAULT '',
        media_json   TEXT,
        buttons_json TEXT,
        status       TEXT    NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','sent','failed')),
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE post_targets (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id       INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        channel_id    INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        scheduled_at  TEXT,
        sent_at       TEXT,
        tg_message_id INTEGER,
        status        TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','scheduled','sent','failed')),
        error         TEXT
      );
      CREATE INDEX idx_post_targets_post ON post_targets(post_id);
      CREATE INDEX idx_post_targets_sched ON post_targets(status, scheduled_at);

      CREATE TABLE bot_subscribers (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id          INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        tg_user_id      TEXT    NOT NULL,
        username        TEXT,
        first_name      TEXT,
        subscribed_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        unsubscribed_at TEXT,
        tags            TEXT,
        UNIQUE (bot_id, tg_user_id)
      );
      CREATE INDEX idx_bot_subscribers_active ON bot_subscribers(bot_id, unsubscribed_at);

      CREATE TABLE bot_rules (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id             INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        trigger_type       TEXT    NOT NULL CHECK (trigger_type IN ('command','keyword','any')),
        trigger_value      TEXT,
        reply_text         TEXT    NOT NULL,
        reply_media_json   TEXT,
        reply_buttons_json TEXT,
        is_active          INTEGER NOT NULL DEFAULT 1,
        sort_order         INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE broadcasts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id       INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        text         TEXT    NOT NULL,
        media_json   TEXT,
        buttons_json TEXT,
        tag_filter   TEXT,
        status       TEXT    NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','running','paused','done','cancelled','failed')),
        total        INTEGER NOT NULL DEFAULT 0,
        sent         INTEGER NOT NULL DEFAULT 0,
        failed       INTEGER NOT NULL DEFAULT 0,
        scheduled_at TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        finished_at  TEXT
      );

      CREATE TABLE tags (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        name  TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#2f7cff'
      );

      CREATE TABLE contact_tags (
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        peer_id    TEXT    NOT NULL,
        tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (account_id, peer_id, tag_id)
      );

      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE logs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        level      TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
        module     TEXT NOT NULL,
        message    TEXT NOT NULL,
        meta_json  TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_logs_created ON logs(created_at);
    `)
  }
}
