import type { Campaign, CampaignRecipient, CampaignStatus } from '@shared/types'
import { getDb } from '../index'

export const campaignsRepo = {
  list(accountId?: number): Campaign[] {
    const db = getDb()
    return accountId === undefined
      ? (db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all() as Campaign[])
      : (db
          .prepare('SELECT * FROM campaigns WHERE account_id = ? ORDER BY created_at DESC')
          .all(accountId) as Campaign[])
  },
  getById(id: number): Campaign | undefined {
    return getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Campaign | undefined
  },
  create(c: {
    name: string
    account_id: number
    text: string
    media_json: string | null
    settings_json: string
    scheduled_at: string | null
  }): Campaign {
    const res = getDb()
      .prepare(
        `INSERT INTO campaigns (name, account_id, text, media_json, settings_json, status, scheduled_at)
         VALUES (@name, @account_id, @text, @media_json, @settings_json, 'draft', @scheduled_at)`
      )
      .run(c)
    return this.getById(Number(res.lastInsertRowid))!
  },
  update(
    id: number,
    c: {
      name: string
      text: string
      media_json: string | null
      settings_json: string
      scheduled_at: string | null
    }
  ): void {
    getDb()
      .prepare(
        `UPDATE campaigns SET name = @name, text = @text, media_json = @media_json, settings_json = @settings_json, scheduled_at = @scheduled_at WHERE id = @id`
      )
      .run({ ...c, id })
  },
  setStatus(id: number, status: CampaignStatus, lastError: string | null = null): void {
    const finished = status === 'done' || status === 'cancelled' || status === 'failed'
    getDb()
      .prepare(
        `UPDATE campaigns SET status = ?, last_error = ?, finished_at = ${finished ? "datetime('now')" : 'finished_at'} WHERE id = ?`
      )
      .run(status, lastError, id)
  },
  recount(id: number): void {
    getDb()
      .prepare(
        `UPDATE campaigns SET
           total   = (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = campaigns.id),
           sent    = (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = campaigns.id AND r.status = 'sent'),
           failed  = (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = campaigns.id AND r.status = 'failed'),
           skipped = (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = campaigns.id AND r.status = 'skipped')
         WHERE id = ?`
      )
      .run(id)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM campaigns WHERE id = ?').run(id)
  },
  /** Yarim qolgan yoki rejali kampaniyalar. */
  listResumable(): Campaign[] {
    return getDb()
      .prepare(
        `SELECT * FROM campaigns WHERE status IN ('running','scheduled') ORDER BY created_at`
      )
      .all() as Campaign[]
  },

  // --- qabul qiluvchilar ---
  replaceRecipients(
    campaignId: number,
    list: { peer_id: string; title: string; username: string | null }[]
  ): void {
    const db = getDb()
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM campaign_recipients WHERE campaign_id = ?').run(campaignId)
      const ins = db.prepare(
        'INSERT OR IGNORE INTO campaign_recipients (campaign_id, peer_id, title, username) VALUES (?, ?, ?, ?)'
      )
      for (const r of list) ins.run(campaignId, r.peer_id, r.title, r.username)
    })
    tx()
    this.recount(campaignId)
  },
  recipients(campaignId: number, status?: CampaignRecipient['status']): CampaignRecipient[] {
    const db = getDb()
    return status
      ? (db
          .prepare(
            'SELECT * FROM campaign_recipients WHERE campaign_id = ? AND status = ? ORDER BY id'
          )
          .all(campaignId, status) as CampaignRecipient[])
      : (db
          .prepare('SELECT * FROM campaign_recipients WHERE campaign_id = ? ORDER BY id')
          .all(campaignId) as CampaignRecipient[])
  },
  markRecipient(
    id: number,
    status: CampaignRecipient['status'],
    error: string | null = null
  ): void {
    getDb()
      .prepare(
        `UPDATE campaign_recipients SET status = ?, error = ?, sent_at = ${status === 'sent' ? "datetime('now')" : 'sent_at'} WHERE id = ?`
      )
      .run(status, error, id)
  }
}
