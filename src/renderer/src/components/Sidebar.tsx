import { api } from '@renderer/lib/api'
import { Plus, Send, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccounts } from '@renderer/store/accounts'
import AccountItem from '@renderer/components/AccountItem'
import AddAccountModal from '@renderer/components/AddAccountModal'
import AccountsManagerModal from '@renderer/components/AccountsManagerModal'
import { describeError } from '@renderer/lib/errors'
import PlanBlock from '@renderer/components/license/PlanBlock'

export default function Sidebar() {
  const [version, setVersion] = useState<string>('')
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(false)
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
    if (!window.confirm(`"${label}" akkauntini o'chirasizmi? Kanallari va teglari ham o'chadi.`))
      return
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
          Akkauntlar{' '}
          {accounts.length > 0 && <span className="font-normal">({accounts.length})</span>}
        </span>
        <div className="flex items-center">
          <button
            type="button"
            title="Akkauntlar boshqaruvi (import, eksport, spam test)"
            onClick={() => setManaging(true)}
            className="no-drag rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <SlidersHorizontal size={15} />
          </button>
          <button
            type="button"
            title="Akkaunt qo'shish"
            onClick={() => setAdding(true)}
            className="no-drag rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Plus size={16} />
          </button>
        </div>
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

      <PlanBlock version={version} />

      {adding && <AddAccountModal onClose={() => setAdding(false)} />}
      {managing && <AccountsManagerModal onClose={() => setManaging(false)} />}
    </aside>
  )
}
