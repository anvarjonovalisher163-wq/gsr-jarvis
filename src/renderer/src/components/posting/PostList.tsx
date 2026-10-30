import { useEffect, useState } from 'react'
import { Copy, Image as ImageIcon, Loader2, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react'
import type { PostDetail, TargetView } from '@shared/ipc'
import type { PostStatus, TargetStatus } from '@shared/types'
import { formatInTz, sqliteToIso } from '@shared/time'
import { describeError } from '@renderer/lib/errors'
import { stripTags } from '@renderer/lib/telegramHtml'
import { useChannels } from '@renderer/store/channels'
import { usePosts } from '@renderer/store/posts'

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Qoralama',
  scheduled: 'Rejali',
  sent: 'Yuborildi',
  failed: 'Xato'
}
const STATUS_CLS: Record<PostStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  scheduled: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  sent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
}
const TARGET_DOT: Record<TargetStatus, string> = {
  pending: 'bg-slate-400',
  scheduled: 'bg-sky-500',
  sent: 'bg-emerald-500',
  failed: 'bg-red-500'
}

export default function PostList({ onEdit }: { onEdit: (d: PostDetail) => void }) {
  const { posts, loaded, filter, timezone, load, setFilter, send, retry, remove, duplicate } = usePosts()
  const channels = useChannels((s) => s.channels)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        {([undefined, 'draft', 'scheduled', 'sent', 'failed'] as const).map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            onClick={() => setFilter({ ...filter, status: s })}
            className={[
              'rounded-full px-2.5 py-1 text-xs',
              filter.status === s
                ? 'bg-brand-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            ].join(' ')}
          >
            {s ? STATUS_LABEL[s] : 'Hammasi'}
          </button>
        ))}
        <select
          value={filter.channelId ?? ''}
          onChange={(e) => setFilter({ ...filter, channelId: e.target.value ? Number(e.target.value) : undefined })}
          className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">Barcha kanallar</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mx-4 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      <div className="flex-1 overflow-y-auto p-4">
        {loaded && posts.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
            Hali post yo'q.
          </div>
        )}
        <div className="space-y-2">
          {posts.map((d) => (
            <PostRow
              key={d.post.id}
              d={d}
              timezone={timezone}
              busy={busyId === d.post.id}
              onEdit={() => onEdit(d)}
              onSend={() => act(d.post.id, () => send(d.post.id))}
              onRetry={() => act(d.post.id, () => retry(d.post.id))}
              onDuplicate={() => act(d.post.id, () => duplicate(d.post.id))}
              onDelete={() => {
                if (window.confirm("Postni o'chirasizmi? Telegram'dagi rejali nusxalari ham bekor qilinadi.")) {
                  act(d.post.id, () => remove(d.post.id))
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  d: PostDetail
  timezone: string
  busy: boolean
  onEdit: () => void
  onSend: () => void
  onRetry: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function PostRow({ d, timezone, busy, onEdit, onSend, onRetry, onDuplicate, onDelete }: RowProps) {
  const { post, targets, media } = d
  const scheduled = targets.map((t) => t.scheduled_at).filter(Boolean).sort()[0] ?? null
  const when = scheduled ? `Reja: ${formatInTz(scheduled, timezone)}` : formatInTz(sqliteToIso(post.created_at), timezone)
  const failed = targets.filter((t) => t.status === 'failed')
  const canSend = post.status === 'draft' && targets.length > 0
  const canEdit = post.status !== 'sent'

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[post.status]}`}>
              {STATUS_LABEL[post.status]}
            </span>
            <span className="text-xs text-slate-500">{when}</span>
            {media.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
                <ImageIcon size={12} /> {media.length}
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-sm font-medium">{post.title || stripTags(post.text, 60) || '(media)'}</div>
          {post.title && <div className="truncate text-xs text-slate-500">{stripTags(post.text)}</div>}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <TargetChip key={t.id} t={t} />
            ))}
            {targets.length === 0 && <span className="text-xs text-slate-400">Kanal tanlanmagan</span>}
          </div>

          {failed.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-600 dark:text-red-400">
              {failed.map((t) => (
                <li key={t.id}>
                  <b>{t.channel_title}:</b> {t.error}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {busy && <Loader2 size={14} className="animate-spin text-slate-400" />}
          {canSend && <Action icon={Send} title="Yuborish" onClick={onSend} disabled={busy} />}
          {failed.length > 0 && <Action icon={RotateCcw} title="Qayta urinish" onClick={onRetry} disabled={busy} />}
          {canEdit && <Action icon={Pencil} title="Tahrirlash" onClick={onEdit} disabled={busy} />}
          <Action icon={Copy} title="Dublikat" onClick={onDuplicate} disabled={busy} />
          <Action icon={Trash2} title="O'chirish" onClick={onDelete} disabled={busy} danger />
        </div>
      </div>
    </div>
  )
}

function TargetChip({ t }: { t: TargetView }) {
  return (
    <span
      title={`${t.channel_title}: ${t.status}${t.error ? ` — ${t.error}` : ''}`}
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-[11px] dark:bg-slate-800"
    >
      {t.avatarUrl ? (
        <img src={t.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <span className="inline-block h-4 w-4 rounded-full bg-slate-300 dark:bg-slate-600" />
      )}
      {t.channel_title}
      <span className={`h-1.5 w-1.5 rounded-full ${TARGET_DOT[t.status]}`} />
    </span>
  )
}

function Action({
  icon: Icon,
  title,
  onClick,
  disabled,
  danger
}: {
  icon: typeof Send
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-md p-1.5 disabled:opacity-40',
        danger
          ? 'text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100'
      ].join(' ')}
    >
      <Icon size={15} />
    </button>
  )
}
