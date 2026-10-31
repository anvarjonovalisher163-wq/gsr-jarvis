import { useEffect, useState } from 'react'
import { Loader2, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { TemplateView } from '@shared/outreach'
import type { MediaItem, UrlButton } from '@shared/types'
import ButtonsEditor from '@renderer/components/bots/ButtonsEditor'
import Modal from '@renderer/components/ui/Modal'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { btnPrimary, btnSecondary, inputCls } from '@renderer/lib/ui'
import { useOutreach } from '@renderer/store/outreach'

/** Tayyor xabarlar: matn + media + tugmalar (tugmalar faqat bot javobi/rassilkasida ishlaydi). */
export default function TemplatesPanel() {
  const { templates, templatesLoaded, loadTemplates, deleteTemplate } = useOutreach()
  const [editing, setEditing] = useState<TemplateView | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates().catch((e) => setError(describeError(e).message))
  }, [loadTemplates])

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Shablonlar Posting, Chatlar, bot rassilkasi va kampaniyalarda "Tayyor xabar" tugmasi
          orqali bir bosishda qo'yiladi.
        </p>
        <button type="button" onClick={() => setEditing('new')} className={btnPrimary}>
          <Plus size={14} /> Shablon
        </button>
      </div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {templatesLoaded && templates.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          Hali shablon yo'q.
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{t.name}</div>
                <div className="mt-0.5 line-clamp-3 text-xs text-slate-500 dark:text-slate-400">
                  {t.text.replace(/<[^>]+>/g, '') || '—'}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-400">
                  {t.media && (
                    <span className="inline-flex items-center gap-0.5">
                      <Paperclip size={10} /> {t.media.path.split(/[\\/]/).pop()}
                    </span>
                  )}
                  {t.buttons.length > 0 && <span>{t.buttons.flat().length} ta tugma</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Tahrirlash"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.confirm(`"${t.name}" shablonini o'chirasizmi?`) &&
                    deleteTemplate(t.id).catch((e) => setError(describeError(e).message))
                  }
                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  title="O'chirish"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <TemplateForm
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function TemplateForm({
  template,
  onClose
}: {
  template: TemplateView | null
  onClose: () => void
}) {
  const saveTemplate = useOutreach((s) => s.saveTemplate)
  const [name, setName] = useState(template?.name ?? '')
  const [text, setText] = useState(template?.text ?? '')
  const [media, setMedia] = useState<MediaItem | null>(template?.media ?? null)
  const [buttons, setButtons] = useState<UrlButton[][]>(template?.buttons ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async () => {
    try {
      const f = await api.media.pick()
      if (f[0]) setMedia({ path: f[0].path, kind: f[0].kind })
    } catch (e) {
      setError(describeError(e).message)
    }
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveTemplate({ id: template?.id, name, text, media, buttons })
      onClose()
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={template ? 'Shablonni tahrirlash' : 'Yangi shablon'}
      onClose={onClose}
      closable={!busy}
      size="lg"
    >
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nomi (masalan: Narxlar ro'yxati)"
          className={inputCls}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder='Matn. Telegram HTML: <b>qalin</b>, <i>kursiv</i>, <a href="https://…">havola</a>'
          className={`${inputCls} resize-y`}
        />
        <div className="flex items-center gap-2 text-xs">
          <button type="button" onClick={pick} className={btnSecondary}>
            <Paperclip size={13} /> {media ? 'Boshqa fayl' : 'Rasm / video / fayl'}
          </button>
          {media && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
              {media.path.split(/[\\/]/).pop()}
              <button
                type="button"
                onClick={() => setMedia(null)}
                className="text-slate-400 hover:text-red-600"
                aria-label="Olib tashlash"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">
            Tugmalar (faqat botlarda ko'rinadi)
          </div>
          <ButtonsEditor rows={buttons} onChange={setButtons} />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
            Bekor
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className={btnPrimary}
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Saqlash
          </button>
        </div>
      </div>
    </Modal>
  )
}
