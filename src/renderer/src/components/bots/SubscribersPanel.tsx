import { useState } from 'react'
import { Download, Loader2, Search } from 'lucide-react'
import { formatInTz, sqliteToIso } from '@shared/time'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { useBots } from '@renderer/store/bots'
import { usePosts } from '@renderer/store/posts'

export default function SubscribersPanel({ botId }: { botId: number }) {
  const { subscribers, tags, subQuery, setSubQuery } = useBots()
  const timezone = usePosts((s) => s.timezone)
  const [search, setSearch] = useState(subQuery.search ?? '')
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const exportCsv = async () => {
    setExporting(true)
    setNotice(null)
    try {
      const r = await api.subscribers.exportCsv(botId)
      setNotice(r.path ? `${r.count} ta qator saqlandi: ${r.path}` : null)
    } catch (e) {
      setNotice(describeError(e).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSubQuery({ ...subQuery, search: e.target.value || undefined })
            }}
            placeholder="Ism, @username yoki ID"
            className="w-56 rounded-md border border-slate-300 bg-white py-1 pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <select
          value={subQuery.tag ?? ''}
          onChange={(e) => setSubQuery({ ...subQuery, tag: e.target.value || undefined })}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">Barcha teglar</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={subQuery.activeOnly ?? false} onChange={(e) => setSubQuery({ ...subQuery, activeOnly: e.target.checked })} className="accent-brand-500" />
          Faqat faollar
        </label>
        <span className="ml-auto text-xs text-slate-500">{subscribers.length} ta</span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} CSV
        </button>
      </div>

      {notice && <p className="mx-4 mt-2 truncate text-xs text-slate-500">{notice}</p>}

      <div className="flex-1 overflow-auto">
        {subscribers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Hali obunachi yo'q. Botga <code>/start</code> bosilganda shu yerda paydo bo'ladi.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Foydalanuvchi</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Obuna</th>
                <th className="px-4 py-2 font-medium">Holat</th>
                <th className="px-4 py-2 font-medium">Teglar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {subscribers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.first_name || '—'}</div>
                    {s.username && <div className="text-xs text-slate-500">@{s.username}</div>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{s.tg_user_id}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{formatInTz(sqliteToIso(s.subscribed_at), timezone)}</td>
                  <td className="px-4 py-2">
                    {s.unsubscribed_at ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">Chiqqan</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Faol</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(s.tags ?? '')
                        .split(',')
                        .filter(Boolean)
                        .map((t) => (
                          <span key={t} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                            {t}
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
