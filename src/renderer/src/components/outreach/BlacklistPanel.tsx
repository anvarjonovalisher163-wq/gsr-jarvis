import { useEffect, useState } from 'react'
import { Ban, Loader2, Search, Trash2 } from 'lucide-react'
import { describeError } from '@renderer/lib/errors'
import { btnPrimary, inputCls } from '@renderer/lib/ui'
import { useOutreach } from '@renderer/store/outreach'

/** Qora ro'yxat: bu foydalanuvchilarga kampaniya, API va bot javoblari bormaydi. */
export default function BlacklistPanel() {
  const { blacklist, blacklistLoaded, loadBlacklist, addBlacklist, removeBlacklist } = useOutreach()
  const [search, setSearch] = useState('')
  const [idInput, setIdInput] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(
      () => loadBlacklist(search || undefined).catch((e) => setError(describeError(e).message)),
      200
    )
    return () => clearTimeout(t)
  }, [search, loadBlacklist])

  const add = async () => {
    const raw = idInput.trim().replace(/^u/, '')
    if (!/^\d{1,20}$/.test(raw)) {
      setError("Telegram user ID raqam bo'lishi kerak (chatdagi kontakt kartasida ko'rinadi).")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addBlacklist({ tgUserId: raw, username: null, title: '', reason })
      setIdInput('')
      setReason('')
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Qora ro'yxatdagilarga kampaniya va API xabarlari yuborilmaydi, botlar ularga javob bermaydi.
        Chatlar bo'limida kontakt kartasidan ham qo'shish mumkin.
      </p>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs text-slate-500">Telegram user ID</label>
          <input
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="123456789"
            className={inputCls}
          />
        </div>
        <div className="min-w-[180px] flex-[2]">
          <label className="mb-1 block text-xs text-slate-500">Sabab (ixtiyoriy)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: xabar yubormaslikni so'radi"
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={busy || !idInput.trim()}
          className={btnPrimary}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Qo'shish
        </button>
      </div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="relative mb-2">
        <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Qidirish…"
          className={`${inputCls} pl-8`}
        />
      </div>
      {blacklistLoaded && blacklist.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          Qora ro'yxat bo'sh.
        </div>
      )}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {blacklist.map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {b.title || (b.username ? `@${b.username}` : `ID ${b.tg_user_id}`)}
                {b.title && b.username && (
                  <span className="ml-1 font-normal text-slate-500">@{b.username}</span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500">
                ID {b.tg_user_id}
                {b.reason ? ` · ${b.reason}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeBlacklist(b.id).catch((e) => setError(describeError(e).message))}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              title="Ro'yxatdan chiqarish"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
