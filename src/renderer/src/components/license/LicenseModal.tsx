import { useState } from 'react'
import { KeyRound, Loader2, Mail } from 'lucide-react'
import Modal from '@renderer/components/ui/Modal'
import { describeError } from '@renderer/lib/errors'
import { useLicense } from '@renderer/store/license'

/** Trial (email) yoki litsenziya kaliti kiritish. */
export default function LicenseModal() {
  const { modal, status, closeModal, openModal, startTrial, activate } = useLicense()
  const [email, setEmail] = useState(status?.email ?? '')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!modal) return null
  const isTrial = modal === 'trial'
  const mustChoose = status?.state === 'none' // litsenziyasiz ishlab bo'lmaydi — yopib bo'lmaydi

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (isTrial) await startTrial(email)
      else await activate(key)
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={isTrial ? '7 kunlik bepul sinov' : 'Litsenziya kaliti'} onClose={closeModal} closable={!busy && !mustChoose}>
      <form onSubmit={submit} className="space-y-4">
        {isTrial ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              TG Manager'ni 7 kun bepul sinab ko'ring: 2 ta akkaunt, 1 ta bot, 100 ta xabar. Karta kerak emas.
            </p>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Email</span>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@example.com" className={`${inputCls} pl-9`} />
              </div>
              <span className="mt-1 block text-xs text-slate-500">Litsenziya shu emailga bog'lanadi. Reklama yuborilmaydi.</span>
            </label>
          </>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Kalit</span>
            <div className="relative">
              <KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="TGM-PRO-AB12-CD34-EF56"
                spellCheck={false}
                className={`${inputCls} pl-9 font-mono tracking-wide`}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-500">Kalit sotib olinganda emailga yuboriladi.</span>
          </label>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => openModal(isTrial ? 'key' : 'trial')} className="text-sm text-brand-600 hover:underline dark:text-brand-300">
            {isTrial ? 'Kalitim bor' : 'Bepul sinov'}
          </button>
          <button
            type="submit"
            disabled={busy || (isTrial ? !email.trim() : !key.trim())}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {isTrial ? 'Sinovni boshlash' : 'Faollashtirish'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
