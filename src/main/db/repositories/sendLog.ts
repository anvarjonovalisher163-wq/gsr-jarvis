import { getDb } from '../index'

/** Akkauntdan yuborilgan xabarlar jurnali: kunlik limit va "faqat yangilarga" uchun. */
export const sendLogRepo = {
  record(accountId: number, peerId: string, source: 'campaign' | 'api'): void {
    getDb()
      .prepare('INSERT INTO send_log (account_id, peer_id, source) VALUES (?, ?, ?)')
      .run(accountId, peerId, source)
  },
  /** Oxirgi 24 soatda akkauntdan yuborilganlar soni (kampaniya + API). */
  countLast24h(accountId: number): number {
    const r = getDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM send_log WHERE account_id = ? AND sent_at >= datetime('now', '-1 day')`
      )
      .get(accountId) as { n: number }
    return r.n
  },
  /** Bu peer'ga avval biror kampaniya/API orqali yuborilganmi. */
  everSent(accountId: number, peerId: string): boolean {
    return !!getDb()
      .prepare('SELECT 1 FROM send_log WHERE account_id = ? AND peer_id = ? LIMIT 1')
      .get(accountId, peerId)
  },
  prune(days: number): void {
    getDb().prepare(`DELETE FROM send_log WHERE sent_at < datetime('now', ?)`).run(`-${days} days`)
  }
}
