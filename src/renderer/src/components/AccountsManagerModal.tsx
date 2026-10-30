import { useState } from 'react'
import { Download, FileUp, Loader2, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import type { AccountView, SessionImportResult, SpamCheckResult } from '@shared/ipc'
import Modal from '@renderer/components/ui/Modal'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { useAccounts } from '@renderer/store/accounts'

/**
 * Akkauntlar boshqaruvi: jadval, fayldan import (.session/.zip/.json), eksport, spam test.
 * Hech qanday "akkaunt rotatsiyasi" yoki ommaviy DM yo'q — faqat akkauntlarni boshqarish.
 */
export default function AccountsManagerModal({ onClose }: { onClose: () => void }) {
  const accounts = useAccounts((s) => s.accounts)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [importResults, setImportResults] = useState<SessionImportResult[] | null>(null)
  const [spam, setSpam] = useState<Record<number, SpamCheckResult | { error: string }>>({})

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allSelected = accounts.length > 0 && accounts.every((a) => selected.has(a.id))

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setNotice({ kind: 'err', text: describeError(e).message })
    } finally {
      setBusy(null)
    }
  }

  const importFiles = () =>
    run('import', async () => {
      const res = await api.accounts.importFiles()
      if (res.length === 0) return
      setImportResults(res)
      const ok = res.filter((r) => r.ok).length
      setNotice({
        kind: ok ? 'ok' : 'err',
        text: `Import: ${ok} ta muvaffaqiyatli, ${res.length - ok} ta xato`
      })
    })

  const exportSel = () =>
    run('export', async () => {
      const ids = [...selected]
      if (
        !window.confirm(
          `${ids.length} ta akkaunt sessiyasi matn fayliga yoziladi.\n\nDIQQAT: bu fayl akkauntlarga TO'LIQ kirish beradi (parolsiz). Faqat o'zingiz saqlang, hech kimga bermang.`
        )
      )
        return
      const r = await api.accounts.exportSessions(ids)
      if (r.path) setNotice({ kind: 'ok', text: `${r.count} ta sessiya saqlandi: ${r.path}` })
    })

  const spamTest = (ids: number[]) =>
    run('spam', async () => {
      for (const id of ids) {
        try {
          const r = await api.accounts.spamCheck(id)
          setSpam((s) => ({ ...s, [id]: r }))
        } catch (e) {
          setSpam((s) => ({ ...s, [id]: { error: describeError(e).message } }))
        }
      }
    })

  const logout = (a: AccountView) => run(`logout${a.id}`, () => api.accounts.logout(a.id))
  const remove = (a: AccountView) => {
    if (
      !window.confirm(
        `"${a.first_name || a.username || a.phone}" akkauntini o'chirasizmi? Kanallari va teglari ham o'chadi.`
      )
    )
      return
    run(`remove${a.id}`, () => api.accounts.remove(a.id))
  }

  const connectedSelected = accounts
    .filter((a) => selected.has(a.id) && a.connected)
    .map((a) => a.id)

  return (
    <Modal title={`Akkauntlar boshqaruvi (${accounts.length})`} onClose={onClose} size="xl">
      <div className="flex flex-wrap items-center gap-2">
        <ToolBtn
          icon={FileUp}
          label="Fayldan import"
          busy={busy === 'import'}
          onClick={importFiles}
          primary
        />
        <ToolBtn
          icon={Download}
          label={`Eksport${selected.size ? ` (${selected.size})` : ''}`}
          disabled={selected.size === 0}
          busy={busy === 'export'}
          onClick={exportSel}
        />
        <ToolBtn
          icon={ShieldCheck}
          label={`Spam test${connectedSelected.length ? ` (${connectedSelected.length})` : ''}`}
          disabled={connectedSelected.length === 0}
          busy={busy === 'spam'}
          onClick={() => spamTest(connectedSelected)}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Import: <code>.session</code> (Telethon/Pyrogram), <code>.zip</code>, <code>.json</code>,{' '}
        <code>.txt</code> (StringSession satrlari). Telegram Desktop <code>tdata</code>{' '}
        qo'llanmaydi. Spam test — @SpamBot'dan akkaunt cheklovi holatini so'raydi.
      </p>

      {notice && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}
        >
          {notice.text}
        </div>
      )}
      {importResults && (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
          {importResults.map((r) => (
            <li
              key={r.index}
              className={
                r.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'
              }
            >
              {r.ok ? '✓' : '✗'} {r.label ?? `${r.index + 1}-qator`}
              {!r.ok && r.error ? ` — ${r.error}` : ''}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(accounts.map((a) => a.id)))
                  }
                  className="accent-brand-500"
                />
              </th>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Akkaunt</th>
              <th className="px-3 py-2">Telefon</th>
              <th className="px-3 py-2">Holat</th>
              <th className="px-3 py-2">Spam test</th>
              <th className="px-3 py-2 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-slate-500">
                  Hali akkaunt yo'q — "Fayldan import" yoki chap paneldagi + tugmasi.
                </td>
              </tr>
            )}
            {accounts.map((a, i) => {
              const sp = spam[a.id]
              return (
                <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      className="accent-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {a.avatarUrl ? (
                        <img
                          src={a.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                          {(a.first_name || a.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {a.first_name || a.username || a.phone}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {a.username ? `@${a.username}` : '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{a.phone}</td>
                  <td className="px-3 py-2">
                    <Status account={a} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {!sp ? (
                      a.connected ? (
                        <button
                          type="button"
                          onClick={() => spamTest([a.id])}
                          disabled={busy === 'spam'}
                          className="text-brand-600 hover:underline disabled:opacity-50"
                        >
                          Tekshirish
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )
                    ) : 'error' in sp ? (
                      <span className="text-red-600" title={sp.error}>
                        Xato
                      </span>
                    ) : (
                      <span
                        title={sp.text}
                        className={
                          sp.status === 'free'
                            ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : sp.status === 'limited'
                              ? 'rounded bg-red-50 px-1.5 py-0.5 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : 'rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800'
                        }
                      >
                        {sp.status === 'free'
                          ? "Cheklov yo'q"
                          : sp.status === 'limited'
                            ? `Cheklangan${sp.until ? ` · ${sp.until}` : ''}`
                            : "Noma'lum"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {a.status === 'active' && (
                        <IconBtn
                          title="Chiqish"
                          onClick={() => logout(a)}
                          busy={busy === `logout${a.id}`}
                        >
                          <LogOut size={14} />
                        </IconBtn>
                      )}
                      <IconBtn
                        title="O'chirish"
                        danger
                        onClick={() => remove(a)}
                        busy={busy === `remove${a.id}`}
                      >
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function Status({ account }: { account: AccountView }) {
  if (account.status === 'banned')
    return (
      <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
        Bloklangan
      </span>
    )
  if (account.status !== 'active')
    return (
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800">
        Chiqilgan
      </span>
    )
  return account.connected ? (
    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      Ulangan
    </span>
  ) : (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      Ulanmoqda…
    </span>
  )
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
  busy,
  disabled,
  primary
}: {
  icon: typeof FileUp
  label: string
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        primary
          ? 'bg-brand-500 text-white hover:bg-brand-600'
          : 'border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
      }`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  )
}

function IconBtn({
  title,
  onClick,
  busy,
  danger,
  children
}: {
  title: string
  onClick: () => void
  busy?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={busy}
      className={`rounded-md p-1.5 disabled:opacity-50 ${danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  )
}
