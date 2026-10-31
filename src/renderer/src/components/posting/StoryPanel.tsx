import { useMemo, useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'
import type { MediaFile } from '@shared/media'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { btnPrimary, btnSecondary, inputCls } from '@renderer/lib/ui'
import { useAccounts } from '@renderer/store/accounts'
import { useChannels } from '@renderer/store/channels'

/** Story yuborish: akkaunt → profil yoki kanal → rasm/video + izoh → muddat. */
export default function StoryPanel() {
  const allAccounts = useAccounts((s) => s.accounts)
  const accounts = useMemo(() => allAccounts.filter((a) => a.status === 'active'), [allAccounts])
  const channels = useChannels((s) => s.channels)
  const [accountId, setAccountId] = useState<number>(
    accounts.find((a) => a.connected)?.id ?? accounts[0]?.id ?? 0
  )
  const [channelId, setChannelId] = useState<number | null>(null)
  const [file, setFile] = useState<MediaFile | null>(null)
  const [caption, setCaption] = useState('')
  const [period, setPeriod] = useState<6 | 12 | 24 | 48>(24)
  const [privacy, setPrivacy] = useState<'all' | 'contacts' | 'close'>('all')
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const myChannels = channels.filter((c) => c.account_id === accountId && c.type === 'channel')

  const pick = async () => {
    try {
      const f = await api.media.pick()
      if (f[0]) {
        if (f[0].kind === 'document')
          setMsg({ ok: false, text: 'Story uchun faqat rasm yoki video.' })
        else setFile(f[0])
      }
    } catch (e) {
      setMsg({ ok: false, text: describeError(e).message })
    }
  }

  const send = async () => {
    if (!file) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await api.stories.send({
        accountId,
        channelId,
        media: { path: file.path, kind: file.kind },
        caption,
        periodHours: period,
        privacy,
        pinned
      })
      setMsg({
        ok: true,
        text: `Story joylandi: ${r.target}${r.storyId ? ` (#${r.storyId})` : ''}`
      })
      setFile(null)
      setCaption('')
    } catch (e) {
      setMsg({ ok: false, text: describeError(e).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl p-5">
      <h2 className="text-base font-semibold">Story yuborish</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        O'z profilingizga (Telegram Premium kerak) yoki admin bo'lgan kanalingizga (kanal boost
        darajasi kerak). Rasm yoki 60 soniyagacha video.
      </p>

      <div className="mt-4 space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Akkaunt</span>
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(Number(e.target.value))
              setChannelId(null)
            }}
            className={inputCls}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name || a.username || a.phone} {a.connected ? '' : '(ulanmagan)'}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Qayerga</span>
          <select
            value={channelId ?? ''}
            onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : null)}
            className={inputCls}
          >
            <option value="">O'z profilim</option>
            {myChannels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button type="button" onClick={pick} className={btnSecondary}>
            <Paperclip size={13} /> {file ? 'Boshqa fayl' : 'Rasm / video tanlash'}
          </button>
          {file && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
              {file.name}
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-slate-400 hover:text-red-600"
                aria-label="Olib tashlash"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
        {file && file.kind === 'photo' && (
          <img src={file.url} alt="" className="max-h-64 rounded-lg object-contain" />
        )}
        {file && file.kind === 'video' && (
          <video src={file.url} controls className="max-h-64 rounded-lg" />
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          placeholder="Izoh (ixtiyoriy)"
          className={`${inputCls} resize-y`}
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Muddat</span>
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value) as 6 | 12 | 24 | 48)}
              className={`${inputCls.replace('w-full ', '')}`}
            >
              {[6, 12, 24, 48].map((h) => (
                <option key={h} value={h}>
                  {h} soat
                </option>
              ))}
            </select>
          </label>
          {channelId === null && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Kim ko'radi</span>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
                className={`${inputCls.replace('w-full ', '')}`}
              >
                <option value="all">Hamma</option>
                <option value="contacts">Kontaktlar</option>
                <option value="close">Yaqin do'stlar</option>
              </select>
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="accent-brand-500"
            />{' '}
            Profilda saqlab qolish
          </label>
        </div>

        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-xs ${msg.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}
          >
            {msg.text}
          </p>
        )}
        <button
          type="button"
          onClick={send}
          disabled={busy || !file || !accountId}
          className={btnPrimary}
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Story joylash
        </button>
      </div>
    </div>
  )
}
