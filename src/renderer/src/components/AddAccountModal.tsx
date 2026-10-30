import { api } from '@renderer/lib/api'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Modal from '@renderer/components/ui/Modal'
import { describeError } from '@renderer/lib/errors'

type Step = 'phone' | 'code' | 'password'

interface Props {
  onClose: () => void
}

/** Akkaunt qo'shish: telefon → kod → (kerak bo'lsa) 2FA parol. */
export default function AddAccountModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('+998')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [hint, setHint] = useState('')
  const [viaApp, setViaApp] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [waitLeft, setWaitLeft] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    setError(null)
  }, [step])

  // FLOOD_WAIT: qolgan soniyani sanaymiz
  useEffect(() => {
    if (waitLeft <= 0) return
    const t = setTimeout(() => setWaitLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [waitLeft])

  const fail = (e: unknown) => {
    const d = describeError(e)
    setError(d)
    if (d.retryAfter) setWaitLeft(d.retryAfter)
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const submitPhone = () =>
    run(async () => {
      const r = await api.accounts.sendCode(phone)
      setViaApp(r.viaApp)
      setStep('code')
    })

  const submitCode = () =>
    run(async () => {
      const r = await api.accounts.signIn(code)
      if (r.status === 'password') {
        setHint(r.hint)
        setStep('password')
      } else {
        onClose()
      }
    })

  const submitPassword = () =>
    run(async () => {
      await api.accounts.check2FA(password)
      onClose()
    })

  const close = () => {
    api.accounts.cancelLogin().catch(() => {})
    onClose()
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || waitLeft > 0) return
    if (step === 'phone') submitPhone()
    else if (step === 'code') submitCode()
    else submitPassword()
  }

  const titles: Record<Step, string> = {
    phone: 'Akkaunt qo\'shish',
    code: 'Tasdiqlash kodi',
    password: 'Ikki bosqichli parol'
  }

  return (
    <Modal title={titles[step]} onClose={close} closable={!busy}>
      <form onSubmit={onSubmit} className="space-y-4">
        <StepDots step={step} />

        {step === 'phone' && (
          <Field label="Telefon raqam" help="Xalqaro formatda, masalan +998901234567">
            <input
              ref={inputRef}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        )}

        {step === 'code' && (
          <Field
            label="Kod"
            help={
              viaApp
                ? `Kod ${phone} raqamidagi Telegram ilovasiga yuborildi.`
                : `Kod ${phone} raqamiga SMS orqali yuborildi.`
            }
          >
            <input
              ref={inputRef}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputCls} tracking-[0.4em] text-center text-lg`}
              autoComplete="one-time-code"
              placeholder="•••••"
            />
          </Field>
        )}

        {step === 'password' && (
          <Field label="Parol" help={hint ? `Eslatma: ${hint}` : 'Akkauntda ikki bosqichli tekshiruv yoqilgan.'}>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              autoComplete="current-password"
            />
          </Field>
        )}

        {error && <ErrorBox code={error.code} message={error.message} waitLeft={waitLeft} />}

        <div className="flex items-center justify-between pt-1">
          {step !== 'phone' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCode('')
                setPassword('')
                setStep('phone')
              }}
              className="text-sm text-slate-500 hover:text-slate-900 disabled:opacity-40 dark:hover:text-slate-100"
            >
              ← Raqamni o'zgartirish
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy || waitLeft > 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {step === 'phone' ? 'Kod yuborish' : step === 'code' ? 'Kirish' : 'Tasdiqlash'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{help}</span>}
    </label>
  )
}

function StepDots({ step }: { step: Step }) {
  const idx = step === 'phone' ? 0 : step === 'code' ? 1 : 2
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${i <= idx ? 'w-6 bg-brand-500' : 'w-3 bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </div>
  )
}

function ErrorBox({ code, message, waitLeft }: { code: string; message: string; waitLeft: number }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
      <p>{message}</p>
      {code === 'FLOOD_WAIT' && waitLeft > 0 && (
        <p className="mt-1 text-xs opacity-80">Qolgan vaqt: {formatSeconds(waitLeft)}</p>
      )}
      {code === 'API_CREDENTIALS_MISSING' && (
        <Link to="/settings" className="mt-1 inline-block text-xs font-medium underline">
          Sozlamalar'ga o'tish →
        </Link>
      )}
    </div>
  )
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m} daq ${sec} son` : `${sec} son`
}
