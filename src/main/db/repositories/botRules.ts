import type { BotRule, BotRuleTrigger } from '@shared/types'
import { getDb } from '../index'

export interface BotRuleInput {
  bot_id: number
  trigger_type: BotRuleTrigger
  trigger_value?: string | null
  reply_text: string
  reply_media_json?: string | null
  reply_buttons_json?: string | null
  is_active?: boolean
  sort_order?: number
}

export const botRulesRepo = {
  list(botId: number, activeOnly = false): BotRule[] {
    return getDb()
      .prepare(
        `SELECT * FROM bot_rules WHERE bot_id = ? ${activeOnly ? 'AND is_active = 1' : ''}
         ORDER BY sort_order, id`
      )
      .all(botId) as BotRule[]
  },

  getById(id: number): BotRule | undefined {
    return getDb().prepare('SELECT * FROM bot_rules WHERE id = ?').get(id) as BotRule | undefined
  },

  create(r: BotRuleInput): BotRule {
    const res = getDb()
      .prepare(
        `INSERT INTO bot_rules (bot_id, trigger_type, trigger_value, reply_text, reply_media_json, reply_buttons_json, is_active, sort_order)
         VALUES (@bot_id, @trigger_type, @trigger_value, @reply_text, @reply_media_json, @reply_buttons_json, @is_active, @sort_order)`
      )
      .run({
        bot_id: r.bot_id,
        trigger_type: r.trigger_type,
        trigger_value: r.trigger_value ?? null,
        reply_text: r.reply_text,
        reply_media_json: r.reply_media_json ?? null,
        reply_buttons_json: r.reply_buttons_json ?? null,
        is_active: r.is_active === false ? 0 : 1,
        sort_order: r.sort_order ?? 0
      })
    return this.getById(Number(res.lastInsertRowid))!
  },

  update(id: number, r: Partial<Omit<BotRuleInput, 'bot_id'>>): BotRule | undefined {
    getDb()
      .prepare(
        `UPDATE bot_rules SET
           trigger_type = COALESCE(@trigger_type, trigger_type),
           trigger_value = CASE WHEN @tv_set THEN @trigger_value ELSE trigger_value END,
           reply_text = COALESCE(@reply_text, reply_text),
           reply_media_json = CASE WHEN @media_set THEN @reply_media_json ELSE reply_media_json END,
           reply_buttons_json = CASE WHEN @btn_set THEN @reply_buttons_json ELSE reply_buttons_json END,
           is_active = COALESCE(@is_active, is_active),
           sort_order = COALESCE(@sort_order, sort_order)
         WHERE id = @id`
      )
      .run({
        id,
        trigger_type: r.trigger_type ?? null,
        tv_set: r.trigger_value !== undefined ? 1 : 0,
        trigger_value: r.trigger_value ?? null,
        reply_text: r.reply_text ?? null,
        media_set: r.reply_media_json !== undefined ? 1 : 0,
        reply_media_json: r.reply_media_json ?? null,
        btn_set: r.reply_buttons_json !== undefined ? 1 : 0,
        reply_buttons_json: r.reply_buttons_json ?? null,
        is_active: r.is_active === undefined ? null : r.is_active ? 1 : 0,
        sort_order: r.sort_order ?? null
      })
    return this.getById(id)
  },

  setActive(id: number, active: boolean): void {
    getDb().prepare('UPDATE bot_rules SET is_active = ? WHERE id = ?').run(active ? 1 : 0, id)
  },

  remove(id: number): void {
    getDb().prepare('DELETE FROM bot_rules WHERE id = ?').run(id)
  }
}
