import { useEffect, useRef, useState } from 'react'
import { BookMarked, ChevronDown } from 'lucide-react'
import type { TemplateView } from '@shared/outreach'
import { useOutreach } from '@renderer/store/outreach'

interface Props {
  /** Shablon tanlanganda: matn (va bo'lsa media/tugmalar) qaytadi. */
  onPick: (t: TemplateView) => void
  compact?: boolean
}

/** "Tayyor xabarlar" tugmasi: ro'yxatdan shablon tanlab muharrirga qo'yadi. Hamma muharrirlarda umumiy. */
export default function TemplatePicker({ onPick, compact }: Props) {
  const { templates, templatesLoaded, loadTemplates } = useOutreach()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!templatesLoaded) loadTemplates().catch(console.error)
  }, [templatesLoaded, loadTemplates])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Tayyor xabarlar (shablonlar)"
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <BookMarked size={13} />
        {!compact && 'Tayyor xabar'}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 max-h-64 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {templates.length === 0 && (
            <div className="px-3 py-3 text-xs text-slate-500">
              Shablon yo'q. <b>Xabarnoma → Tayyor xabarlar</b> bo'limida yarating.
            </div>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t)
                setOpen(false)
              }}
              className="block w-full rounded-md px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="truncate text-sm font-medium">{t.name}</div>
              <div className="truncate text-xs text-slate-500">
                {t.media
                  ? `[${t.media.kind === 'photo' ? 'rasm' : t.media.kind === 'video' ? 'video' : 'fayl'}] `
                  : ''}
                {t.text.replace(/<[^>]+>/g, '').slice(0, 60)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
