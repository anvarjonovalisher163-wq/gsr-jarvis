import { api } from '@renderer/lib/api'
import { useEffect, useState } from 'react'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { useTheme } from '@renderer/store/theme'
import { describeError } from '@renderer/lib/errors'
import { DEFAULT_TIMEZONE, TIMEZONES, formatInTz, isValidTimezone } from '@shared/time'
import { usePosts } from '@renderer/store/posts'
import { useLicense } from '@renderer/store/license'
import { PLAN_LABEL } from '@shared/license'
import { useUpdater } from '@renderer/store/updater'
import { NO_PROXY, type AppSettings, type ProxyConfig } from '@shared/network'
import type { ApiServerStatus, UserProfile } from '@shared/outreach'

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

      <LicenseSection />
      <ProfileSection />
      <TelegramApiSection />
      <SessionImportSection />
      <TimezoneSection />
      <AppSection />
      <ProxySection />
      <ApiServerSection />
      <BackupSection />

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
        <UpdateRow />
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
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} />
            ) : null}
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
            saytiga kiring va telefon raqamingizni kiriting. Tasdiqlash kodi Telegram ilovasiga
            keladi.
          </li>
          <li>
            <b>API development tools</b> bo'limini oching.
          </li>
          <li>
            Ilova nomi (masalan, <i>TG Manager</i>) va qisqa nom kiriting, platforma: <i>Desktop</i>
            .
          </li>
          <li>
            <b>Create application</b> bosing. Ochilgan sahifadagi <b>App api_id</b> va{' '}
            <b>App api_hash</b> ni shu yerga nusxalang.
          </li>
          <li>api_hash maxfiy — hech kimga bermang. U faqat shu kompyuterdagi bazada saqlanadi.</li>
        </ol>
      )}
    </section>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950'

function TimezoneSection() {
  const [tz, setTz] = useState(DEFAULT_TIMEZONE)
  const [custom, setCustom] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const loadTimezone = usePosts((s) => s.loadTimezone)

  useEffect(() => {
    api.settings.get(['app.timezone']).then((v) => {
      const value = v['app.timezone'] || DEFAULT_TIMEZONE
      setTz(value)
      setCustom(!TIMEZONES.some((t) => t.id === value))
    })
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])

  const save = async (value: string) => {
    setError(null)
    if (!isValidTimezone(value)) {
      setError('Bunday vaqt zonasi topilmadi (masalan: Asia/Tashkent).')
      return
    }
    try {
      await api.settings.set({ 'app.timezone': value })
      setTz(value)
      await loadTimezone()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold">Vaqt zonasi</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Rejali postlar vaqti shu zonada kiritiladi. Hozir:{' '}
        {isValidTimezone(tz) ? formatInTz(now, tz) : '—'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!custom ? (
          <select
            value={tz}
            onChange={(e) => save(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {TIMEZONES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            onBlur={() => save(tz)}
            onKeyDown={(e) => e.key === 'Enter' && save(tz)}
            placeholder="Asia/Tashkent"
            className={`${inputCls} w-64 font-mono`}
          />
        )}
        <button
          type="button"
          onClick={() => setCustom((c) => !c)}
          className="text-xs text-brand-600 hover:underline dark:text-brand-300"
        >
          {custom ? "Ro'yxatdan tanlash" : 'Boshqa zona kiritish'}
        </button>
        {saved && <span className="text-xs text-emerald-600">Saqlandi</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}

function LicenseSection() {
  const { status, openModal, check, deactivate } = useLicense()
  const timezone = usePosts((s) => s.timezone)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!status) return null
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg(ok)
    } catch (e) {
      setMsg(describeError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const stateLabel: Record<string, string> = {
    none: "Litsenziya yo'q",
    active: 'Faol',
    expired: 'Muddati tugagan',
    stale: 'Tekshirilmagan (oflayn)',
    unconfigured: 'Server sozlanmagan (dev rejim)',
    owner: 'Shaxsiy rejim — cheksiz, litsenziya talab qilinmaydi'
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold">Litsenziya</h2>
      <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-1 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Holat</dt>
        <dd className={status.readOnly ? 'text-red-600 dark:text-red-400' : ''}>
          {stateLabel[status.state]}
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Tarif</dt>
        <dd>{status.plan ? PLAN_LABEL[status.plan] : '—'}</dd>
        {status.email && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Email</dt>
            <dd>{status.email}</dd>
          </>
        )}
        {status.keyMasked && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Kalit</dt>
            <dd className="font-mono text-xs">{status.keyMasked}</dd>
          </>
        )}
        {status.expiresAt && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Tugaydi</dt>
            <dd>{formatInTz(status.expiresAt, timezone)}</dd>
          </>
        )}
        {status.lastCheckedAt && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Oxirgi tekshiruv</dt>
            <dd>{formatInTz(status.lastCheckedAt, timezone)}</dd>
          </>
        )}
        <dt className="text-slate-500 dark:text-slate-400">Limitlar</dt>
        <dd>
          {status.usage.accounts}/{status.limits.accounts >= 9999 ? '∞' : status.limits.accounts}{' '}
          akkaunt · {status.usage.bots}/{status.limits.bots >= 9999 ? '∞' : status.limits.bots} bot
          · {status.usage.messages}/{status.limits.messages ?? '∞'} xabar
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Qurilma ID</dt>
        <dd className="font-mono text-[11px] text-slate-500">{status.deviceId.slice(0, 16)}…</dd>
      </dl>
      {status.state !== 'owner' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openModal('key')}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Kalit kiritish
          </button>
          {status.state !== 'unconfigured' && status.state !== 'none' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(check, 'Tekshirildi.')}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Hozir tekshirish
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  window.confirm(
                    'Litsenziyani shu qurilmadan olib tashlaysizmi? Boshqa qurilmada ishlatish uchun kalitni qayta kiritasiz.'
                  ) && run(deactivate, 'Olib tashlandi.')
                }
                className="text-sm text-slate-500 hover:text-red-600"
              >
                Qurilmadan olib tashlash
              </button>
            </>
          )}
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </div>
      )}
    </section>
  )
}

function UpdateRow() {
  const { status, check } = useUpdater()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!status) return null

  const label: Record<string, string> = {
    disabled: "Dev rejim — yangilanish o'chiq",
    idle: 'Tekshirilmagan',
    checking: 'Tekshirilmoqda…',
    available: `Yangi versiya: ${status.version}`,
    downloading: `Yuklab olinmoqda ${status.percent ?? 0}%`,
    downloaded: `${status.version} yuklab olindi — qayta ishga tushiring`,
    'up-to-date': "Eng so'nggi versiya",
    error: `Xato: ${status.error ?? ''}`
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">Yangilanish:</span>
      <span>{label[status.state]}</span>
      <button
        type="button"
        disabled={busy || status.state === 'disabled' || status.state === 'downloading'}
        onClick={async () => {
          setBusy(true)
          setMsg(null)
          try {
            await check()
          } catch (e) {
            setMsg(describeError(e).message)
          } finally {
            setBusy(false)
          }
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Yangilanishni tekshirish
      </button>
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </div>
  )
}

function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  useEffect(() => {
    api.app.getSettings().then(setSettings).catch(console.error)
  }, [])
  const update = async (patch: Partial<AppSettings>) =>
    setSettings(await api.app.setSettings(patch))
  return { settings, update }
}

function AppSection() {
  const { settings, update } = useAppSettings()
  const [error, setError] = useState<string | null>(null)
  if (!settings) return null
  const toggle = (patch: Partial<AppSettings>) =>
    update(patch).catch((e) => setError(describeError(e).message))

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold">Ilova</h2>
      <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.closeToTray}
            onChange={(e) => toggle({ closeToTray: e.target.checked })}
            className="accent-brand-500"
          />
          Oynani yopganda tray'da qolsin
          <span className="text-xs text-slate-500">
            — rejali rassilkalar va botlar fonda ishlaydi
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.autoStart}
            onChange={(e) => toggle({ autoStart: e.target.checked })}
            className="accent-brand-500"
          />
          Tizim bilan birga ishga tushsin
          {window.platform === 'linux' && (
            <span className="text-xs text-slate-500">(Linux'da hozircha yo'q)</span>
          )}
        </label>
        <div className="flex items-center gap-2">
          <span>Til</span>
          <select
            value={settings.language}
            onChange={(e) => toggle({ language: e.target.value as AppSettings['language'] })}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="uz">O'zbek</option>
            <option value="ru" disabled>
              Русский (tez orada)
            </option>
            <option value="en" disabled>
              English (tez orada)
            </option>
          </select>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}

function ProxySection() {
  const { settings, update } = useAppSettings()
  const [form, setForm] = useState<ProxyConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (settings) setForm(settings.proxy)
  }, [settings])
  if (!form) return null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await update({ proxy: form.type === 'none' ? NO_PROXY : form })
      setMsg(
        form.type === 'none'
          ? "Proksi o'chirildi."
          : 'Saqlandi — Telegram ulanishlari yangi proksi bilan qayta qurilmoqda.'
      )
    } catch (err) {
      setMsg(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold">Proksi</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Telegram cheklangan tarmoqlar uchun. SOCKS5 — akkauntlar, botlar va litsenziya uchun; HTTP —
        faqat botlar va litsenziya (MTProto HTTP proksi orqali ishlamaydi).
      </p>
      <form onSubmit={save} className="mt-3 grid grid-cols-[110px_1fr_90px] gap-2 text-sm">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as ProxyConfig['type'] })}
          className={inputCls}
        >
          <option value="none">Yo'q</option>
          <option value="socks5">SOCKS5</option>
          <option value="http">HTTP</option>
        </select>
        <input
          value={form.host}
          disabled={form.type === 'none'}
          onChange={(e) => setForm({ ...form, host: e.target.value.trim() })}
          placeholder="host yoki IP"
          className={inputCls}
        />
        <input
          type="number"
          value={form.port}
          disabled={form.type === 'none'}
          onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
          min={1}
          max={65535}
          className={inputCls}
        />
        <span className="self-center text-xs text-slate-500">Login (ixtiyoriy)</span>
        <input
          value={form.username}
          disabled={form.type === 'none'}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="username"
          className={inputCls}
          autoComplete="off"
        />
        <input
          type="password"
          value={form.password}
          disabled={form.type === 'none'}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="parol"
          className={inputCls}
          autoComplete="off"
        />
        <div className="col-span-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || (form.type !== 'none' && !form.host)}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Saqlash
          </button>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </div>
      </form>
    </section>
  )
}

function BackupSection() {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const run = async (kind: 'export' | 'import') => {
    setBusy(kind)
    setMsg(null)
    try {
      if (kind === 'export') {
        const r = await api.backup.export()
        setMsg(r.path ? `Saqlandi: ${r.path}` : null)
      } else {
        const r = await api.backup.import()
        setMsg(r.restarted ? 'Tiklanmoqda, ilova qayta ishga tushadi…' : null)
      }
    } catch (e) {
      setMsg(describeError(e).message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold">Zaxira nusxa</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Baza (akkauntlar, botlar, postlar, obunachilar) va avatarlar .zip faylga. Sessiya va
        tokenlar shifrlangan — faqat shu kompyuterda tiklanadi.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('export')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Eksport (.zip)
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run('import')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Import…
        </button>
        {msg && <span className="truncate text-xs text-slate-500">{msg}</span>}
      </div>
    </section>
  )
}

function SessionImportSection() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<
    { index: number; ok: boolean; label: string | null; error: string | null }[] | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const run = async () => {
    setBusy(true)
    setError(null)
    setResults(null)
    try {
      setResults(await api.accounts.importSessions(lines))
      setText('')
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold">Akkauntlarni import qilish (sessiya orqali)</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Boshqa dasturdan (GramJS, Telethon va shu kabi) olingan <b>StringSession</b> satrlari — har
        qatorga bittadan. Kod kerak bo'lmaydi, akkaunt darhol ulanadi. Telegram Desktop{' '}
        <code>tdata</code> papkasi qo'llanmaydi.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={'1AQAOMTQ5LjE1NC4xNjcuNTEAU...\n1BAAOMTQ5LjE1NC4xNjcuOTE...'}
        spellCheck={false}
        className={`${inputCls} mt-3 resize-y font-mono text-xs`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || lines.length === 0}
          onClick={run}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Import ({lines.length})
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            setResults(null)
            try {
              const r = await api.accounts.importFiles()
              if (r.length) setResults(r)
            } catch (e) {
              setError(describeError(e).message)
            } finally {
              setBusy(false)
            }
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Fayldan (.session / .zip / .json)
        </button>
        {busy && <span className="text-xs text-slate-500">Har akkaunt 5–30 soniya…</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      {results && (
        <ul className="mt-3 space-y-1 text-xs">
          {results.map((r) => (
            <li
              key={r.index}
              className={
                r.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'
              }
            >
              {r.ok
                ? `✓ ${r.label}`
                : `✗ ${r.label ? r.label + ': ' : `${r.index + 1}-qator: `}${r.error}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProfileSection() {
  const [p, setP] = useState<UserProfile>({ name: '', email: '', phone: '' })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.profile
      .get()
      .then(setP)
      .catch(() => {})
  }, [])
  const save = async () => {
    setError(null)
    try {
      setP(await api.profile.set(p))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(describeError(e).message)
    }
  }
  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold">Profil</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Ism, email va telefon — hisobotlar va API javoblarida ko'rsatish uchun (ixtiyoriy).
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input
          value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })}
          placeholder="Ism"
          className={inputCls}
        />
        <input
          value={p.email}
          onChange={(e) => setP({ ...p, email: e.target.value })}
          placeholder="Email"
          className={inputCls}
        />
        <input
          value={p.phone}
          onChange={(e) => setP({ ...p, phone: e.target.value })}
          placeholder="+998…"
          className={inputCls}
        />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Saqlash
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Check size={14} /> Saqlandi
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </section>
  )
}

function ApiServerSection() {
  const [st, setSt] = useState<ApiServerStatus | null>(null)
  const [port, setPort] = useState('')
  const [limit, setLimit] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    api.apiServer
      .status()
      .then(apply)
      .catch((e) => setError(describeError(e).message))
    return api.on('apiServer:changed', apply)
    function apply(s: ApiServerStatus) {
      setSt(s)
      setPort(String(s.port))
      setLimit(String(s.dailyLimit))
    }
  }, [])

  const run = async (fn: () => Promise<ApiServerStatus>) => {
    setBusy(true)
    setError(null)
    try {
      setSt(await fn())
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(false)
    }
  }
  const copy = (what: string, v: string) => {
    navigator.clipboard.writeText(v).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  if (!st) return null
  const example = `curl -X POST ${st.baseUrl}/send \\
  -H "X-Api-Key: ${showKey ? st.key : '<API-KALIT>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"@username","text":"Salom! Buyurtmangiz tayyor."}'`

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">REST API (CRM integratsiyasi)</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Faqat shu kompyuterdan (127.0.0.1). CRM yoki skriptingiz so'rov yuboradi — xabar
            akkauntdan ketadi. Har so'rov bitta xabar: @username, +telefon (maxfiylik ruxsat bersa)
            yoki chat id. Qora ro'yxat va kunlik limit amal qiladi.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={st.enabled}
            disabled={busy}
            onChange={(e) => run(() => api.apiServer.configure({ enabled: e.target.checked }))}
            className="accent-brand-500"
          />
          Yoqilgan
        </label>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:items-center">
        <span className="text-slate-500">Holat</span>
        <span className={st.running ? 'text-emerald-600' : 'text-slate-500'}>
          {st.running
            ? `Ishlamoqda · ${st.baseUrl}`
            : st.enabled
              ? `Ishlamayapti${st.lastError ? ` — ${st.lastError}` : ''}`
              : "O'chiq"}
        </span>
        <span className="text-slate-500">API kalit</span>
        <span className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
            {showKey ? st.key : '•'.repeat(24)}
          </code>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-xs text-brand-600 hover:underline"
          >
            {showKey ? 'Yashirish' : "Ko'rsatish"}
          </button>
          <button
            type="button"
            onClick={() => copy('key', st.key)}
            className="text-xs text-brand-600 hover:underline"
          >
            {copied === 'key' ? 'Nusxalandi' : 'Nusxalash'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              window.confirm(
                'Kalit yangilansa eski kalit bilan ulanganlar ishlamay qoladi. Davom etilsinmi?'
              ) && run(() => api.apiServer.regenerateKey())
            }
            className="text-xs text-slate-500 hover:underline"
          >
            Yangilash
          </button>
        </span>
        <span className="text-slate-500">Port</span>
        <span className="flex items-center gap-2">
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className={`${inputCls.replace('w-full ', '')} w-28`}
          />
          <span className="text-slate-500">Kunlik limit</span>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className={`${inputCls.replace('w-full ', '')} w-24`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => api.apiServer.configure({ port: Number(port), dailyLimit: Number(limit) }))
            }
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Saqlash
          </button>
        </span>
        <span className="text-slate-500">Bugun yuborildi</span>
        <span>{st.sentToday}</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-slate-500">Misol va yo'llar</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
          {example}
        </pre>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-slate-500">
          <li>
            <code>GET /api/status</code> — holat va akkauntlar
          </li>
          <li>
            <code>GET /api/accounts</code> — akkauntlar ro'yxati (id bilan)
          </li>
          <li>
            <code>POST /api/send</code> —{' '}
            <code>{'{"account_id":1,"to":"@user","text":"..."}'}</code>; javob{' '}
            <code>{'{"ok":true,"message_id":…}'}</code>, xato: 401 kalit, 404 topilmadi, 429
            limit/FLOOD_WAIT
          </li>
          <li>
            Sarlavha: <code>X-Api-Key</code> yoki <code>Authorization: Bearer</code>. Kalitni
            brauzer/xabarlarga bermang.
          </li>
        </ul>
      </details>
    </section>
  )
}
