import { useState } from 'react'
import { Bot as BotIcon, ExternalLink, Loader2, Plus, Power, Trash2, Users } from 'lucide-react'
import type { BotView } from '@shared/ipc'
import Modal from '@renderer/components/ui/Modal'
import { describeError } from '@renderer/lib/errors'
import { useBots } from '@renderer/store/bots'

export default function BotList() {
  const { bots, loaded, selectedId, select, start, stop, remove } = useBots()
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (id: number, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Botlar {bots.length > 0 && <span className="font-normal">({bots.length})</span>}
        </span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30"
        >
          <Plus size={13} /> Bot qo'shish
        </button>
      </div>

      {error && <p className="mx-2 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {loaded && bots.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Hali bot yo'q. @BotFather'dan token oling va "Bot qo'shish" bosing.
          </div>
        )}
        {bots.map((b) => (
          <BotRow
            key={b.id}
            bot={b}
            selected={b.id === selectedId}
            busy={busyId === b.id}
            onSelect={() => select(b.id)}
            onToggle={() => act(b.id, () => (b.running ? stop(b.id) : start(b.id)))}
            onRemove={() => {
              if (window.confirm(`@${b.username} botini o'chirasizmi? Qoidalari va obunachilar ro'yxati ham o'chadi.`)) {
                act(b.id, () => remove(b.id))
              }
            }}
          />
        ))}
      </div>

      {adding && <AddBotModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function BotRow({
  bot,
  selected,
  busy,
  onSelect,
  onToggle,
  onRemove
}: {
  bot: BotView
  selected: boolean
  busy: boolean
  onSelect: () => void
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={[
        'group rounded-lg p-2 text-left transition-colors',
        selected ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
            <BotIcon size={16} />
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-50 dark:border-slate-900 ${bot.running ? 'bg-emerald-500' : 'bg-slate-400'}`}
            title={bot.running ? 'Ishlayapti' : "To'xtagan"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{bot.title}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">@{bot.username}</span>
            <span className="inline-flex items-center gap-0.5">
              <Users size={11} /> {bot.subscribers}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          disabled={busy}
          title={bot.running ? "To'xtatish" : 'Ishga tushirish'}
          className={[
            'rounded-md p-1.5 disabled:opacity-40',
            bot.running
              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700'
          ].join(' ')}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          disabled={busy}
          title="O'chirish"
          className="rounded-md p-1.5 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-40 dark:hover:bg-red-950/40"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {bot.lastError && !bot.running && (
        <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{bot.lastError}</p>
      )}
    </div>
  )
}

function AddBotModal({ onClose }: { onClose: () => void }) {
  const add = useBots((s) => s.add)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await add(token)
      onClose()
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Bot qo'shish" onClose={onClose} closable={!busy}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Bot tokeni</span>
          <input
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456789:AAH..."
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <ol className="list-decimal space-y-1 rounded-lg bg-slate-50 p-3 pl-7 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <li>
            Telegram'da{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-600 hover:underline dark:text-brand-300">
              @BotFather <ExternalLink size={10} />
            </a>{' '}
            ni oching, <b>/newbot</b> yuboring.
          </li>
          <li>Bot nomi va username (…bot bilan tugaydi) kiriting.</li>
          <li>BotFather bergan tokenni shu yerga nusxalang. Token maxfiy — shifrlangan holda saqlanadi.</li>
        </ol>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Tekshirish va qo'shish
          </button>
        </div>
      </form>
    </Modal>
  )
}
