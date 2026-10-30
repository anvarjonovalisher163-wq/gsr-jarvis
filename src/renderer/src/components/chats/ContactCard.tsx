import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { DialogView } from '@shared/chats'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { TAG_COLORS, useTags } from '@renderer/store/tags'

/** Chat ochilganda o'ng tomonda: ism, username, teglar, eslatma. */
export default function ContactCard({ accountId, dialog, onClose }: { accountId: number; dialog: DialogView; onClose: () => void }) {
  const { tags, load, loaded, create, setPeerTags, maps, loadMap } = useTags()
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [newTag, setNewTag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tagIds = maps[accountId]?.[dialog.peer] ?? []
  const meta = { accountId, peer: dialog.peer, title: dialog.title, username: dialog.username, kind: dialog.kind }

  useEffect(() => {
    if (!loaded) load().catch(console.error)
    if (!maps[accountId]) loadMap(accountId).catch(console.error)
  }, [accountId, loaded, load, loadMap, maps])

  useEffect(() => {
    api.contacts
      .get(accountId, dialog.peer)
      .then((r) => {
        setNote(r.contact?.note ?? '')
        setSavedNote(r.contact?.note ?? '')
      })
      .catch(() => {})
  }, [accountId, dialog.peer])

  const toggle = async (id: number) => {
    const next = tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id]
    try {
      await setPeerTags({ ...meta, tagIds: next })
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  const addTag = async () => {
    if (!newTag?.trim()) return setNewTag(null)
    try {
      const t = await create(newTag.trim(), TAG_COLORS[tags.length % TAG_COLORS.length])
      await setPeerTags({ ...meta, tagIds: [...tagIds, t.id] })
      setNewTag(null)
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  const saveNote = async () => {
    if (note === savedNote) return
    try {
      await api.contacts.setNote({ ...meta, note })
      setSavedNote(note)
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <span className="text-sm font-semibold">Kontakt</span>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Yopish">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <div className="text-base font-semibold">{dialog.title}</div>
          <div className="text-xs text-slate-500">
            {dialog.username ? `@${dialog.username} · ` : ''}
            {dialog.kind === 'channel' ? 'kanal' : dialog.kind === 'group' ? 'guruh' : dialog.kind === 'bot' ? 'bot' : 'shaxsiy'}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-slate-500">Teglar</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = tagIds.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${on ? 'text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'}`}
                  style={on ? { background: t.color, borderColor: t.color } : undefined}
                >
                  {on && <Check size={11} />}
                  {t.name}
                </button>
              )
            })}
            {newTag === null ? (
              <button type="button" onClick={() => setNewTag('')} className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700">
                <Plus size={11} /> Yangi teg
              </button>
            ) : (
              <input
                autoFocus
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onBlur={addTag}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTag()
                  if (e.key === 'Escape') setNewTag(null)
                }}
                placeholder="Teg nomi"
                className="w-28 rounded-full border border-brand-400 px-2 py-0.5 text-xs outline-none dark:bg-slate-900"
              />
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-slate-500">Eslatma</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            rows={6}
            placeholder="Shu kontakt haqida eslatma (faqat sizga ko'rinadi)…"
            className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="text-right text-[11px] text-slate-400">{note !== savedNote ? 'Saqlanmagan — fokusdan chiqsa saqlanadi' : savedNote ? 'Saqlangan' : ''}</div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </aside>
  )
}
