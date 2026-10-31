import type { Template } from '@shared/types'
import { getDb } from '../index'

export const templatesRepo = {
  list(): Template[] {
    return getDb().prepare('SELECT * FROM templates ORDER BY updated_at DESC').all() as Template[]
  },
  getById(id: number): Template | undefined {
    return getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id) as Template | undefined
  },
  create(t: {
    name: string
    text: string
    media_json: string | null
    buttons_json: string | null
  }): Template {
    const res = getDb()
      .prepare(
        'INSERT INTO templates (name, text, media_json, buttons_json) VALUES (@name, @text, @media_json, @buttons_json)'
      )
      .run(t)
    return this.getById(Number(res.lastInsertRowid))!
  },
  update(
    id: number,
    t: { name: string; text: string; media_json: string | null; buttons_json: string | null }
  ): Template | undefined {
    getDb()
      .prepare(
        `UPDATE templates SET name = @name, text = @text, media_json = @media_json, buttons_json = @buttons_json, updated_at = datetime('now') WHERE id = @id`
      )
      .run({ ...t, id })
    return this.getById(id)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM templates WHERE id = ?').run(id)
  }
}
