import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, RefreshCw, Trash2 } from 'lucide-react'
import type { LogEntry, LogLevel } from '@shared/types'
import type { LogQuery } from '@shared/tasks'
import { formatInTz, sqliteToIso } from '@shared/time'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { usePosts } from '@renderer/store/posts'

const LEVEL_CLS: Record<LogLevel, string> = {
  debug: 'text-slate-400',
  info: 'text-sky-600 dark:text-sky-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400'
}

export default function LogsPanel() {
  const [query, setQuery] = useState<LogQuery>({})
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const timezone = usePosts((s) => s.timezone)

  const load = useCallback(async () => {
    try {
      const [l, m] = await Promise.all([api.logs.list(query), api.logs.modules()])
      setLogs(l)
      setModules(m)
    } catch (e) {
      setNotice(describeError(e).message)
    }
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  const copy = async () => {
    const text = logs
      .slice()
      .reverse()
      .map((r) => `${r.created_at} [${r.level.toUpperCase()}] [${r.module}] ${r.message}${r.meta_json ? ' ' + r.meta_json : ''}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setNotice(`${logs.length} ta qator nusxalandi`)
    setTimeout(() => setNotice(null), 2000)
  }

  const exportTxt = async () => {
    try {
      const r = await api.logs.export(query)
      setNotice(r.path ? `${r.count} ta qator saqlandi: ${r.path}` : null)
    } catch (e) {
      setNotice(describeError(e).message)
    }
  }

  const clear = async () => {
    if (!window.confirm("Barcha loglarni o'chirasizmi?")) return
    await api.logs.clear()
    load()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <select value={query.level ?? ''} onChange={(e) => setQuery({ ...query, level: (e.target.value || undefined) as LogLevel | undefined })} className={selectCls}>
          <option value="">Barcha darajalar</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <select value={query.module ?? ''} onChange={(e) => setQuery({ ...query, module: e.target.value || undefined })} className={selectCls}>
          <option value="">Barcha modullar</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value || undefined })}
          placeholder="Qidirish…"
          className={`${selectCls} w-48`}
        />
        <span className="ml-auto text-xs text-slate-500">{logs.length} ta</span>
        <Tool icon={RefreshCw} title="Yangilash" onClick={load} />
        <Tool icon={Copy} title="Nusxa olish" onClick={copy} />
        <Tool icon={Download} title=".txt eksport" onClick={exportTxt} />
        <Tool icon={Trash2} title="Tozalash" onClick={clear} danger />
      </div>
      {notice && <p className="mx-4 mt-2 truncate text-xs text-slate-500">{notice}</p>}
      <div className="flex-1 overflow-auto p-3 font-mono text-[11.5px] leading-relaxed">
        {logs.length === 0 && <p className="p-4 text-center font-sans text-sm text-slate-500">Log yozuvlari yo'q.</p>}
        {logs.map((r) => (
          <div key={r.id} className="flex gap-2 whitespace-pre-wrap break-all border-b border-slate-100 py-0.5 dark:border-slate-800/60">
            <span className="shrink-0 text-slate-400">{formatInTz(sqliteToIso(r.created_at), timezone, true).slice(11)}</span>
            <span className={`w-11 shrink-0 font-semibold ${LEVEL_CLS[r.level]}`}>{r.level.toUpperCase()}</span>
            <span className="shrink-0 text-violet-600 dark:text-violet-300">[{r.module}]</span>
            <span className="min-w-0">
              {r.message}
              {r.meta_json && <span className="text-slate-400"> {r.meta_json}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const selectCls = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950'

function Tool({ icon: Icon, title, onClick, danger }: { icon: typeof Copy; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md p-1.5 ${danger ? 'text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
      <Icon size={14} />
    </button>
  )
}
