import { useEffect } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import Placeholder from '@renderer/components/Placeholder'
import DialogList from '@renderer/components/chats/DialogList'
import MessageList from '@renderer/components/chats/MessageList'
import Composer from '@renderer/components/chats/Composer'
import { useAccounts } from '@renderer/store/accounts'
import { useChats, initChatsSync } from '@renderer/store/chats'

/** Chatlar: tepada akkaunt tablari, o'rtada dialoglar, o'ngda xabarlar. */
export default function ChatsPage() {
  const { accounts, selectedId, select } = useAccounts()
  const { account } = useChats()

  useEffect(() => initChatsSync(), [])

  const active = accounts.filter((a) => a.status === 'active')
  const current = active.find((a) => a.id === selectedId) ?? active[0] ?? null

  if (!current) {
    return <Placeholder icon={MessageSquare} title="Chatlar" description="Chap paneldan Telegram akkaunt qo'shing — dialoglar shu yerda ochiladi." step={4} />
  }

  const acc = account(current.id)
  const dialog = acc.dialogs.find((d) => d.peer === acc.selected) ?? null

  return (
    <div className="flex h-full flex-col">
      {/* Akkaunt tablari (TG Master'dagidek) */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
        {active.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => select(a.id)}
            className={[
              'flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1 text-sm',
              a.id === current.id ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            ].join(' ')}
          >
            {a.avatarUrl ? <img src={a.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="inline-block h-5 w-5 rounded-full bg-brand-200 text-center text-[11px] leading-5 text-brand-800">{(a.first_name || a.phone).charAt(0)}</span>}
            {a.first_name || a.username || a.phone}
            <span className={`h-1.5 w-1.5 rounded-full ${a.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          </button>
        ))}
        <button type="button" title="Akkaunt qo'shish (chap panel)" className="ml-1 shrink-0 rounded-lg p-1.5 text-slate-400" disabled>
          <Plus size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[320px] shrink-0 border-r border-slate-200 dark:border-slate-800">
          <DialogList accountId={current.id} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[#e7ebf0] dark:bg-[#0e1621]">
          {!acc.selected || !dialog ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Chat tanlang</div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{dialog.title}</div>
                  <div className="truncate text-xs text-slate-500">
                    {dialog.username ? `@${dialog.username}` : dialog.kind === 'channel' ? 'kanal' : dialog.kind === 'group' ? 'guruh' : dialog.kind === 'bot' ? 'bot' : 'shaxsiy chat'}
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <MessageList key={`${current.id}:${acc.selected}`} accountId={current.id} peer={acc.selected} />
              </div>
              <Composer accountId={current.id} peer={acc.selected} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
