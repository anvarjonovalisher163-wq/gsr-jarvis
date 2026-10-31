/** Umumiy input klassi (barcha formalar). */
export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900'

export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50'
export const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800'

/** Kenglik berilmagan input (yonma-yon qisqa maydonlar uchun). */
export const inputClsAuto = inputCls.replace('w-full ', '')
