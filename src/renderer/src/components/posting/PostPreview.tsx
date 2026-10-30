import { FileText, Hash, Play } from 'lucide-react'
import type { ChannelView } from '@shared/ipc'
import type { MediaItem } from '@shared/types'
import { mediaUrl } from '@shared/media'
import { formatTimeInTz } from '@shared/time'
import { renderTelegramHtml } from '@renderer/lib/telegramHtml'

interface Props {
  channel: ChannelView | null
  text: string
  media: MediaItem[]
  /** ISO yoki null (hozir). */
  scheduledAt: string | null
  timezone: string
}

/** Telefon ko'rinishidagi jonli preview. */
export default function PostPreview({ channel, text, media, scheduledAt, timezone }: Props) {
  const time = formatTimeInTz(scheduledAt ?? new Date(), timezone)

  return (
    <div className="mx-auto w-[300px] select-none">
      <div className="rounded-[2rem] border-[6px] border-slate-800 bg-[#e7ebf0] shadow-xl dark:border-slate-700 dark:bg-[#0e1621]">
        {/* Yuqori panel */}
        <div className="flex items-center gap-2 rounded-t-[1.6rem] bg-white px-3 py-2 dark:bg-[#17212b]">
          {channel?.avatarUrl ? (
            <img src={channel.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white">
              <Hash size={14} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{channel?.title ?? 'Kanal'}</div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {channel ? (channel.type === 'channel' ? 'kanal' : 'guruh') : 'kanal tanlanmagan'}
            </div>
          </div>
        </div>

        {/* Xabar */}
        <div className="min-h-[360px] p-2.5">
          {text || media.length > 0 ? (
            <div className="max-w-[92%] overflow-hidden rounded-xl bg-white text-[13.5px] leading-snug text-slate-900 shadow-sm dark:bg-[#182533] dark:text-slate-100">
              <MediaGrid media={media} />
              {text && (
                <div className="whitespace-pre-wrap break-words px-2.5 pb-1.5 pt-1.5 [&_a]:break-all">
                  {renderTelegramHtml(text)}
                </div>
              )}
              <div className="px-2.5 pb-1 text-right text-[10px] text-slate-400">{time}</div>
            </div>
          ) : (
            <div className="pt-24 text-center text-xs text-slate-400">Matn yozing yoki media biriktiring</div>
          )}
        </div>
      </div>
    </div>
  )
}

function MediaGrid({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null
  const doc = media.find((m) => m.kind === 'document')
  if (doc) {
    return (
      <div className="flex items-center gap-2 px-2.5 pt-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white">
          <FileText size={18} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{doc.path.split(/[\\/]/).pop()}</div>
          <div className="text-[11px] text-slate-500">fayl</div>
        </div>
      </div>
    )
  }
  const cols = media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
  return (
    <div className={`grid ${cols} gap-0.5`}>
      {media.slice(0, 10).map((m, i) => (
        <div key={m.path + i} className="relative aspect-square overflow-hidden bg-slate-200 dark:bg-slate-700">
          {m.kind === 'photo' ? (
            <img src={mediaUrl(m.path)} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <>
              <video src={mediaUrl(m.path)} muted className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/50 p-2 text-white">
                  <Play size={16} />
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
