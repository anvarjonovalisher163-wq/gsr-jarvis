import { X } from 'lucide-react'
import type { UrlButton } from '@shared/types'

interface Props {
  rows: UrlButton[][]
  onChange: (rows: UrlButton[][]) => void
  /** Bir qatorda nechta tugma bo'lishi mumkin. */
  maxPerRow?: number
}

/** Inline URL tugmalar muharriri: qatorlar → tugmalar (matn + havola). Qoidalar va rassilkada umumiy. */
export default function ButtonsEditor({ rows, onChange, maxPerRow = 3 }: Props) {
  const setBtn = (ri: number, bi: number, patch: Partial<UrlButton>) =>
    onChange(rows.map((r, i) => (i === ri ? r.map((b, j) => (j === bi ? { ...b, ...patch } : b)) : r)))
  const removeBtn = (ri: number, bi: number) =>
    onChange(rows.map((r, i) => (i === ri ? r.filter((_, j) => j !== bi) : r)).filter((r) => r.length))
  const addRow = () => onChange([...rows, [{ text: '', url: 'https://' }]])
  const addToRow = (ri: number) => onChange(rows.map((r, i) => (i === ri ? [...r, { text: '', url: 'https://' }] : r)))

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">Tugmalar (URL)</span>
        <button type="button" onClick={addRow} className="text-xs text-brand-600 hover:underline dark:text-brand-300">
          + Qator
        </button>
      </div>
      {rows.length === 0 && <p className="text-xs text-slate-400">Tugma yo'q. Xabar ostida havola tugmalari chiqishi uchun qator qo'shing.</p>}
      <div className="space-y-2">
        {rows.map((row, ri) => (
          <div key={ri} className="space-y-1 rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
            {row.map((b, bi) => (
              <div key={bi} className="flex items-center gap-1">
                <input value={b.text} onChange={(e) => setBtn(ri, bi, { text: e.target.value })} placeholder="Matn" className={`${inputCls} w-1/3`} />
                <input value={b.url} onChange={(e) => setBtn(ri, bi, { url: e.target.value })} placeholder="https://…" className={`${inputCls} flex-1 font-mono`} />
                <button type="button" onClick={() => removeBtn(ri, bi)} className="p-1 text-slate-400 hover:text-red-600" aria-label="O'chirish">
                  <X size={13} />
                </button>
              </div>
            ))}
            {row.length < maxPerRow && (
              <button type="button" onClick={() => addToRow(ri)} className="text-[11px] text-slate-500 hover:text-brand-600">
                + shu qatorga tugma
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const inputCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
