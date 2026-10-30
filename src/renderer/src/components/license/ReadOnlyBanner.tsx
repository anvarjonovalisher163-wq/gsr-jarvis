import { Lock, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useLicense } from '@renderer/store/license'

/** Faqat ko'rish rejimi haqida yuqori banner. */
export default function ReadOnlyBanner() {
  const { status, openModal, check } = useLicense()
  const [busy, setBusy] = useState(false)
  if (!status || !status.readOnly || status.state === 'none') return null

  const text =
    status.state === 'stale'
      ? "Litsenziya 3 kundan beri tekshirilmadi — faqat ko'rish rejimi. Internetga ulanib tekshiring."
      : "Litsenziya muddati tugagan — faqat ko'rish rejimi. Yangi post, rassilka, akkaunt va bot qo'shish bloklangan."

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      <Lock size={14} className="shrink-0" />
      <span className="flex-1">{text}</span>
      {status.state === 'stale' && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await check()
            } finally {
              setBusy(false)
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 font-medium hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:hover:bg-amber-900/40"
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Tekshirish
        </button>
      )}
      <button type="button" onClick={() => openModal('key')} className="rounded-md bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700">
        Litsenziya kiritish
      </button>
    </div>
  )
}
