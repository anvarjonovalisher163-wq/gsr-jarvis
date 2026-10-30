import { api } from '@renderer/lib/api'
import { useEffect, useState } from 'react'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { useTheme } from '@renderer/store/theme'
import { describeError } from '@renderer/lib/errors'

const KEY_API_ID = 'telegram.api_id'
const KEY_API_HASH = 'telegram.api_hash'

export default function SettingsPage() {
  const [version, setVersion] = useState('…')
  const { theme, set } = useTheme()

  useEffect(() => {
    api.app.getVersion().then(setVersion)
  }, [])

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Sozlamalar</h1>

      <TelegramApiSection />

      <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
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
      </section>
    </div>
  )
}

function TelegramApiSection() {
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    api.settings
      .get([KEY_API_ID, KEY_API_HASH])
      .then((v) => {
        setApiId(v[KEY_API_ID] ?? '')
        setApiHash(v[KEY_API_HASH] ?? '')
        setLoaded(true)
      })
      .catch((e) => setError(describeError(e).message))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (apiId && !/^\d+$/.test(apiId.trim())) {
      setError("api_id faqat raqamlardan iborat bo'lishi kerak.")
      return
    }
    if (apiHash && !/^[a-f0-9]{32}$/i.test(apiHash.trim())) {
      setError("api_hash 32 ta belgidan iborat bo'lishi kerak.")
      return
    }
    setSaving(true)
    try {
      await api.settings.set({ [KEY_API_ID]: apiId.trim(), [KEY_API_HASH]: apiHash.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const complete = apiId.trim() !== '' && apiHash.trim() !== ''

  return (
    <section className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Telegram API</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Akkaunt qo'shish uchun my.telegram.org dan olingan api_id va api_hash kerak.
          </p>
        </div>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
            complete
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          ].join(' ')}
        >
          {complete ? 'Kiritilgan' : 'Kiritilmagan'}
        </span>
      </div>

      <form onSubmit={save} className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">api_id</span>
          <input
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
            disabled={!loaded}
            inputMode="numeric"
            placeholder="1234567"
            className={inputCls}
            spellCheck={false}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">api_hash</span>
          <input
            value={apiHash}
            onChange={(e) => setApiHash(e.target.value)}
            disabled={!loaded}
            placeholder="32 ta belgi"
            className={`${inputCls} font-mono`}
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!loaded || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? 'Saqlandi' : 'Saqlash'}
          </button>
          <button
            type="button"
            onClick={() => setShowGuide((s) => !s)}
            className="text-sm text-brand-600 hover:underline dark:text-brand-300"
          >
            Qanday olish kerak?
          </button>
        </div>
      </form>

      {showGuide && (
        <ol className="mt-4 list-decimal space-y-1.5 rounded-lg bg-slate-50 p-4 pl-8 text-sm dark:bg-slate-950">
          <li>
            <a
              href="https://my.telegram.org"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-300"
            >
              my.telegram.org <ExternalLink size={12} />
            </a>{' '}
            saytiga kiring va telefon raqamingizni kiriting. Tasdiqlash kodi Telegram ilovasiga keladi.
          </li>
          <li>
            <b>API development tools</b> bo'limini oching.
          </li>
          <li>
            Ilova nomi (masalan, <i>TG Manager</i>) va qisqa nom kiriting, platforma: <i>Desktop</i>.
          </li>
          <li>
            <b>Create application</b> bosing. Ochilgan sahifadagi <b>App api_id</b> va <b>App api_hash</b> ni shu
            yerga nusxalang.
          </li>
          <li>
            api_hash maxfiy — hech kimga bermang. U faqat shu kompyuterdagi bazada saqlanadi.
          </li>
        </ol>
      )}
    </section>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950'
