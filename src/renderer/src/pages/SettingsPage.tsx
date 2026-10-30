import { useEffect, useState } from 'react'
import { useTheme } from '@renderer/store/theme'

export default function SettingsPage() {
  const [version, setVersion] = useState('…')
  const { theme, set } = useTheme()

  useEffect(() => {
    window.api.app.getVersion().then(setVersion)
  }, [])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Sozlamalar</h1>

      <section className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Ko'rinish</h2>
        <div className="mt-3 flex gap-2">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set(t)}
              className={[
                'rounded-md border px-3 py-1.5 text-sm',
                theme === t
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              ].join(' ')}
            >
              {t === 'light' ? "Yorug'" : "Qorong'i"}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Ilova haqida</h2>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500 dark:text-slate-400">Versiya</dt>
          <dd>{version}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Platforma</dt>
          <dd>{window.platform}</dd>
        </dl>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Telegram API (api_id, api_hash) sozlamalari 3-qadamda qo'shiladi.
        </p>
      </section>
    </div>
  )
}
