import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import type { PhoneImportResult } from '@shared/outreach'
import Modal from '@renderer/components/ui/Modal'
import type { Contact, Tag } from '@shared/types'
import { formatInTz, sqliteToIso } from '@shared/time'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { useAccounts } from '@renderer/store/accounts'
import { useChats } from '@renderer/store/chats'
import { usePosts } from '@renderer/store/posts'
import { TAG_COLORS, useTags } from '@renderer/store/tags'

type ContactRow = Contact & { tagIds: number[] }

/** Kontaktlar (CRM): chapda teglar menejeri, o'ngda teglangan/eslatmali kontaktlar. */
export default function ContactsPage() {
  const { tags, loaded, load } = useTags()
  const accounts = useAccounts((s) => s.accounts)
  const timezone = usePosts((s) => s.timezone)
  const navigate = useNavigate()
  const selectAccount = useAccounts((s) => s.select)
  const selectChat = useChats((s) => s.select)
  const [rows, setRows] = useState<ContactRow[] | null>(null)
  const [tagId, setTagId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!loaded) load().catch(console.error)
  }, [loaded, load])

  useEffect(() => {
    api.contacts
      .list({ tagId: tagId ?? undefined, search: search || undefined })
      .then(setRows)
      .catch((e) => setError(describeError(e).message))
  }, [tagId, search, tags])

  const openChat = (c: ContactRow) => {
    selectAccount(c.account_id)
    selectChat(c.account_id, c.peer_id)
    navigate('/chats')
  }

  return (
    <div className="flex h-full">
      <aside className="w-[300px] shrink-0 border-r border-slate-200 dark:border-slate-800">
        <TagsManager selected={tagId} onSelect={setTagId} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism, @username, eslatma"
              className="w-64 rounded-md border border-slate-300 bg-white py-1 pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          {tagId !== null && (
            <button
              type="button"
              onClick={() => setTagId(null)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800"
            >
              Teg: {tags.find((t) => t.id === tagId)?.name} <X size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setImporting(true)}
            title="Telefon kitobini (csv/txt/vcf) Telegram'ga import qilish"
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Upload size={12} /> Telefon kitobi
          </button>
          <span className="ml-auto text-xs text-slate-500">{rows?.length ?? '…'} ta</span>
        </div>
        {error && (
          <p className="mx-4 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {rows === null && (
            <div className="py-6 text-center text-xs text-slate-400">Yuklanmoqda…</div>
          )}
          {rows && rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              Hali teglangan kontakt yo'q. Chatlar tabida chatni oching → <b>ⓘ Kontakt</b> → teg
              yoki eslatma qo'shing.
            </div>
          )}
          <div className="space-y-2">
            {rows?.map((c) => {
              const acc = accounts.find((a) => a.id === c.account_id)
              return (
                <div
                  key={`${c.account_id}:${c.peer_id}`}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{c.title || c.peer_id}</span>
                      {c.username && <span className="text-xs text-slate-500">@{c.username}</span>}
                      <span className="text-[11px] text-slate-400">
                        · {acc ? acc.first_name || acc.phone : `akkaunt #${c.account_id}`}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.tagIds.map((id) => {
                        const t = tags.find((x) => x.id === id)
                        return t ? (
                          <span
                            key={id}
                            className="rounded-full px-2 py-0.5 text-[11px] text-white"
                            style={{ background: t.color }}
                          >
                            {t.name}
                          </span>
                        ) : null
                      })}
                    </div>
                    {c.note && (
                      <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
                        {c.note}
                      </p>
                    )}
                    <div className="mt-1 text-[11px] text-slate-400">
                      {formatInTz(sqliteToIso(c.updated_at), timezone)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openChat(c)}
                    title="Chatni ochish"
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <MessageSquare size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {importing && <PhoneImportModal onClose={() => setImporting(false)} />}
    </div>
  )
}

/** Telefon kitobini Telegram'ga import (xuddi telefon ilovasidagi sinxronlash). */
function PhoneImportModal({ onClose }: { onClose: () => void }) {
  const accounts = useAccounts((s) => s.accounts)
  const connected = accounts.filter((a) => a.connected)
  const [accountId, setAccountId] = useState<number>(connected[0]?.id ?? 0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PhoneImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.contacts.importPhones(accountId)
      if (r.total > 0) setResult(r)
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Telefon kitobini import qilish" onClose={onClose} closable={!busy} size="lg">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        O'z tanishlaringiz ro'yxati: <code>.csv</code>/<code>.txt</code> (ism, telefon — istalgan
        tartibda) yoki <code>.vcf</code>. Raqamlar Telegram'ga kontakt sifatida qo'shiladi (telefon
        ilovasidagi "kontaktlarni sinxronlash" kabi) va kimda Telegram borligi ko'rinadi. Bir faylda
        500 tagacha, kuniga 500. Kampaniyada faqat <b>o'zaro</b> kontaktlar (ular ham sizning
        raqamingizni saqlagan) tanlanadi.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <select
          value={accountId}
          onChange={(e) => setAccountId(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {connected.map((a) => (
            <option key={a.id} value={a.id}>
              {a.first_name || a.username || a.phone}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={busy || !accountId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Fayl
          tanlash
        </button>
      </div>
      {connected.length === 0 && (
        <p className="mt-2 text-xs text-amber-600">Ulangan akkaunt yo'q.</p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-3 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ["Telegram'da bor", result.imported],
              ["Telegram'da yo'q", result.notOnTelegram],
              ['Keyinroq', result.retry]
            ].map(([l, n]) => (
              <div key={String(l)} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                <div className="text-lg font-semibold">{n}</div>
                <div className="text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          <ul className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
            {result.users.map((u) => (
              <li key={u.peer} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate">{u.title}</span>
                {u.username && <span className="text-slate-400">@{u.username}</span>}
                <span className={u.mutual ? 'text-emerald-600' : 'text-slate-400'}>
                  {u.mutual ? "o'zaro" : 'bir tomonlama'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function TagsManager({
  selected,
  onSelect
}: {
  selected: number | null
  onSelect: (id: number | null) => void
}) {
  const { tags, create, update, remove } = useTags()
  const [editing, setEditing] = useState<Tag | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      setEditing(null)
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Teglar ({tags.length})
        </span>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30"
        >
          <Plus size={13} /> Teg
        </button>
      </div>
      {error && (
        <p className="mx-2 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {editing === 'new' && (
          <TagForm
            onCancel={() => setEditing(null)}
            onSave={(name, color) => act(() => create(name, color))}
          />
        )}
        {tags.length === 0 && editing !== 'new' && (
          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-700">
            Teg yo'q. Masalan: <i>Klient</i>, <i>Hamkor</i>, <i>Hafta</i>.
          </div>
        )}
        {tags.map((t) =>
          editing !== 'new' && editing?.id === t.id ? (
            <TagForm
              key={t.id}
              initial={t}
              onCancel={() => setEditing(null)}
              onSave={(name, color) => act(() => update(t.id, { name, color }))}
            />
          ) : (
            <div
              key={t.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${selected === t.id ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
            >
              <button
                type="button"
                onClick={() => onSelect(selected === t.id ? null : t.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="truncate text-sm">{t.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditing(t)}
                className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-200 group-hover:opacity-100 dark:hover:bg-slate-700"
                aria-label="Tahrirlash"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() =>
                  window.confirm(
                    `"${t.name}" tegini o'chirasizmi? Barcha kontakt va obunachilardan olinadi.`
                  ) && act(() => remove(t.id))
                }
                className="rounded p-1 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                aria-label="O'chirish"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function TagForm({
  initial,
  onSave,
  onCancel
}: {
  initial?: Tag
  onSave: (name: string, color: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? TAG_COLORS[0])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSave(name.trim(), color)
      }}
      className="space-y-2 rounded-lg border border-brand-300 p-2 dark:border-brand-800"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Teg nomi"
        maxLength={40}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="flex flex-wrap gap-1.5">
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-white"
            style={{ background: c }}
            aria-label={c}
          >
            {color === c && <Check size={12} />}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Bekor
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Saqlash
        </button>
      </div>
    </form>
  )
}
