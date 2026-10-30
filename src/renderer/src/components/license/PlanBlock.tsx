import { AlertTriangle } from 'lucide-react'
import { PLAN_LABEL } from '@shared/license'
import { formatInTz } from '@shared/time'
import { useLicense } from '@renderer/store/license'
import { usePosts } from '@renderer/store/posts'

/** Chap pastdagi tarif bloki: tarif, "Yuborildi X/Y", "Tugaydi: sana". */
export default function PlanBlock({ version }: { version: string }) {
  const status = useLicense((s) => s.status)
  const openModal = useLicense((s) => s.openModal)
  const timezone = usePosts((s) => s.timezone)

  if (!status) {
    return <div className="m-2 h-24 animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
  }

  const planLabel = status.plan ? PLAN_LABEL[status.plan] : 'Litsenziya yo\'q'
  const unlimited = status.limits.messages === null
  const pct = unlimited ? 0 : Math.min(100, Math.round((status.usage.messages / Math.max(1, status.limits.messages!)) * 100))
  const daysLeft = status.expiresAt ? Math.max(0, Math.ceil((Date.parse(status.expiresAt) - Date.now()) / 86_400_000)) : null

  const warn = status.readOnly || (daysLeft !== null && daysLeft <= 3) || (!unlimited && pct >= 90)
  const badge =
    status.state === 'expired'
      ? 'Tugagan'
      : status.state === 'stale'
        ? 'Tekshirilmagan'
        : status.state === 'unconfigured'
          ? 'Dev'
          : daysLeft !== null && status.plan === 'trial'
            ? `${daysLeft} kun`
            : status.plan === 'agency'
              ? 'Cheksiz'
              : ''

  return (
    <div className={`m-2 rounded-lg border p-3 text-xs ${warn ? 'border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">{planLabel}</span>
        {badge && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${status.readOnly ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-slate-500 dark:text-slate-400">
        <span>Yuborildi</span>
        <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {status.usage.messages}
          {unlimited ? '' : `/${status.limits.messages}`}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className={`h-full ${pct >= 90 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-slate-500 dark:text-slate-400">
        <span>Akkaunt / bot</span>
        <span className="tabular-nums text-slate-700 dark:text-slate-200">
          {status.usage.accounts}/{status.limits.accounts >= 9999 ? '∞' : status.limits.accounts} · {status.usage.bots}/
          {status.limits.bots >= 9999 ? '∞' : status.limits.bots}
        </span>
      </div>

      {status.expiresAt && (
        <div className="mt-1 text-slate-500 dark:text-slate-400">
          {status.state === 'expired' ? 'Tugagan: ' : 'Tugaydi: '}
          <span className="text-slate-700 dark:text-slate-200">{formatInTz(status.expiresAt, timezone).slice(0, 10)}</span>
        </div>
      )}

      {status.readOnly && (
        <p className="mt-2 flex items-start gap-1 text-[11px] text-red-700 dark:text-red-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {status.state === 'stale' ? '3 kundan beri tekshirilmadi — faqat ko\'rish.' : status.state === 'none' ? 'Trial yoki kalit kerak.' : 'Faqat ko\'rish rejimi.'}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => openModal('key')} className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300">
          {status.plan === 'trial' || status.state === 'none' ? 'Litsenziya kiritish' : 'Kalitni almashtirish'}
        </button>
        <span className="text-[10px] text-slate-400">{version ? `v${version}` : ''}</span>
      </div>
    </div>
  )
}
