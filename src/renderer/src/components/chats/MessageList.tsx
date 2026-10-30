import { useEffect, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Download, FileText, Loader2, Mic, Music, Play, Sticker } from 'lucide-react'
import type { MessageView, PeerKey } from '@shared/chats'
import { formatInTz, formatTimeInTz, utcToWallTime } from '@shared/time'
import { api } from '@renderer/lib/api'
import { renderTelegramHtml } from '@renderer/lib/telegramHtml'
import { useChats } from '@renderer/store/chats'
import { usePosts } from '@renderer/store/posts'

const START_INDEX = 100_000

export default function MessageList({ accountId, peer }: { accountId: number; peer: PeerKey }) {
  const { threads, loadMessages } = useChats()
  const timezone = usePosts((s) => s.timezone)
  const t = threads[`${accountId}:${peer}`]
  const virtuoso = useRef<VirtuosoHandle>(null)
  const [firstIndex, setFirstIndex] = useState(START_INDEX)
  const prevLen = useRef(0)

  // Eski xabarlar tepaga qo'shilganda skroll joyini saqlash uchun firstItemIndex kamayadi
  useEffect(() => {
    const len = t?.list.length ?? 0
    if (len > prevLen.current && prevLen.current > 0 && t && t.list[0] && !t.loading) {
      // qo'shilganlar tepadami? (eng eski id kichrayganmi)
      setFirstIndex((i) => i - (len - prevLen.current))
    }
    prevLen.current = len
  }, [t?.list.length, t?.loading, t])

  if (!t || (!t.list.length && t.loading)) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Xabarlar yuklanmoqda…
      </div>
    )
  }
  if (!t.list.length) return <div className="flex h-full items-center justify-center text-sm text-slate-500">Xabarlar yo'q.</div>

  return (
    <Virtuoso
      ref={virtuoso}
      data={t.list}
      firstItemIndex={firstIndex}
      initialTopMostItemIndex={t.list.length - 1}
      followOutput="smooth"
      startReached={() => {
        if (t.hasMore && !t.loading) loadMessages(accountId, peer, true)
      }}
      itemContent={(_, m) => <Bubble accountId={accountId} peer={peer} m={m} timezone={timezone} />}
      components={{ Header: () => (t.loading ? <div className="py-2 text-center text-xs text-slate-400">Eskilari yuklanmoqda…</div> : <div className="h-2" />) }}
      className="h-full"
    />
  )
}

function Bubble({ accountId, peer, m, timezone }: { accountId: number; peer: PeerKey; m: MessageView; timezone: string }) {
  if (m.service) return <div className="my-1 text-center text-[11px] text-slate-400">{m.html}</div>
  const todayKey = utcToWallTime(new Date(), timezone).slice(0, 10)
  const time = utcToWallTime(m.date, timezone).slice(0, 10) === todayKey ? formatTimeInTz(m.date, timezone) : formatInTz(m.date, timezone)

  return (
    <div className={`flex px-3 py-0.5 ${m.out ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] overflow-hidden rounded-2xl text-[13.5px] leading-snug shadow-sm ${m.out ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'}`}>
        {m.senderName && <div className="px-3 pt-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300">{m.senderName}</div>}
        {m.media && <Media accountId={accountId} peer={peer} m={m} out={m.out} />}
        {m.html && <div className="whitespace-pre-wrap break-words px-3 pt-1.5 [&_a]:break-all">{renderTelegramHtml(m.html)}</div>}
        <div className={`px-3 pb-1 pt-0.5 text-right text-[10px] ${m.out ? 'text-white/70' : 'text-slate-400'}`}>{time}</div>
      </div>
    </div>
  )
}

function Media({ accountId, peer, m, out }: { accountId: number; peer: PeerKey; m: MessageView; out: boolean }) {
  const { thumbs, ensureThumb } = useChats()
  const media = m.media!
  const k = `${accountId}:${peer}:${m.id}`
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (media.hasThumb && (media.kind === 'photo' || media.kind === 'video' || media.kind === 'gif' || media.kind === 'sticker')) ensureThumb(accountId, peer, m.id)
  }, [accountId, peer, m.id, media.hasThumb, media.kind, ensureThumb])
  const url = thumbs[k] ?? null

  const download = async () => {
    setBusy(true)
    try {
      await api.chats.download(accountId, peer, m.id)
    } finally {
      setBusy(false)
    }
  }

  if (media.kind === 'photo' || media.kind === 'video' || media.kind === 'gif' || media.kind === 'sticker') {
    const ratio = media.width && media.height ? Math.min(1.6, Math.max(0.6, media.width / media.height)) : 1
    return (
      <button type="button" onClick={download} title="Yuklab olish" className="relative block w-64 overflow-hidden bg-slate-200 dark:bg-slate-700" style={{ aspectRatio: String(ratio) }}>
        {url ? <img src={url} alt="" className="h-full w-full object-cover" draggable={false} /> : <div className="flex h-full items-center justify-center text-slate-400">{media.kind === 'sticker' ? <Sticker size={24} /> : <Loader2 size={18} className="animate-spin" />}</div>}
        {(media.kind === 'video' || media.kind === 'gif') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/50 p-2 text-white">{busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}</div>
          </div>
        )}
      </button>
    )
  }

  const Icon = media.kind === 'voice' ? Mic : media.kind === 'audio' ? Music : FileText
  const size = media.size ? (media.size > 1048576 ? `${(media.size / 1048576).toFixed(1)} MB` : `${Math.ceil(media.size / 1024)} KB`) : ''
  return (
    <button type="button" onClick={download} className={`flex w-full items-center gap-2 px-3 pt-2 text-left ${out ? 'text-white' : ''}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${out ? 'bg-white/20' : 'bg-brand-500 text-white'}`}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}</div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{media.fileName ?? media.label ?? 'Fayl'}</div>
        <div className={`text-[11px] ${out ? 'text-white/70' : 'text-slate-500'}`}>
          {size} {media.kind !== 'other' && <Download size={10} className="inline" />}
        </div>
      </div>
    </button>
  )
}
