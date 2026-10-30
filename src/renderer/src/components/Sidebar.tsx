import { api } from '@renderer/lib/api'
import { Plus, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccounts } from '@renderer/store/accounts'
import AccountItem from '@renderer/components/AccountItem'
import AddAccountModal from '@renderer/components/AddAccountModal'
import { describeError } from '@renderer/lib/errors'

export default function Sidebar() {
  const [version, setVersion] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { accounts, loaded, selectedId, select } = useAccounts()

  useEffect(() => {
    api.app.getVersion().then(setVersion)
  }, [])

  const isMac = window.platform === 'darwin'

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      setNotice(describeError(e).message)
      setTimeout(() => setNotice(null), 5000)
    }
  }

  const logout = (id: number) => act(() => api.accounts.logout(id))
  const remove = (id: number, label: string) => {
    if (!window.confirm(`"${label}" akkauntini o'chirasizmi? Kanallari va teglari ham o'chadi.`)) return
    act(() => api.accounts.remove(id))
  }

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      {/* Logo. macOS'da chiroq tugmalar uchun tepadan joy qoldiramiz */}
      <div className={`drag-region flex items-center gap-2 px-4 ${isMac ? 'pt-10 pb-3' : 'py-4'}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Send size={16} />
        </div>
        <span className="text-base font-semibold">TG Manager</span>
      </div>

      {/* Akkauntlar */}
      <div className="flex items-center justify-between px-4 pb-2 pt-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Akkauntlar {accounts.length > 0 && <span className="font-normal">({accounts.length})</span>}
        </span>
        <button
          type="button"
          title="Akkaunt qo'shish"
          onClick={() => setAdding(true)}
          className="no-drag rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {loaded && accounts.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Hali akkaunt qo'shilmagan.
            <br />+ tugmasini bosing.
          </div>
        )}
        {accounts.map((a) => (
          <AccountItem
            key={a.id}
            account={a}
            selected={a.id === selectedId}
            onSelect={() => select(a.id)}
            onLogout={() => logout(a.id)}
            onRemove={() => remove(a.id, a.first_name || a.username || a.phone)}
          />
        ))}
      </div>

      {notice && (
        <div className="mx-2 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {notice}
        </div>
      )}

      {/* Tarif bloki (hozircha statik) */}
      <div className="m-2 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Free Trial</span>
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            7 kun
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span>Yuborildi</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">0/100</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-0 bg-brand-500" />
        </div>
        <div className="mt-2 text-[10px] text-slate-400">{version ? `v${version}` : ''}</div>
      </div>

      {adding && <AddAccountModal onClose={() => setAdding(false)} />}
    </aside>
  )
}
