import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { PostDetail } from '@shared/ipc'
import type { PostStatus } from '@shared/types'
import { formatTimeInTz, utcToWallTime, wallTimeToUtc } from '@shared/time'
import { describeError } from '@renderer/lib/errors'
import { stripTags } from '@renderer/lib/telegramHtml'
import { usePosts } from '@renderer/store/posts'

type Mode = 'month' | 'week'

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

const STATUS_DOT: Record<PostStatus, string> = {
  draft: 'bg-slate-400',
  scheduled: 'bg-sky-500',
  sent: 'bg-emerald-500',
  failed: 'bg-red-500'
}

interface Event {
  post: PostDetail
  /** ISO */
  at: string
  /** YYYY-MM-DD (zona devor sanasi) */
  day: string
  /** HH:mm */
  time: string
  draggable: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
/** Devor sanasidan hafta kuni (Du=0). Zona ta'sir qilmasin uchun UTC'da hisoblanadi. */
const weekdayOf = (key: string) => (new Date(key + 'T00:00:00Z').getUTCDay() + 6) % 7
const addDays = (key: string, n: number) => new Date(Date.parse(key + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)

/** Kontent kalendar: oy / hafta, postlarni sudrab vaqtini o'zgartirish, bo'sh kunga bosib yangi post. */
export default function Calendar({ onEdit, onNew }: { onEdit: (d: PostDetail) => void; onNew: (iso: string) => void }) {
  const { posts, timezone, load, reschedule } = usePosts()
  const [mode, setMode] = useState<Mode>('month')
  const todayKey = utcToWallTime(new Date(), timezone).slice(0, 10)
  const [cursor, setCursor] = useState(todayKey) // ko'rinayotgan oy/hafta ichidagi sana
  const [dragId, setDragId] = useState<number | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  const events = useMemo<Event[]>(() => {
    const out: Event[] = []
    for (const d of posts) {
      const at = d.targets.map((t) => t.scheduled_at).filter((x): x is string => !!x).sort()[0]
      if (!at) continue
      const wall = utcToWallTime(at, timezone)
      out.push({ post: d, at, day: wall.slice(0, 10), time: wall.slice(11, 16), draggable: d.post.status !== 'sent' })
    }
    return out.sort((a, b) => a.at.localeCompare(b.at))
  }, [posts, timezone])

  const byDay = useMemo(() => {
    const m = new Map<string, Event[]>()
    for (const e of events) (m.get(e.day) ?? m.set(e.day, []).get(e.day)!).push(e)
    return m
  }, [events])

  // --- Ko'rinish panjarasi ---
  const [cy, cm] = [Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7))]
  const monthDays = useMemo(() => {
    const first = dayKey(cy, cm, 1)
    const lead = weekdayOf(first)
    const start = addDays(first, -lead)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [cy, cm])
  const weekDays = useMemo(() => {
    const start = addDays(cursor, -weekdayOf(cursor))
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [cursor])

  const shift = (dir: 1 | -1) => {
    if (mode === 'week') return setCursor(addDays(cursor, 7 * dir))
    const m = cm + dir
    const y = m === 0 ? cy - 1 : m === 13 ? cy + 1 : cy
    setCursor(dayKey(y, m === 0 ? 12 : m === 13 ? 1 : m, 1))
  }

  const title =
    mode === 'month'
      ? `${MONTHS[cm - 1]} ${cy}`
      : `${weekDays[0].slice(8)}.${weekDays[0].slice(5, 7)} – ${weekDays[6].slice(8)}.${weekDays[6].slice(5, 7)}.${weekDays[6].slice(0, 4)}`

  // --- Drag & drop ---
  const drop = async (day: string, hour?: number) => {
    setOverKey(null)
    if (dragId === null) return
    const ev = events.find((e) => e.post.post.id === dragId)
    setDragId(null)
    if (!ev) return
    const time = hour === undefined ? ev.time : `${pad(hour)}:${ev.time.slice(3)}`
    const wall = `${day}T${time}`
    if (wall === `${ev.day}T${ev.time}`) return
    setError(null)
    try {
      await reschedule(dragId, wallTimeToUtc(wall, timezone).toISOString())
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  const newAt = (day: string, hour = 10) => onNew(wallTimeToUtc(`${day}T${pad(hour)}:00`, timezone).toISOString())

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <button type="button" onClick={() => shift(-1)} className={navBtn} aria-label="Oldingi">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => shift(1)} className={navBtn} aria-label="Keyingi">
          <ChevronRight size={16} />
        </button>
        <button type="button" onClick={() => setCursor(todayKey)} className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700">
          Bugun
        </button>
        <span className="ml-1 text-sm font-semibold">{title}</span>
        <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {(['month', 'week'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${mode === m ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}>
              {m === 'month' ? 'Oy' : 'Hafta'}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400">{timezone}</span>
      </div>

      {error && <p className="mx-4 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {mode === 'month' ? (
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,1fr)] gap-px overflow-auto bg-slate-200 p-px dark:bg-slate-800">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bg-slate-50 px-2 py-1 text-center text-[11px] font-medium uppercase text-slate-500 dark:bg-slate-900">
              {w}
            </div>
          ))}
          {monthDays.map((day) => {
            const inMonth = day.slice(5, 7) === pad(cm)
            const isToday = day === todayKey
            const list = byDay.get(day) ?? []
            return (
              <div
                key={day}
                onDragOver={(e) => {
                  if (dragId !== null) {
                    e.preventDefault()
                    setOverKey(day)
                  }
                }}
                onDragLeave={() => setOverKey((k) => (k === day ? null : k))}
                onDrop={(e) => {
                  e.preventDefault()
                  drop(day)
                }}
                onDoubleClick={() => newAt(day)}
                className={[
                  'group relative flex min-h-[96px] flex-col bg-white p-1 dark:bg-slate-950',
                  inMonth ? '' : 'opacity-50',
                  overKey === day ? 'ring-2 ring-inset ring-brand-400' : ''
                ].join(' ')}
              >
                <div className="flex items-center justify-between px-1">
                  <span className={`text-xs ${isToday ? 'rounded-full bg-brand-500 px-1.5 font-semibold text-white' : 'text-slate-500'}`}>{Number(day.slice(8))}</span>
                  <button type="button" onClick={() => newAt(day)} title="Shu kunga post" className="rounded p-0.5 text-slate-300 opacity-0 hover:bg-slate-100 hover:text-brand-600 group-hover:opacity-100 dark:hover:bg-slate-800">
                    <Plus size={12} />
                  </button>
                </div>
                <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                  {list.slice(0, 4).map((ev) => (
                    <EventChip key={ev.post.post.id} ev={ev} dragging={dragId === ev.post.post.id} onDragStart={() => setDragId(ev.post.post.id)} onDragEnd={() => setDragId(null)} onClick={() => onEdit(ev.post)} />
                  ))}
                  {list.length > 4 && <span className="px-1 text-[10px] text-slate-400">+{list.length - 4}</span>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid grid-cols-[48px_repeat(7,1fr)]">
            <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900" />
            {weekDays.map((day) => (
              <div key={day} className={`sticky top-0 z-10 border-b border-l border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs dark:border-slate-800 dark:bg-slate-900 ${day === todayKey ? 'font-semibold text-brand-600' : 'text-slate-500'}`}>
                {WEEKDAYS[weekdayOf(day)]} {Number(day.slice(8))}
              </div>
            ))}
            {Array.from({ length: 24 }, (_, h) => (
              <HourRow key={h} h={h} days={weekDays} byDay={byDay} dragId={dragId} overKey={overKey} setOverKey={setOverKey} onDrop={drop} onNew={newAt} onEdit={onEdit} setDragId={setDragId} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HourRow({
  h,
  days,
  byDay,
  dragId,
  overKey,
  setOverKey,
  onDrop,
  onNew,
  onEdit,
  setDragId
}: {
  h: number
  days: string[]
  byDay: Map<string, Event[]>
  dragId: number | null
  overKey: string | null
  setOverKey: (k: string | null) => void
  onDrop: (day: string, hour: number) => void
  onNew: (day: string, hour: number) => void
  onEdit: (d: PostDetail) => void
  setDragId: (id: number | null) => void
}) {
  return (
    <>
      <div className="border-b border-slate-100 pr-1 pt-0.5 text-right text-[10px] text-slate-400 dark:border-slate-800">{pad(h)}:00</div>
      {days.map((day) => {
        const key = `${day}T${pad(h)}`
        const list = (byDay.get(day) ?? []).filter((e) => Number(e.time.slice(0, 2)) === h)
        return (
          <div
            key={key}
            onDragOver={(e) => {
              if (dragId !== null) {
                e.preventDefault()
                setOverKey(key)
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              onDrop(day, h)
            }}
            onDoubleClick={() => onNew(day, h)}
            className={`min-h-[40px] border-b border-l border-slate-100 p-0.5 dark:border-slate-800 ${overKey === key ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}
          >
            {list.map((ev) => (
              <EventChip key={ev.post.post.id} ev={ev} dragging={dragId === ev.post.post.id} onDragStart={() => setDragId(ev.post.post.id)} onDragEnd={() => setDragId(null)} onClick={() => onEdit(ev.post)} />
            ))}
          </div>
        )
      })}
    </>
  )
}

function EventChip({ ev, dragging, onDragStart, onDragEnd, onClick }: { ev: Event; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onClick: () => void }) {
  const { post, targets } = ev.post
  const label = post.title || stripTags(post.text, 40) || '(media)'
  return (
    <div
      draggable={ev.draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      title={`${label} — ${ev.time} · ${targets.map((t) => t.channel_title).join(', ')}`}
      className={[
        'flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-slate-100 dark:hover:bg-slate-800',
        ev.draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-80',
        dragging ? 'opacity-40' : ''
      ].join(' ')}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[post.status]}`} />
      <span className="shrink-0 tabular-nums text-slate-500">{ev.time}</span>
      <span className="flex -space-x-1">
        {targets.slice(0, 3).map((t) =>
          t.avatarUrl ? (
            <img key={t.id} src={t.avatarUrl} alt="" className="h-3.5 w-3.5 rounded-full border border-white object-cover dark:border-slate-950" />
          ) : (
            <span key={t.id} className="inline-block h-3.5 w-3.5 rounded-full border border-white bg-slate-300 dark:border-slate-950 dark:bg-slate-600" />
          )
        )}
      </span>
      <span className="truncate">{label}</span>
    </div>
  )
}

const navBtn = 'rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'

/** Eksport: testlar uchun yordamchi (zona bo'yicha "HH:mm"). */
export const _timeInTz = formatTimeInTz
