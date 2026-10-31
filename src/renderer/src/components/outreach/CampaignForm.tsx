import { useEffect, useMemo, useState } from 'react'
import { Loader2, Paperclip, RefreshCw, Search, X } from 'lucide-react'
import type {
  CampaignSettings,
  CampaignView,
  RecipientInput,
  TelegramContact
} from '@shared/outreach'
import { CAMPAIGN_BOUNDS, CAMPAIGN_DEFAULTS } from '@shared/outreach'
import type { MediaItem } from '@shared/types'
import { utcToWallTime, wallTimeToUtc } from '@shared/time'
import Modal from '@renderer/components/ui/Modal'
import TemplatePicker from '@renderer/components/outreach/TemplatePicker'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { btnPrimary, btnSecondary, inputCls, inputClsAuto } from '@renderer/lib/ui'
import { useAccounts } from '@renderer/store/accounts'
import { useChats } from '@renderer/store/chats'
import { useOutreach } from '@renderer/store/outreach'
import { usePosts } from '@renderer/store/posts'
import { useTags } from '@renderer/store/tags'

type Step = 'recipients' | 'message' | 'settings'

/** Kampaniya formasi: qabul qiluvchilar (faqat akkaunt dialoglaridan) → xabar → sozlamalar. */
export default function CampaignForm({
  campaign,
  onClose
}: {
  campaign: CampaignView | null
  onClose: () => void
}) {
  const allAccounts = useAccounts((s) => s.accounts)
  const accounts = useMemo(() => allAccounts.filter((a) => a.status === 'active'), [allAccounts])
  const saveCampaign = useOutreach((s) => s.saveCampaign)
  const timezone = usePosts((s) => s.timezone)
  const [step, setStep] = useState<Step>('recipients')
  const [accountId, setAccountId] = useState<number>(
    campaign?.account_id ?? accounts.find((a) => a.connected)?.id ?? accounts[0]?.id ?? 0
  )
  const [name, setName] = useState(campaign?.name ?? '')
  const [text, setText] = useState(campaign?.text ?? '')
  const [media, setMedia] = useState<MediaItem | null>(campaign?.media ?? null)
  const [settings, setSettings] = useState<CampaignSettings>(
    campaign?.settings ?? { ...CAMPAIGN_DEFAULTS }
  )
  const [wall, setWall] = useState(
    campaign?.scheduled_at ? utcToWallTime(campaign.scheduled_at, timezone) : ''
  )
  const [schedule, setSchedule] = useState(!!campaign?.scheduled_at)
  const [recipients, setRecipients] = useState<Map<string, RecipientInput>>(new Map())
  const [busy, setBusy] = useState<'save' | 'start' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState<number | null>(null)

  // Tahrirlashda mavjud qabul qiluvchilarni yuklaymiz
  useEffect(() => {
    if (!campaign) return
    api.campaigns
      .get(campaign.id)
      .then((r) =>
        setRecipients(
          new Map(
            r.recipients
              .filter((x) => x.status === 'pending')
              .map((x) => [x.peer_id, { peer: x.peer_id, title: x.title, username: x.username }])
          )
        )
      )
      .catch((e) => setError(describeError(e).message))
  }, [campaign])

  useEffect(() => {
    if (accountId)
      api.campaigns
        .quota(accountId)
        .then((q) => setQuota(q.used))
        .catch(() => setQuota(null))
  }, [accountId])

  const submit = async (start: boolean) => {
    setBusy(start ? 'start' : 'save')
    setError(null)
    try {
      let scheduledAt: string | null = null
      if (schedule) {
        scheduledAt = wall ? wallTimeToUtc(wall, timezone).toISOString() : null
        if (!scheduledAt) throw new Error('Rejalashtirish vaqtini kiriting.')
      }
      const saved = await saveCampaign({
        id: campaign?.id,
        name,
        accountId,
        text,
        media,
        settings,
        recipients: [...recipients.values()],
        scheduledAt
      })
      if (start && !schedule) await useOutreach.getState().startCampaign(saved.id)
      onClose()
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setBusy(null)
    }
  }

  const pickMedia = async () => {
    try {
      const f = await api.media.pick()
      if (f[0]) setMedia({ path: f[0].path, kind: f[0].kind })
    } catch (e) {
      setError(describeError(e).message)
    }
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'recipients', label: `Qabul qiluvchilar (${recipients.size})` },
    { id: 'message', label: 'Xabar' },
    { id: 'settings', label: 'Sozlamalar' }
  ]

  return (
    <Modal
      title={campaign ? 'Kampaniyani tahrirlash' : 'Yangi kampaniya'}
      onClose={onClose}
      closable={!busy}
      size="xl"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kampaniya nomi"
          className={`${inputCls} max-w-xs`}
        />
        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(Number(e.target.value))
            setRecipients(new Map())
          }}
          disabled={!!campaign}
          className={`${inputCls} max-w-xs`}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.first_name || a.username || a.phone} {a.connected ? '' : '(ulanmagan)'}
            </option>
          ))}
        </select>
        {quota !== null && (
          <span className="text-xs text-slate-500">
            24 soatda yuborilgan: <b>{quota}</b> / {settings.dailyLimit}
          </span>
        )}
      </div>

      <div className="mb-3 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${step === s.id ? 'border-brand-500 font-medium text-brand-700 dark:text-brand-200' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === 'recipients' && (
        <RecipientsStep accountId={accountId} selected={recipients} onChange={setRecipients} />
      )}

      {step === 'message' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TemplatePicker
              onPick={(t) => {
                setText(t.text)
                if (t.media) setMedia(t.media)
              }}
            />
            <button type="button" onClick={pickMedia} className={btnSecondary}>
              <Paperclip size={13} /> {media ? 'Boshqa fayl' : 'Rasm / video / fayl'}
            </button>
            {media && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                {media.path.split(/[\\/]/).pop()}
                <button
                  type="button"
                  onClick={() => setMedia(null)}
                  className="text-slate-400 hover:text-red-600"
                  aria-label="Olib tashlash"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder='Xabar matni. Telegram HTML: <b>qalin</b>, <i>kursiv</i>, <a href="https://…">havola</a>'
            className={`${inputCls} resize-y`}
          />
          <p className="text-xs text-slate-500">
            {text.length} / {media ? 1024 : 4096} belgi
          </p>
        </div>
      )}

      {step === 'settings' && (
        <SettingsStep
          settings={settings}
          onChange={setSettings}
          schedule={schedule}
          setSchedule={setSchedule}
          wall={wall}
          setWall={setWall}
        />
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {recipients.size} ta qabul qiluvchi · {settings.delayMin}–{settings.delayMax}s kechikish
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={!!busy} className={btnSecondary}>
            Bekor
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={!!busy || !accountId}
            className={btnSecondary}
          >
            {busy === 'save' && <Loader2 size={14} className="animate-spin" />}{' '}
            {schedule ? 'Rejalashtirish' : 'Qoralama'}
          </button>
          {!schedule && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={!!busy || !accountId || recipients.size === 0}
              className={btnPrimary}
            >
              {busy === 'start' && <Loader2 size={14} className="animate-spin" />} Boshlash
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function RecipientsStep({
  accountId,
  selected,
  onChange
}: {
  accountId: number
  selected: Map<string, RecipientInput>
  onChange: (m: Map<string, RecipientInput>) => void
}) {
  const chats = useChats()
  const acc = chats.account(accountId)
  const { tags, maps, loadMap, load: loadTags, loaded: tagsLoaded } = useTags()
  const [search, setSearch] = useState('')
  const [tagId, setTagId] = useState<number | null>(null)
  const [source, setSource] = useState<'dialogs' | 'contacts'>('dialogs')
  const [tgContacts, setTgContacts] = useState<TelegramContact[] | null>(null)
  const [contactsError, setContactsError] = useState<string | null>(null)

  useEffect(() => {
    setTgContacts(null)
  }, [accountId])
  useEffect(() => {
    if (source !== 'contacts' || tgContacts !== null || !accountId) return
    api.contacts
      .telegramList(accountId)
      .then((l) => setTgContacts(l.filter((c) => c.mutual)))
      .catch((e) => setContactsError(describeError(e).message))
  }, [source, tgContacts, accountId])

  useEffect(() => {
    if (!accountId) return
    if (!acc.loaded && !acc.loading) chats.loadDialogs(accountId).catch(console.error)
    if (!tagsLoaded) loadTags().catch(console.error)
    if (!maps[accountId]) loadMap(accountId).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  const tagMap = useMemo(() => maps[accountId] ?? {}, [maps, accountId])
  const candidates = useMemo(() => {
    const q = search.toLowerCase()
    const match = (title: string, username: string | null) =>
      !q || title.toLowerCase().includes(q) || (username ?? '').toLowerCase().includes(q)
    if (source === 'contacts') {
      return (tgContacts ?? [])
        .filter((c) => match(c.title, c.username))
        .map((c) => ({ peer: c.peer, title: c.title, username: c.username }))
    }
    return acc.dialogs
      .filter((d) => {
        if (d.kind !== 'user' || d.isSelf) return false
        if (tagId && !(tagMap[d.peer] ?? []).includes(tagId)) return false
        return match(d.title, d.username)
      })
      .map((d) => ({ peer: d.peer, title: d.title, username: d.username }))
  }, [source, tgContacts, acc.dialogs, tagId, tagMap, search])

  const toggle = (peer: string, title: string, username: string | null) => {
    const m = new Map(selected)
    if (m.has(peer)) m.delete(peer)
    else m.set(peer, { peer, title, username })
    onChange(m)
  }
  const selectAll = () => {
    const m = new Map(selected)
    for (const d of candidates)
      m.set(d.peer, { peer: d.peer, title: d.title, username: d.username })
    onChange(m)
  }

  if (!accountId) return <p className="text-sm text-slate-500">Avval akkaunt tanlang.</p>

  return (
    <div>
      <div className="mb-2 flex gap-1 text-xs">
        {(
          [
            ['dialogs', 'Chatlarim'],
            ['contacts', "Telegram kontaktlarim (o'zaro)"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSource(id)}
            className={`rounded-full px-3 py-1 ${source === id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-slate-500">
        {source === 'dialogs'
          ? 'Faqat shu akkauntning dialoglaridagi odamlar (botlar, guruhlar, kanallar emas). Kerak bo\'lsa "Yana yuklash".'
          : "Faqat o'zaro kontaktlar — ular ham sizning raqamingizni saqlagan. Bir tomonlama (siz qo'shgan, ular qo'shmagan) kontaktlar ro'yxatga kirmaydi."}
      </p>
      {contactsError && <p className="mb-2 text-xs text-red-600">{contactsError}</p>}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish…"
            className={`${inputCls} pl-8`}
          />
        </div>
        <select
          value={tagId ?? ''}
          onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : null)}
          className={`${inputCls} max-w-[180px]`}
        >
          <option value="">Barcha teglar</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={selectAll} className={btnSecondary}>
          Hammasini belgilash ({candidates.length})
        </button>
        <button type="button" onClick={() => onChange(new Map())} className={btnSecondary}>
          Tozalash
        </button>
        <button
          type="button"
          onClick={() => chats.loadDialogs(accountId, acc.loaded)}
          disabled={acc.loading}
          className={btnSecondary}
          title="Yana yuklash"
        >
          <RefreshCw size={13} className={acc.loading ? 'animate-spin' : ''} />{' '}
          {acc.nextOffsetDate ? 'Yana yuklash' : 'Yangilash'}
        </button>
      </div>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {acc.loaded && candidates.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-slate-500">Mos chat topilmadi.</li>
        )}
        {candidates.map((d) => (
          <li key={d.peer}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <input
                type="checkbox"
                checked={selected.has(d.peer)}
                onChange={() => toggle(d.peer, d.title, d.username)}
                className="accent-brand-500"
              />
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              {d.username && <span className="text-xs text-slate-400">@{d.username}</span>}
              {(tagMap[d.peer] ?? []).map((id) => {
                const t = tags.find((x) => x.id === id)
                return t ? (
                  <span
                    key={id}
                    className="rounded px-1 text-[10px] text-white"
                    style={{ background: t.color }}
                  >
                    {t.name}
                  </span>
                ) : null
              })}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SettingsStep({
  settings,
  onChange,
  schedule,
  setSchedule,
  wall,
  setWall
}: {
  settings: CampaignSettings
  onChange: (s: CampaignSettings) => void
  schedule: boolean
  setSchedule: (b: boolean) => void
  wall: string
  setWall: (w: string) => void
}) {
  const num = (k: keyof CampaignSettings, min: number, max: number) => (
    <input
      type="number"
      min={min}
      max={max}
      value={settings[k] as number}
      onChange={(e) =>
        onChange({ ...settings, [k]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })
      }
      className={`${inputClsAuto} w-24`}
    />
  )
  return (
    <div className="space-y-4 text-sm">
      <Row
        label="Xabarlar orasidagi kechikish (soniya)"
        hint={`Eng kami ${CAMPAIGN_BOUNDS.delayMinFloor}s — akkauntni himoya qilish uchun`}
      >
        {num('delayMin', CAMPAIGN_BOUNDS.delayMinFloor, CAMPAIGN_BOUNDS.delayMax)}{' '}
        <span className="text-slate-400">—</span>{' '}
        {num('delayMax', CAMPAIGN_BOUNDS.delayMinFloor, CAMPAIGN_BOUNDS.delayMax)}
      </Row>
      <Row label="Guruhdan keyin pauza" hint="Shuncha xabardan keyin uzunroq tanaffus (soniya)">
        har {num('groupSize', 1, CAMPAIGN_BOUNDS.groupSizeMax)} tadan keyin{' '}
        {num('groupPauseMin', 0, CAMPAIGN_BOUNDS.groupPauseMax)}{' '}
        <span className="text-slate-400">—</span>{' '}
        {num('groupPauseMax', 0, CAMPAIGN_BOUNDS.groupPauseMax)}
      </Row>
      <Row
        label="Kunlik limit (akkaunt bo'yicha)"
        hint={`24 soatda ko'pi bilan shuncha (kampaniya + API). Maksimum ${CAMPAIGN_BOUNDS.dailyLimitMax}`}
      >
        {num('dailyLimit', 1, CAMPAIGN_BOUNDS.dailyLimitMax)}
      </Row>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.onlyNew}
          onChange={(e) => onChange({ ...settings, onlyNew: e.target.checked })}
          className="accent-brand-500"
        />
        Faqat yangilarga — avval kampaniya/API orqali yozilganlarni o'tkazib yuborish
      </label>
      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={schedule}
            onChange={(e) => setSchedule(e.target.checked)}
            className="accent-brand-500"
          />
          Rejalashtirish
        </label>
        {schedule && (
          <input
            type="datetime-local"
            value={wall}
            onChange={(e) => setWall(e.target.value)}
            className={`${inputCls} mt-2 max-w-xs`}
          />
        )}
      </div>
      <p className="text-xs text-slate-400">
        FLOOD_WAIT kelsa kampaniya pauza bo'ladi va kutish tugagach o'zi davom etadi (2 soatgacha).
        Boshqa akkauntga o'tish yo'q. PEER_FLOOD — to'xtaydi, ertaga davom eting.
      </p>
    </div>
  )
}

function Row({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 font-medium">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}
