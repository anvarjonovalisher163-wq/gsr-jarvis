import { Download, Loader2, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { describeError } from '@renderer/lib/errors'
import { useUpdater } from '@renderer/store/updater'

/** "Yangi versiya bor" bildirishnomasi (yuqorida). */
export default function UpdateBanner() {
  const { status, dismissedVersion, download, install, dismiss } = useUpdater()
  const [error, setError] = useState<string | null>(null)
  if (!status) return null
  const show = status.state === 'available' || status.state === 'downloading' || status.state === 'downloaded'
  if (!show || (status.version && status.version === dismissedVersion && status.state === 'available')) return null

  const act = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2 text-xs text-brand-900 dark:border-brand-900/50 dark:bg-brand-950/40 dark:text-brand-100">
      <Download size={14} className="shrink-0" />
      <span className="flex-1">
        {status.state === 'available' && (
          <>
            <b>TG Manager {status.version}</b> chiqdi (sizda {status.currentVersion}).
          </>
        )}
        {status.state === 'downloading' && <>Yangilanish yuklab olinmoqda… {status.percent ?? 0}%</>}
        {status.state === 'downloaded' && (
          <>
            <b>{status.version}</b> yuklab olindi — o'rnatish uchun ilova qayta ishga tushadi.
          </>
        )}
        {error && <span className="ml-2 text-red-600">{error}</span>}
      </span>
      {status.state === 'available' && (
        <button type="button" onClick={() => act(download)} className="rounded-md bg-brand-500 px-2.5 py-1 font-medium text-white hover:bg-brand-600">
          Yuklab olish
        </button>
      )}
      {status.state === 'downloading' && <Loader2 size={14} className="animate-spin" />}
      {status.state === 'downloaded' && (
        <button type="button" onClick={() => act(install)} className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1 font-medium text-white hover:bg-brand-600">
          <RefreshCw size={12} /> O'rnatish va qayta ishga tushirish
        </button>
      )}
      {status.state !== 'downloading' && (
        <button type="button" onClick={dismiss} className="rounded-md p-1 hover:bg-brand-100 dark:hover:bg-brand-900/50" aria-label="Yopish">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
