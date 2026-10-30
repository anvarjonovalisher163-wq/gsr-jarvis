import type { Post, PostStatus } from '@shared/types'
import { getDb } from '../index'

export interface PostInput {
  title?: string
  text: string
  media_json?: string | null
  buttons_json?: string | null
  status?: PostStatus
}

export interface PostFilter {
  status?: PostStatus
  limit?: number
  offset?: number
}

export const postsRepo = {
  list(f: PostFilter = {}): Post[] {
    const where = f.status ? 'WHERE status = @status' : ''
    return getDb()
      .prepare(`SELECT * FROM posts ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
      .all({ status: f.status ?? null, limit: f.limit ?? 100, offset: f.offset ?? 0 }) as Post[]
  },

  getById(id: number): Post | undefined {
    return getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined
  },

  create(p: PostInput): Post {
    const db = getDb()
    const r = db
      .prepare(
        `INSERT INTO posts (title, text, media_json, buttons_json, status)
         VALUES (@title, @text, @media_json, @buttons_json, @status)`
      )
      .run({
        title: p.title ?? '',
        text: p.text,
        media_json: p.media_json ?? null,
        buttons_json: p.buttons_json ?? null,
        status: p.status ?? 'draft'
      })
    return this.getById(Number(r.lastInsertRowid))!
  },

  update(id: number, p: Partial<PostInput>): Post | undefined {
    getDb()
      .prepare(
        `UPDATE posts SET
           title = COALESCE(@title, title),
           text = COALESCE(@text, text),
           media_json = CASE WHEN @media_set THEN @media_json ELSE media_json END,
           buttons_json = CASE WHEN @buttons_set THEN @buttons_json ELSE buttons_json END,
           status = COALESCE(@status, status),
           updated_at = datetime('now')
         WHERE id = @id`
      )
      .run({
        id,
        title: p.title ?? null,
        text: p.text ?? null,
        media_set: p.media_json !== undefined ? 1 : 0,
        media_json: p.media_json ?? null,
        buttons_set: p.buttons_json !== undefined ? 1 : 0,
        buttons_json: p.buttons_json ?? null,
        status: p.status ?? null
      })
    return this.getById(id)
  },

  setStatus(id: number, status: PostStatus): void {
    getDb().prepare(`UPDATE posts SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM posts WHERE id = ?').run(id)
  }
}
