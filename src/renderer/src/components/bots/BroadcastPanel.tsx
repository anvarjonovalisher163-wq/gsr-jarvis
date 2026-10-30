import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ban, FileText, Loader2, Pause, Play, Plus, Send, Trash2, X } from 'lucide-react'
import type { BroadcastReport, BroadcastView } from '@shared/ipc'
import type { BroadcastStatus, MediaItem, UrlButton } from '@shared/types'
import { LIMITS, mediaUrl } from '@shared/media'
import { formatInTz, sqliteToIso, utcToWallTime, wallTimeToUtc } from '@shared/time'
import Modal from '@renderer/components/ui/Modal'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { plainLength, stripTags } from '@renderer/lib/telegramHtml'
import { useBots } from '@renderer/store/bots'
import { useBroadcasts } from '@renderer/store/broadcasts'
import { usePosts } from '@renderer/store/posts'
import ButtonsEditor from './ButtonsEditor'

const STATUS_LABEL: Record<BroadcastStatus, string> = {
  draft: 'Qoralama',
  scheduled: 'Rejali',
  running: 'Yuborilmoqda',
  paused: 'Pauza',
  done: 'Tugadi',
  cancelled: 'Bekor qilindi',
  failed: 'Xato'
}
const STATUS_CLS: Record<BroadcastStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  scheduled: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  running: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
}

export default function BroadcastPanel({ botId }: { botId: number }) {
  const { items, loaded, load, pause, resume, cancel, remove } = useBroadcasts()
  const timezone = usePosts((s) => s.timezone)
  const [creating, setCreating] = useState(false)
  const [reportId, setReportId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load(botId).catch(console.error)
  }, [botId, load])

  const list = items.filter((b) => b.bot_id === botId)

  const act = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Faqat /start bosgan va /stop qilmagan obunachilarga. Soniyasiga 20 tadan oshmaydi, bloklaganlar avtomatik chiqariladi.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus size={14} /> Rassilka
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {!loaded && <div className="py-6 text-center text-xs text-slate-400">Yuklanmoqda…</div>}
      {loaded && list.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Hali rassilka yo'q.</div>
      )}

      <div className="space-y-2">
        {list.map((b) => (
          <BroadcastRow
            key={b.id}
            b={b}
            timezone={timezone}
            onPause={() => act(() => pause(b.id))}
            onResume={() => act(() => resume(b.id))}
            onCancel={() => window.confirm('Rassilkani bekor qilasizmi? Yuborilganlar qaytarilmaydi.') && act(() => cancel(b.id))}
            onDelete={() => window.confirm("Rassilka tarixini o'chirasizmi?") && act(() => remove(b.id))}
            onReport={() => setReportId(b.id)}
          />
        ))}
      </div>

      {creating && <BroadcastForm botId={botId} onClose={() => setCreating(false)} />}
      {reportId !== null && <ReportModal id={reportId} timezone={timezone} onClose={() => setReportId(null)} />}
    </div>
  )
}

function BroadcastRow({
  b,
  timezone,
  onPause,
  onResume,
  onCancel,
  onDelete,
  onReport
}: {
  b: BroadcastView
  timezone: string
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onDelete: () => void
  onReport: () => void
}) {
  const processed = b.sent + b.failed
  const pct = b.total > 0 ? Math.round((processed / b.total) * 100) : 0
  const active = b.status === 'running' || b.status === 'paused' || b.status === 'scheduled'
  const when = b.scheduled_at && b.status === 'scheduled' ? `Reja: ${formatInTz(b.scheduled_at, timezone)}` : formatInTz(sqliteToIso(b.created_at), timezone)

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
            <span className="text-xs text-slate-500">{when}</span>
            {b.tag_filter && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">teg: {b.tag_filter}</span>}
            {b.media_json && <FileText size={12} className="text-slate-400" />}
          </div>
          <p className="mt-1 truncate text-sm">{stripTags(b.text, 100) || '(media)'}</p>

          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className={`h-full transition-all ${b.status === 'running' ? 'bg-brand-500' : b.failed > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 tabular-nums">
              {processed}/{b.total} · <span className="text-emerald-600">{b.sent} ✓</span>
              {b.failed > 0 && (
                <>
                  {' '}
                  · <span className="text-red-600">{b.failed} ✗</span>
                </>
              )}
              {b.blocked > 0 && <span className="text-slate-400"> ({b.blocked} bloklagan)</span>}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {b.status === 'running' && <Action icon={Pause} title="Pauza" onClick={onPause} />}
          {b.status === 'paused' && <Action icon={Play} title="Davom ettirish" onClick={onResume} />}
          {active && <Action icon={Ban} title="Bekor qilish" onClick={onCancel} danger />}
          {b.failed > 0 && <Action icon={AlertTriangle} title="Hisobot" onClick={onReport} />}
          {!active && <Action icon={Trash2} title="O'chirish" onClick={onDelete} danger />}
        </div>
      </div>
    </div>
  )
}

function Action({ icon: Icon, title, onClick, danger }: { icon: typeof Play; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md p-1.5 ${danger ? 'text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
    >
      <Icon size={15} />
    </button>
  )
}

function BroadcastForm({ botId, onClose }: { botId: number; onClose: () => void }) {
  const create = useBroadcasts((s) => s.create)
  const tags = useBots((s) => s.tags)
  const timezone = usePosts((s) => s.timezone)
  const [text, setText] = useState('')
  const [media, setMedia] = useState<MediaItem | null>(null)
  const [buttons, setButtons] = useState<UrlButton[][]>([])
  const [tag, setTag] = useState('')
  const [schedule, setSchedule] = useState(false)
  const [wall, setWall] = useState(() => utcToWallTime(new Date(Date.now() + 3600_000), timezone))
  const [footer, setFooter] = useState(false)
  const [audience, setAudience] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.subscribers.count(botId, tag || null).then(setAudience).catch(() => setAudience(null))
  }, [botId, tag])

  useEffect(() => {
    api.settings.get(['broadcast.footer_enabled']).then((v) => setFooter(v['broadcast.footer_enabled'] === '1'))
  }, [])

  const maxLen = media ? LIMITS.captionMax : LIMITS.textMax
  const len = plainLength(text)
  const scheduledIso = useMemo(() => {
    if (!schedule) return null
    try {
      return wallTimeToUtc(wall, timezone).toISOString()
    } catch {
      return null
    }
  }, [schedule, wall, timezone])

  const pick = async () => {
    try {
      const files = await api.media.pick()
      if (files[0]) setMedia({ path: files[0].path, kind: files[0].kind })
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (schedule && !scheduledIso) return setError("Vaqtni to'g'ri kiriting.")
    if (!schedule && !window.confirm(`${audience ?? '?'} ta obunachiga hozir yuborilsinmi?`)) return
    setBusy(true)
    setError(null)
    try {
      await api.settings.set({ 'broadcast.footer_enabled': footer ? '1' : '' })
      await create({ bot_id: botId, text, media, buttons, tag_filter: tag || null, scheduledAt: scheduledIso })
      onClose()
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Yangi rassilka" onClose={onClose} closable={!busy}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium">Auditoriya</span>
          <div className="flex items-center gap-2">
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls}>
              <option value="">Barcha faol obunachilar</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  Teg: {t}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-sm text-slate-500">{audience === null ? '…' : `${audience} ta`}</span>
          </div>
        </div>

        <label className="block">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">Matn</span>
            <span className={`text-xs ${len > maxLen ? 'text-red-600' : 'text-slate-400'}`}>
              {len}/{maxLen}
            </span>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Telegram HTML: <b>qalin</b>, <i>kursiv</i>, <a href=&quot;https://…&quot;>havola</a>" className={`${inputCls} resize-y`} />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium">Media (ixtiyoriy, bitta)</span>
          {media ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              {media.kind === 'photo' ? (
                <img src={mediaUrl(media.path)} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-500 dark:bg-slate-800">
                  <FileText size={16} />
                </div>
              )}
              <span className="min-w-0 flex-1 truncate text-xs">{media.path.split(/[\\/]/).pop()}</span>
              <button type="button" onClick={() => setMedia(null)} className="text-slate-400 hover:text-red-600" aria-label="Olib tashlash">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={pick} className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700">
              + Rasm / video / fayl tanlash
            </button>
          )}
        </div>

        <ButtonsEditor rows={buttons} onChange={setButtons} />

        <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={!schedule} onChange={() => setSchedule(false)} className="accent-brand-500" /> Hozir
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={schedule} onChange={() => setSchedule(true)} className="accent-brand-500" /> Rejali
            </label>
            {schedule && (
              <>
                <input type="datetime-local" value={wall} onChange={(e) => setWall(e.target.value)} className={`${inputCls} w-auto py-1`} />
                <span className="text-xs text-slate-500">{timezone}</span>
              </>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={footer} onChange={(e) => setFooter(e.target.checked)} className="accent-brand-500" />
            Xabar oxiriga "Obunadan chiqish: /stop" qatorini qo'shish
          </label>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Bekor
          </button>
          <button
            type="submit"
            disabled={busy || len > maxLen || (!text.trim() && !media) || audience === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {schedule ? 'Rejalashtirish' : 'Yuborish'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ReportModal({ id, timezone, onClose }: { id: number; timezone: string; onClose: () => void }) {
  const report = useBroadcasts((s) => s.report)
  const [data, setData] = useState<BroadcastReport | null>(null)
  useEffect(() => {
    report(id).then(setData).catch(console.error)
  }, [id, report])

  return (
    <Modal title={`Rassilka #${id} hisoboti`} onClose={onClose}>
      {!data ? (
        <Loader2 className="animate-spin text-slate-400" />
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Yetkazildi" value={data.broadcast.sent} cls="text-emerald-600" />
            <Stat label="Xato" value={data.broadcast.failed - data.broadcast.blocked} cls="text-red-600" />
            <Stat label="Bloklagan" value={data.broadcast.blocked} cls="text-slate-500" />
          </div>
          {data.problems.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
              {data.problems.map((p) => (
                <div key={p.subscriber_id} className="border-b border-slate-100 px-3 py-2 text-xs last:border-0 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.first_name || p.username || p.tg_user_id}</span>
                    <span className="text-slate-400">{formatInTz(sqliteToIso(p.sent_at), timezone)}</span>
                  </div>
                  <div className={p.status === 'blocked' ? 'text-slate-500' : 'text-red-600'}>{p.error}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
      <div className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
