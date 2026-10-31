import { useEffect, useMemo, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { describeError } from '@renderer/lib/errors'
import { Bookmark, Bot, Hash, Loader2, Pin, Search, Users } from 'lucide-react'
import type { DialogFilter, DialogView } from '@shared/chats'
import { formatInTz, formatTimeInTz, utcToWallTime } from '@shared/time'
import { useChats } from '@renderer/store/chats'
import { usePosts } from '@renderer/store/posts'
import { useTags } from '@renderer/store/tags'

const EMPTY_MAP: Record<string, number[]> = {}

const FILTERS: { id: DialogFilter; label: string }[] = [
  { id: 'all', label: 'Hammasi' },
  { id: 'private', label: 'Shaxsiy' },
  { id: 'groups', label: 'Guruhlar' },
  { id: 'channels', label: 'Kanallar' }
]

export default function DialogList({ accountId }: { accountId: number }) {
  const {
    account,
    loadDialogs,
    select,
    filter,
    setFilter,
    search,
    setSearch,
    error,
    resolveAndOpen
  } = useChats()
  const [lookup, setLookup] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null
  })
  const acc = account(accountId)
  const {
    tags,
    loaded: tagsLoaded,
    load: loadTags,
    maps,
    loadMap,
    filterTagId,
    setFilterTag
  } = useTags()
  const tagMap = maps[accountId] ?? EMPTY_MAP
  const timezone = usePosts((s) => s.timezone)

  useEffect(() => {
    if (!acc.loaded && !acc.loading) loadDialogs(accountId).catch(console.error)
  }, [accountId, acc.loaded, acc.loading, loadDialogs])
  useEffect(() => {
    if (!tagsLoaded) loadTags().catch(console.error)
    if (!maps[accountId]) loadMap(accountId).catch(console.error)
  }, [accountId, tagsLoaded, loadTags, loadMap, maps])

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return acc.dialogs.filter((d) => {
      if (filter === 'private' && d.kind !== 'user' && d.kind !== 'bot') return false
      if (filter === 'groups' && d.kind !== 'group') return false
      if (filter === 'channels' && d.kind !== 'channel') return false
      if (q && !d.title.toLowerCase().includes(q) && !(d.username ?? '').toLowerCase().includes(q))
        return false
      if (filterTagId !== null && !(tagMap[d.peer] ?? []).includes(filterTagId)) return false
      return true
    })
  }, [acc.dialogs, filter, search, filterTagId, tagMap])

  const todayKey = utcToWallTime(new Date(), timezone).slice(0, 10)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-2 dark:border-slate-800">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id)
                setFilterTag(null)
              }}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${filter === f.id && filterTagId === null ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
            >
              {f.label}
            </button>
          ))}
          {tags.map((t) => (
            <button
              key={`tag-${t.id}`}
              type="button"
              onClick={() => setFilterTag(filterTagId === t.id ? null : t.id)}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${filterTagId === t.id ? 'text-white' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}
              style={{
                borderColor: t.color,
                background: filterTagId === t.id ? t.color : undefined
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="m-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1">
        {!acc.loaded ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Dialoglar yuklanmoqda…
          </div>
        ) : list.length === 0 ? (
          <div className="space-y-3 p-6 text-center text-sm text-slate-500">
            <div>
              {acc.dialogs.length === 0
                ? "Dialoglar yo'q yoki akkaunt ulanmagan."
                : 'Mos chat topilmadi.'}
            </div>
            {error && acc.dialogs.length === 0 && (
              <div className="text-xs text-red-600">{error}</div>
            )}
            {acc.dialogs.length === 0 && (
              <button
                type="button"
                onClick={() => loadDialogs(accountId)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Qayta yuklash
              </button>
            )}
            {search.trim().length >= 2 && (
              <div>
                <button
                  type="button"
                  disabled={lookup.busy}
                  onClick={() => {
                    setLookup({ busy: true, error: null })
                    resolveAndOpen(accountId, search)
                      .then(() => setLookup({ busy: false, error: null }))
                      .catch((e) => setLookup({ busy: false, error: describeError(e).message }))
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {lookup.busy && <Loader2 size={12} className="animate-spin" />}
                  Telegram'dan qidirish:{' '}
                  {search.trim().startsWith('@') || /^\+?\d/.test(search.trim())
                    ? search.trim()
                    : `@${search.trim()}`}
                </button>
                {lookup.error && <div className="mt-2 text-xs text-red-600">{lookup.error}</div>}
              </div>
            )}
          </div>
        ) : (
          <Virtuoso
            data={list}
            endReached={() => loadDialogs(accountId, true)}
            itemContent={(_, d) => (
              <DialogRow
                accountId={accountId}
                d={d}
                selected={acc.selected === d.peer}
                todayKey={todayKey}
                timezone={timezone}
                tagColors={(tagMap[d.peer] ?? [])
                  .map((id) => tags.find((t) => t.id === id)?.color)
                  .filter((c): c is string => !!c)}
                onSelect={() => select(accountId, d.peer)}
              />
            )}
            components={{
              Footer: () =>
                acc.loading ? (
                  <div className="py-2 text-center text-xs text-slate-400">Yuklanmoqda…</div>
                ) : null
            }}
          />
        )}
      </div>
    </div>
  )
}

function DialogRow({
  accountId,
  d,
  selected,
  todayKey,
  timezone,
  tagColors,
  onSelect
}: {
  accountId: number
  d: DialogView
  selected: boolean
  todayKey: string
  timezone: string
  tagColors: string[]
  onSelect: () => void
}) {
  const { avatars, ensureAvatar } = useChats()
  const k = `${accountId}:${d.peer}`
  useEffect(() => {
    if (!d.isSelf) ensureAvatar(accountId, d.peer)
  }, [accountId, d.peer, d.isSelf, ensureAvatar])
  const url = avatars[k] ?? null
  const time = d.lastDate
    ? utcToWallTime(d.lastDate, timezone).slice(0, 10) === todayKey
      ? formatTimeInTz(d.lastDate, timezone)
      : formatInTz(d.lastDate, timezone).slice(0, 5)
    : ''

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${selected ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
    >
      <Avatar d={d} url={url} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-medium">{d.title}</span>
          {tagColors.map((c, i) => (
            <span key={i} className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
          ))}
          {d.pinned && <Pin size={11} className="shrink-0 text-slate-400" />}
          <span className="ml-auto shrink-0 text-[11px] text-slate-400">{time}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            {d.lastOut && <span className="text-slate-400">Siz: </span>}
            {d.lastText}
          </span>
          {d.unread > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
              {d.unread > 99 ? '99+' : d.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function Avatar({ d, url }: { d: DialogView; url: string | null }) {
  if (d.isSelf) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
        <Bookmark size={18} />
      </div>
    )
  }
  if (url)
    return (
      <img
        src={url}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover"
        draggable={false}
      />
    )
  const Icon =
    d.kind === 'channel' ? Hash : d.kind === 'group' ? Users : d.kind === 'bot' ? Bot : null
  const hue = [...d.peer].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ background: `hsl(${hue} 55% 55%)` }}
    >
      {Icon ? <Icon size={18} /> : d.title.charAt(0).toUpperCase()}
    </div>
  )
}
