import { useState } from 'react'
import { LogOut, Trash2 } from 'lucide-react'
import type { AccountView } from '@shared/ipc'
import ContextMenu from '@renderer/components/ui/ContextMenu'

interface Props {
  account: AccountView
  selected: boolean
  onSelect: () => void
  onLogout: () => void
  onRemove: () => void
}

export default function AccountItem({ account, selected, onSelect, onLogout, onRemove }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const name = account.first_name || account.username || account.phone
  const loggedOut = account.status !== 'active'

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        title={account.phone}
        className={[
          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
          selected
            ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
        ].join(' ')}
      >
        <Avatar account={account} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-medium ${loggedOut ? 'text-slate-400' : ''}`}>{name}</div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {loggedOut
              ? account.status === 'banned'
                ? 'Bloklangan'
                : 'Chiqilgan'
              : account.username
                ? `@${account.username}`
                : account.phone}
          </div>
        </div>
      </button>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            ...(account.status === 'active' ? [{ label: 'Chiqish', icon: LogOut, onClick: onLogout }] : []),
            { label: "O'chirish", icon: Trash2, danger: true, onClick: onRemove }
          ]}
        />
      )}
    </>
  )
}

function Avatar({ account }: { account: AccountView }) {
  const initial = (account.first_name || account.username || '?').charAt(0).toUpperCase()
  return (
    <div className="relative shrink-0">
      {account.avatarUrl ? (
        <img src={account.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
          {initial}
        </div>
      )}
      {/* Onlayn (ulangan) statusi */}
      <span
        className={[
          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-50 dark:border-slate-900',
          account.connected ? 'bg-emerald-500' : 'bg-slate-400'
        ].join(' ')}
        title={account.connected ? 'Ulangan' : 'Ulanmagan'}
      />
    </div>
  )
}
