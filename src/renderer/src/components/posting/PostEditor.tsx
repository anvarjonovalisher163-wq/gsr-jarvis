import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bold,
  Calendar,
  Code,
  EyeOff,
  FileText,
  Italic,
  Link2,
  Loader2,
  Paperclip,
  Play,
  Save,
  Send,
  Strikethrough,
  Underline,
  X
} from 'lucide-react'
import type { PostDetail } from '@shared/ipc'
import type { MediaItem } from '@shared/types'
import { LIMITS, mediaUrl, validateMediaSet } from '@shared/media'
import { utcToWallTime, wallTimeToUtc } from '@shared/time'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { plainLength } from '@renderer/lib/telegramHtml'
import { useChannels } from '@renderer/store/channels'
import { usePosts } from '@renderer/store/posts'
import PostPreview from './PostPreview'

type Mode = 'now' | 'schedule'

interface Props {
  /** Tahrirlanayotgan post yoki null (yangi). */
  editing: PostDetail | null
  onDone: () => void
}

/** Hozirdan N daqiqa keyingi devor vaqti (datetime-local uchun). */
function wallFromNow(minutes: number, tz: string): string {
  return utcToWallTime(new Date(Date.now() + minutes * 60_000), tz)
}

export default function PostEditor({ editing, onDone }: Props) {
  const timezone = usePosts((s) => s.timezone)
  const { save, send, openEdit } = usePosts()
  const { channels, selectedIds, setSelected, toggle } = useChannels()

  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [mode, setMode] = useState<Mode>('now')
  const [wall, setWall] = useState(() => wallFromNow(60, timezone))
  const [busy, setBusy] = useState<null | 'save' | 'send'>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Tahrirlash: formani postdan to'ldiramiz
  useEffect(() => {
    if (editing) {
      setTitle(editing.post.title)
      setText(editing.post.text)
      setMedia(editing.media)
      const sched = editing.targets.find((t) => t.scheduled_at)?.scheduled_at ?? null
      setMode(sched ? 'schedule' : 'now')
      if (sched) setWall(utcToWallTime(sched, timezone))
      setSelected(editing.targets.map((t) => t.channel_id))
    } else {
      setTitle('')
      setText('')
      setMedia([])
      setMode('now')
      setWall(wallFromNow(60, timezone))
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.post.id, timezone])

  const selectedChannels = useMemo(
    () => channels.filter((c) => selectedIds.includes(c.id)),
    [channels, selectedIds]
  )

  const scheduledIso = useMemo(() => {
    if (mode !== 'schedule') return null
    try {
      return wallTimeToUtc(wall, timezone).toISOString()
    } catch {
      return null
    }
  }, [mode, wall, timezone])

  const maxLen = media.length > 0 ? LIMITS.captionMax : LIMITS.textMax
  const len = plainLength(text)
  const mediaErr = validateMediaSet(media)
  const tooLong = len > maxLen

  // --- Formatlash: tanlangan matnni teg bilan o'rash ---
  const wrap = (open: string, close: string) => {
    const el = textRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const sel = text.slice(s, e)
    const next = text.slice(0, s) + open + sel + close + text.slice(e)
    setText(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + open.length, e + open.length)
    })
  }

  const applyLink = () => {
    if (linkUrl && /^(https?:\/\/|tg:\/\/)/i.test(linkUrl.trim())) wrap(`<a href="${linkUrl.trim()}">`, '</a>')
    setLinkUrl(null)
  }

  // --- Media ---
  const pick = async () => {
    try {
      const files = await api.media.pick()
      if (files.length === 0) return
      const items: MediaItem[] = files.map((f) => ({ path: f.path, kind: f.kind }))
      setMedia((m) => {
        const merged = [...m, ...items.filter((it) => !m.some((x) => x.path === it.path))]
        return merged.slice(0, LIMITS.albumMax)
      })
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  // --- Saqlash / yuborish ---
  const buildInput = (scheduledAt: string | null) => ({
    id: editing?.post.id,
    title: title.trim(),
    text,
    media,
    channelIds: selectedIds,
    scheduledAt
  })

  const run = async (kind: 'save' | 'send', scheduledAt: string | null) => {
    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      if (kind === 'send' && selectedIds.length === 0) throw new Error('Kamida bitta kanal tanlang.')
      if (mode === 'schedule' && !scheduledIso) throw new Error("Rejalashtirish vaqtini to'g'ri kiriting.")
      const saved = await save(buildInput(scheduledAt))
      if (kind === 'save') {
        // Yangi post saqlandi → endi shu postni tahrirlaymiz, aks holda keyingi saqlash nusxa yaratadi
        if (!editing) openEdit(saved)
        setNotice('Qoralama saqlandi.')
        return
      }
      await send(saved.post.id)
      onDone()
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(null)
    }
  }

  const canSubmit = !busy && !tooLong && !mediaErr && (text.trim() !== '' || media.length > 0)

  return (
    <div className="flex h-full min-h-0">
      {/* Muharrir */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sarlavha (faqat o'zingiz uchun, ixtiyoriy)"
          className="mb-3 w-full bg-transparent text-lg font-semibold outline-none placeholder:text-slate-400"
        />

        {/* Toolbar */}
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <Tool icon={Bold} title="Qalin" onClick={() => wrap('<b>', '</b>')} />
          <Tool icon={Italic} title="Kursiv" onClick={() => wrap('<i>', '</i>')} />
          <Tool icon={Underline} title="Tagiga chizilgan" onClick={() => wrap('<u>', '</u>')} />
          <Tool icon={Strikethrough} title="O'chirilgan" onClick={() => wrap('<s>', '</s>')} />
          <Tool icon={Code} title="Kod" onClick={() => wrap('<code>', '</code>')} />
          <Tool icon={EyeOff} title="Spoiler" onClick={() => wrap('<spoiler>', '</spoiler>')} />
          <Tool icon={Link2} title="Havola" onClick={() => setLinkUrl((v) => (v === null ? 'https://' : null))} />
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <Tool icon={Paperclip} title="Media biriktirish" onClick={pick} label="Media" />
          <span className={`ml-auto text-xs ${tooLong ? 'font-medium text-red-600' : 'text-slate-400'}`}>
            {len}/{maxLen}
          </span>
        </div>

        {linkUrl !== null && (
          <div className="mb-2 flex items-center gap-2">
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLink()
                if (e.key === 'Escape') setLinkUrl(null)
              }}
              placeholder="https://..."
              className={`${inputCls} flex-1 py-1 text-xs`}
            />
            <button type="button" onClick={applyLink} className="rounded-md bg-brand-500 px-2.5 py-1 text-xs text-white">
              Qo'llash
            </button>
          </div>
        )}

        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Post matni… Formatlash: <b>qalin</b>, <i>kursiv</i>, <a href=&quot;https://…&quot;>havola</a>"
          spellCheck
          className={`${inputCls} min-h-[180px] flex-1 resize-y font-[inherit] leading-relaxed`}
        />

        {/* Media ro'yxati */}
        {media.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>
                Media: {media.length}/{LIMITS.albumMax}
              </span>
              <button type="button" onClick={() => setMedia([])} className="hover:text-red-600">
                Hammasini olib tashlash
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {media.map((m) => (
                <div
                  key={m.path}
                  className="group relative h-16 w-16 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                  title={m.path}
                >
                  {m.kind === 'photo' ? (
                    <img src={mediaUrl(m.path)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      {m.kind === 'video' ? <Play size={20} /> : <FileText size={20} />}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMedia((arr) => arr.filter((x) => x.path !== m.path))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
                    aria-label="Olib tashlash"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            {mediaErr && <p className="mt-1 text-xs text-red-600">{mediaErr}</p>}
          </div>
        )}

        {/* Kanallar */}
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-slate-500">
            Kanallar ({selectedChannels.length})
            {selectedChannels.length === 0 && <span className="ml-1 font-normal">— chap paneldan tanlang</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedChannels.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1 pr-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <span className="inline-block h-4 w-4 rounded-full bg-slate-300 dark:bg-slate-600" />
                )}
                {c.title}
                <button type="button" onClick={() => toggle(c.id)} className="text-slate-400 hover:text-red-600" aria-label="Olib tashlash">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Vaqt */}
        <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} className="accent-brand-500" />
              Hozir yuborish
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={mode === 'schedule'} onChange={() => setMode('schedule')} className="accent-brand-500" />
              Rejalashtirish
            </label>
            {mode === 'schedule' && (
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={wall}
                  min={wallFromNow(1, timezone)}
                  onChange={(e) => setWall(e.target.value)}
                  className={`${inputCls} py-1 text-sm`}
                />
                <span className="text-xs text-slate-500">{timezone}</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {notice && <p className="mt-3 text-sm text-emerald-600">{notice}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => run('save', scheduledIso)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Qoralama
          </button>
          <button
            type="button"
            disabled={!canSubmit || selectedIds.length === 0}
            onClick={() => run('send', scheduledIso)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : mode === 'now' ? <Send size={14} /> : <Calendar size={14} />}
            {mode === 'now' ? 'Hozir yuborish' : 'Rejalashtirish'}
          </button>
          {editing && (
            <span className="ml-auto text-xs text-slate-400">
              Tahrirlanmoqda: #{editing.post.id}
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 xl:block">
        <PostPreview
          channel={selectedChannels[0] ?? null}
          text={text}
          media={media}
          scheduledAt={scheduledIso}
          timezone={timezone}
        />
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'

function Tool({
  icon: Icon,
  title,
  onClick,
  label
}: {
  icon: typeof Bold
  title: string
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // textarea fokusini saqlab qolamiz
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
