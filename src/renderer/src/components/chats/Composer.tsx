import { useRef, useState } from 'react'
import { Loader2, Paperclip, Send, X } from 'lucide-react'
import type { PeerKey } from '@shared/chats'
import type { MediaFile } from '@shared/media'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { useChats } from '@renderer/store/chats'

/** Xabar yozish: matn + bitta fayl. Enter — yuborish, Shift+Enter — yangi qator. */
export default function Composer({ accountId, peer }: { accountId: number; peer: PeerKey }) {
  const send = useChats((s) => s.send)
  const [text, setText] = useState('')
  const [file, setFile] = useState<MediaFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = async () => {
    if (busy || (!text.trim() && !file)) return
    setBusy(true)
    setError(null)
    try {
      await send(accountId, peer, text, file?.path)
      setText('')
      setFile(null)
      ref.current?.focus()
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const pick = async () => {
    try {
      const files = await api.media.pick()
      if (files[0]) setFile(files[0])
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
          <Paperclip size={12} />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="text-slate-400">{file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`}</span>
          <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-600" aria-label="Olib tashlash">
            <X size={12} />
          </button>
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-end gap-2">
        <button type="button" onClick={pick} title="Fayl biriktirish" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Paperclip size={18} />
        </button>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="Xabar yozing…"
          className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
          style={{ height: Math.min(160, 40 + (text.split('\n').length - 1) * 20) }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || (!text.trim() && !file)}
          className="rounded-lg bg-brand-500 p-2 text-white hover:bg-brand-600 disabled:opacity-50"
          aria-label="Yuborish"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}
