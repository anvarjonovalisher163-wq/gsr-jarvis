import { useState } from 'react'
import { FileText, Image as ImageIcon, Link2, Loader2, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import type { BotRuleInput } from '@shared/ipc'
import type { BotRule, BotRuleTrigger, MediaItem, UrlButton } from '@shared/types'
import { mediaUrl } from '@shared/media'
import Modal from '@renderer/components/ui/Modal'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { stripTags } from '@renderer/lib/telegramHtml'
import { useBots } from '@renderer/store/bots'

const TRIGGER_LABEL: Record<BotRuleTrigger, string> = { command: 'Buyruq', keyword: "Kalit so'z", any: 'Boshqa hammasi' }
const TRIGGER_CLS: Record<BotRuleTrigger, string> = {
  command: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  keyword: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  any: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
}

export default function RulesPanel({ botId }: { botId: number }) {
  const { rules, deleteRule, toggleRule } = useBots()
  const [editing, setEditing] = useState<BotRule | null | 'new'>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Qoidalar tartib bilan tekshiriladi: buyruq → kalit so'z → boshqa hammasi. Faqat shaxsiy chatlarda ishlaydi.
        </p>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus size={14} /> Qoida
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {rules.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          Hali qoida yo'q. /start uchun standart salomlashuv ishlaydi; o'zgartirish uchun "start" buyrug'iga qoida qo'shing.
        </div>
      )}

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className={`rounded-xl border border-slate-200 p-3 dark:border-slate-800 ${r.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TRIGGER_CLS[r.trigger_type]}`}>{TRIGGER_LABEL[r.trigger_type]}</span>
                  {r.trigger_value && (
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                      {r.trigger_type === 'command' ? `/${r.trigger_value}` : r.trigger_value}
                    </code>
                  )}
                  {r.reply_media_json && <ImageIcon size={13} className="text-slate-400" />}
                  {r.reply_buttons_json && <Link2 size={13} className="text-slate-400" />}
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{stripTags(r.reply_text, 200) || '(media)'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" checked={r.is_active === 1} onChange={(e) => act(() => toggleRule(r.id, e.target.checked))} className="accent-brand-500" />
                  Faol
                </label>
                <button type="button" title="Tahrirlash" onClick={() => setEditing(r)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="O'chirish"
                  onClick={() => window.confirm("Qoidani o'chirasizmi?") && act(() => deleteRule(r.id))}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && <RuleForm botId={botId} rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function parseJson<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

function RuleForm({ botId, rule, onClose }: { botId: number; rule: BotRule | null; onClose: () => void }) {
  const saveRule = useBots((s) => s.saveRule)
  const [type, setType] = useState<BotRuleTrigger>(rule?.trigger_type ?? 'keyword')
  const [value, setValue] = useState(rule?.trigger_value ?? '')
  const [text, setText] = useState(rule?.reply_text ?? '')
  const [media, setMedia] = useState<MediaItem | null>(parseJson<MediaItem | null>(rule?.reply_media_json ?? null, null))
  const [buttons, setButtons] = useState<UrlButton[][]>(parseJson<UrlButton[][]>(rule?.reply_buttons_json ?? null, []))
  const [active, setActive] = useState(rule ? rule.is_active === 1 : true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async () => {
    try {
      const files = await api.media.pick()
      if (files[0]) setMedia({ path: files[0].path, kind: files[0].kind })
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  const setBtn = (ri: number, bi: number, patch: Partial<UrlButton>) =>
    setButtons((rows) => rows.map((r, i) => (i === ri ? r.map((b, j) => (j === bi ? { ...b, ...patch } : b)) : r)))
  const removeBtn = (ri: number, bi: number) =>
    setButtons((rows) => rows.map((r, i) => (i === ri ? r.filter((_, j) => j !== bi) : r)).filter((r) => r.length))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const input: BotRuleInput = {
      id: rule?.id,
      bot_id: botId,
      trigger_type: type,
      trigger_value: type === 'any' ? null : value,
      reply_text: text,
      reply_media: media,
      reply_buttons: buttons,
      is_active: active
    }
    try {
      await saveRule(input)
      onClose()
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={rule ? 'Qoidani tahrirlash' : 'Yangi qoida'} onClose={onClose} closable={!busy}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium">Qachon ishlaydi</span>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['command', 'keyword', 'any'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${type === t ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}
              >
                {TRIGGER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {type !== 'any' && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{type === 'command' ? 'Buyruq' : "Kalit so'z"}</span>
            <div className="flex items-center">
              {type === 'command' && <span className="mr-1 text-slate-400">/</span>}
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'command' ? 'narx' : 'narx'}
                className={inputCls}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-500">
              {type === 'command' ? 'Foydalanuvchi /narx yuborganda.' : "Xabar ichida shu so'z bo'lsa (katta-kichik harf farqsiz)."}
            </span>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Javob matni</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Telegram HTML: <b>qalin</b>, <i>kursiv</i>, <a href=&quot;https://…&quot;>havola</a>"
            className={`${inputCls} resize-y`}
          />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium">Media (ixtiyoriy)</span>
          {media ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              {media.kind === 'photo' ? (
                <img src={mediaUrl(media.path)} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-slate-500 dark:bg-slate-800">
                  {media.kind === 'video' ? <Play size={16} /> : <FileText size={16} />}
                </div>
              )}
              <span className="min-w-0 flex-1 truncate text-xs">{media.path.split(/[\\/]/).pop()}</span>
              <button type="button" onClick={() => setMedia(null)} className="text-slate-400 hover:text-red-600" aria-label="Olib tashlash">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={pick} className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700">
              + Rasm / video / fayl tanlash
            </button>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">Tugmalar (URL)</span>
            <button type="button" onClick={() => setButtons((r) => [...r, [{ text: '', url: 'https://' }]])} className="text-xs text-brand-600 hover:underline dark:text-brand-300">
              + Qator
            </button>
          </div>
          <div className="space-y-2">
            {buttons.map((row, ri) => (
              <div key={ri} className="space-y-1 rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
                {row.map((b, bi) => (
                  <div key={bi} className="flex items-center gap-1">
                    <input value={b.text} onChange={(e) => setBtn(ri, bi, { text: e.target.value })} placeholder="Matn" className={`${inputCls} w-1/3 py-1 text-xs`} />
                    <input value={b.url} onChange={(e) => setBtn(ri, bi, { url: e.target.value })} placeholder="https://…" className={`${inputCls} flex-1 py-1 font-mono text-xs`} />
                    <button type="button" onClick={() => removeBtn(ri, bi)} className="p-1 text-slate-400 hover:text-red-600" aria-label="O'chirish">
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {row.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setButtons((rows) => rows.map((r, i) => (i === ri ? [...r, { text: '', url: 'https://' }] : r)))}
                    className="text-[11px] text-slate-500 hover:text-brand-600"
                  >
                    + shu qatorga tugma
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-brand-500" />
          Faol
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Bekor
          </button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />}
            Saqlash
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950'
