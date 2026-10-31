import { useEffect, useState } from 'react'
import { Ban, CalendarClock, Loader2, Megaphone, RefreshCw, Send, Users } from 'lucide-react'
import type { TaskKind, TaskStatus, TaskView } from '@shared/tasks'
import { formatInTz } from '@shared/time'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { usePosts } from '@renderer/store/posts'

const KIND_ICON: Record<TaskKind, typeof Send> = {
  post_scheduled: CalendarClock,
  post_sending: Send,
  broadcast: Megaphone,
  channel_sync: RefreshCw,
  campaign: Users
}
const KIND_LABEL: Record<TaskKind, string> = {
  post_scheduled: 'Rejali post',
  post_sending: 'Post yuborish',
  broadcast: 'Rassilka',
  channel_sync: 'Sinxronlash',
  campaign: 'Kampaniya'
}
const STATUS_LABEL: Record<TaskStatus, string> = {
  scheduled: 'Rejali',
  running: 'Bajarilmoqda',
  paused: 'Pauza',
  failed: 'Xato'
}
const STATUS_CLS: Record<TaskStatus, string> = {
  scheduled: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  running: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
}

/** Barcha fon jarayonlari. Har 4 soniyada yangilanadi (tab ochiq bo'lsa). */
export default function TasksList() {
  const [tasks, setTasks] = useState<TaskView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const timezone = usePosts((s) => s.timezone)

  useEffect(() => {
    let alive = true
    const load = () =>
      api.tasks
        .list()
        .then((t) => alive && setTasks(t))
        .catch((e) => alive && setError(describeError(e).message))
    load()
    const t = setInterval(load, 4000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const stop = async (task: TaskView) => {
    const msg =
      task.kind === 'broadcast'
        ? 'Rassilkani bekor qilasizmi?'
        : task.kind === 'campaign'
          ? 'Kampaniyani bekor qilasizmi?'
          : "Rejali postni Telegram'dan olib tashlaysizmi? Post qoralamaga qaytadi."
    if (!window.confirm(msg)) return
    setBusyKey(task.key)
    setError(null)
    try {
      await api.tasks.stop(task.key)
      setTasks(await api.tasks.list())
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {tasks === null && (
        <div className="py-6 text-center text-xs text-slate-400">Yuklanmoqda…</div>
      )}
      {tasks && tasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          Hozir fon vazifalari yo'q. Rejali postlar, rassilkalar va sinxronlash shu yerda ko'rinadi.
        </div>
      )}
      <div className="space-y-2">
        {tasks?.map((t) => {
          const Icon = KIND_ICON[t.kind]
          return (
            <div
              key={t.key}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Icon
                  size={16}
                  className={
                    t.status === 'running' && t.kind === 'channel_sync' ? 'animate-spin' : ''
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{t.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[t.status]}`}
                  >
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span className="text-[11px] text-slate-400">{KIND_LABEL[t.kind]}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  {t.subtitle && <span>{t.subtitle}</span>}
                  {t.at && (
                    <span>
                      · {t.status === 'scheduled' ? 'Vaqti' : 'Boshlangan'}:{' '}
                      {formatInTz(t.at, timezone)}
                    </span>
                  )}
                </div>
                {t.progress !== null && (
                  <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full bg-brand-500 transition-all"
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {t.stoppable && (
                <button
                  type="button"
                  disabled={busyKey === t.key}
                  onClick={() => stop(t)}
                  title={
                    t.kind === 'broadcast' || t.kind === 'campaign'
                      ? 'Bekor qilish'
                      : 'Rejani bekor qilish'
                  }
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                >
                  {busyKey === t.key ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Ban size={15} />
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
