import { useEffect } from 'react'
import { Hash, Loader2, Megaphone, RefreshCw, Users } from 'lucide-react'
import type { AccountView, ChannelView } from '@shared/ipc'
import { useAccounts } from '@renderer/store/accounts'
import { useChannels } from '@renderer/store/channels'

/** Posting tabining chap qismi: akkaunt bo'yicha guruhlangan "Kanallarim", checkbox bilan. */
export default function ChannelList() {
  const accounts = useAccounts((s) => s.accounts)
  const { channels, loaded, selectedIds, syncing, errors, load, sync, toggle, selectAllFor } = useChannels()

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  const activeAccounts = accounts.filter((a) => a.status === 'active')

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Kanallarim{selectedIds.length > 0 && <span className="ml-1 font-normal">· {selectedIds.length} tanlandi</span>}
        </span>
        <button
          type="button"
          disabled={activeAccounts.length === 0 || syncing.length > 0}
          onClick={() => activeAccounts.forEach((a) => a.connected && sync(a.id))}
          title="Barcha akkauntlarni yangilash"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw size={13} className={syncing.length > 0 ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {accounts.length === 0 && loaded && (
          <Empty>Avval chap paneldan Telegram akkaunt qo'shing.</Empty>
        )}

        {accounts.map((account) => (
          <AccountGroup
            key={account.id}
            account={account}
            channels={channels.filter((c) => c.account_id === account.id)}
            selectedIds={selectedIds}
            syncing={syncing.includes(account.id)}
            error={errors[account.id]}
            onSync={() => sync(account.id)}
            onToggle={toggle}
            onSelectAll={(on) => selectAllFor(account.id, on)}
          />
        ))}
      </div>
    </div>
  )
}

interface GroupProps {
  account: AccountView
  channels: ChannelView[]
  selectedIds: number[]
  syncing: boolean
  error?: string
  onSync: () => void
  onToggle: (id: number) => void
  onSelectAll: (on: boolean) => void
}

function AccountGroup({ account, channels, selectedIds, syncing, error, onSync, onToggle, onSelectAll }: GroupProps) {
  const name = account.first_name || account.username || account.phone
  const allSelected = channels.length > 0 && channels.every((c) => selectedIds.includes(c.id))
  const canSync = account.status === 'active' && account.connected

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 px-1 py-1">
        <input
          type="checkbox"
          checked={allSelected}
          disabled={channels.length === 0}
          onChange={(e) => onSelectAll(e.target.checked)}
          title="Hammasini tanlash"
          className="h-3.5 w-3.5 accent-brand-500"
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{name}</span>
        <button
          type="button"
          disabled={!canSync || syncing}
          onClick={onSync}
          title={canSync ? 'Shu akkaunt kanallarini yangilash' : 'Akkaunt ulanmagan'}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
        >
          {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      {error && <p className="px-1 pb-1 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {channels.length === 0 && !syncing && (
        <Empty>
          {canSync ? (
            <>
              Kanallar hali yuklanmagan.{' '}
              <button type="button" onClick={onSync} className="font-medium text-brand-600 hover:underline dark:text-brand-300">
                Yangilash
              </button>
            </>
          ) : (
            'Akkaunt ulanmagan.'
          )}
        </Empty>
      )}

      {channels.map((c) => (
        <label
          key={c.id}
          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(c.id)}
            onChange={() => onToggle(c.id)}
            className="h-3.5 w-3.5 accent-brand-500"
          />
          <ChannelAvatar channel={c} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{c.title}</span>
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
              {c.username ? `@${c.username}` : c.type === 'channel' ? 'Yopiq kanal' : 'Yopiq guruh'}
            </span>
          </span>
          {c.type === 'channel' ? (
            <Megaphone size={13} className="shrink-0 text-slate-400" />
          ) : (
            <Users size={13} className="shrink-0 text-slate-400" />
          )}
        </label>
      ))}
    </div>
  )
}

function ChannelAvatar({ channel }: { channel: ChannelView }) {
  return channel.avatarUrl ? (
    <img src={channel.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" draggable={false} />
  ) : (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
      <Hash size={13} />
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 px-2 py-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {children}
    </div>
  )
}
