import type { TaskView } from '@shared/tasks'
import { sqliteToIso } from '@shared/time'
import { getDb } from '../../db'
import { broadcastsRepo, postsRepo, postTargetsRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { createLogger } from '../../logger'
import { cancelBroadcast } from '../bots/broadcast'
import { cancelScheduledOnTelegram, emitPostChanged, rollupStatus } from '../posting/service'

const log = createLogger('tasks')

/** Qisqa muddatli fon ishlar (sinxronlash, post yuborish) — xotirada. */
interface Transient {
  kind: 'channel_sync' | 'post_sending'
  id: number
  title: string
  startedAt: string
  progress: number | null
}

const transient = new Map<string, Transient>()

export const taskRegistry = {
  start(kind: Transient['kind'], id: number, title: string): void {
    transient.set(`${kind}:${id}`, { kind, id, title, startedAt: new Date().toISOString(), progress: null })
  },
  progress(kind: Transient['kind'], id: number, done: number, total: number): void {
    const t = transient.get(`${kind}:${id}`)
    if (t) t.progress = total > 0 ? Math.round((done / total) * 100) : null
  },
  finish(kind: Transient['kind'], id: number): void {
    transient.delete(`${kind}:${id}`)
  }
}

export function listTasks(): TaskView[] {
  const out: TaskView[] = []

  for (const t of transient.values()) {
    out.push({
      key: `${t.kind}:${t.id}`,
      kind: t.kind,
      id: t.id,
      title: t.title,
      subtitle: t.kind === 'channel_sync' ? 'Kanallar sinxronlanmoqda' : 'Kanallarga yuborilmoqda',
      status: 'running',
      progress: t.progress,
      at: t.startedAt,
      stoppable: false
    })
  }

  // Telegram'da rejalashtirilgan postlar (post bo'yicha guruhlab)
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.title, p.text, MIN(t.scheduled_at) AS at, COUNT(*) AS n
       FROM posts p JOIN post_targets t ON t.post_id = p.id
       WHERE t.status = 'scheduled' AND t.tg_message_id IS NOT NULL
       GROUP BY p.id ORDER BY at`
    )
    .all() as { id: number; title: string; text: string; at: string; n: number }[]
  for (const r of rows) {
    out.push({
      key: `post_scheduled:${r.id}`,
      kind: 'post_scheduled',
      id: r.id,
      title: r.title || r.text.replace(/<[^>]+>/g, '').slice(0, 60) || `Post #${r.id}`,
      subtitle: `${r.n} ta kanal · Telegram'da rejalashtirilgan`,
      status: 'scheduled',
      progress: null,
      at: r.at,
      stoppable: true
    })
  }

  for (const b of broadcastsRepo.listResumable()) {
    const processed = b.sent + b.failed
    out.push({
      key: `broadcast:${b.id}`,
      kind: 'broadcast',
      id: b.id,
      title: b.text.replace(/<[^>]+>/g, '').slice(0, 60) || `Rassilka #${b.id}`,
      subtitle: b.status === 'scheduled' ? 'Rejali rassilka' : `${processed}/${b.total} yuborildi`,
      status: b.status === 'running' ? 'running' : b.status === 'paused' ? 'paused' : 'scheduled',
      progress: b.total > 0 ? Math.round((processed / b.total) * 100) : null,
      at: b.scheduled_at ?? sqliteToIso(b.created_at),
      stoppable: true
    })
  }

  return out.sort((a, b) => (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1))
}

export async function stopTask(key: string): Promise<void> {
  const [kind, idStr] = key.split(':')
  const id = Number(idStr)
  if (!Number.isInteger(id)) throw new AppError('BAD_REQUEST', "Vazifa kaliti noto'g'ri.")

  if (kind === 'broadcast') {
    cancelBroadcast(id)
    return
  }
  if (kind === 'post_scheduled') {
    // Telegram'dagi rejali xabarlarni o'chiramiz; post qoralama bo'lib qoladi (qayta rejalash mumkin)
    if (!postsRepo.getById(id)) throw new AppError('NOT_FOUND', 'Post topilmadi.')
    await cancelScheduledOnTelegram(id)
    for (const t of postTargetsRepo.listByPost(id)) {
      if (t.status === 'scheduled') postTargetsRepo.markScheduled(t.id, null, t.scheduled_at ?? '')
    }
    getDb().prepare(`UPDATE post_targets SET status = 'pending', tg_message_id = NULL WHERE post_id = ? AND status = 'scheduled'`).run(id)
    rollupStatus(id)
    emitPostChanged(id)
    log.info(`Rejali post ${id} bekor qilindi (qoralamaga qaytdi)`)
    return
  }
  throw new AppError('TASK_NOT_STOPPABLE', "Bu vazifani to'xtatib bo'lmaydi.")
}
