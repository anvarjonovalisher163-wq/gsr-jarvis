import { useEffect, useState } from 'react'
import { Ban, FileText, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import type { CampaignView } from '@shared/outreach'
import { formatInTz, sqliteToIso } from '@shared/time'
import { describeError } from '@renderer/lib/errors'
import { btnPrimary } from '@renderer/lib/ui'
import { useOutreach } from '@renderer/store/outreach'
import { usePosts } from '@renderer/store/posts'
import CampaignForm from './CampaignForm'
import CampaignReportModal from './CampaignReportModal'

const STATUS_LABEL: Record<CampaignView['status'], string> = {
  draft: 'Qoralama',
  scheduled: 'Rejali',
  running: 'Yuborilmoqda',
  paused: 'Pauza',
  done: 'Tugadi',
  cancelled: 'Bekor',
  failed: 'Xato'
}
const STATUS_CLS: Record<CampaignView['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  scheduled: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  running: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
}

/** Akkaunt kampaniyalari: faqat mavjud chatlarga, pauzalar bilan. */
export default function CampaignsPanel() {
  const {
    campaigns,
    campaignsLoaded,
    loadCampaigns,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    deleteCampaign
  } = useOutreach()
  const timezone = usePosts((s) => s.timezone)
  const [editing, setEditing] = useState<CampaignView | 'new' | null>(null)
  const [reportId, setReportId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCampaigns().catch((e) => setError(describeError(e).message))
  }, [loadCampaigns])

  const act = (fn: () => Promise<void>) => fn().catch((e) => setError(describeError(e).message))

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Bitta xabar akkauntingizning <b>mavjud chatlariga</b> (siz bilan yozishgan odamlar)
          ketma-ket, orasida pauza bilan yuboriladi. Notanishlar bazasiga yuborish yo'q;
          FLOOD_WAIT'da faqat kutiladi, boshqa akkauntga o'tilmaydi.
        </p>
        <button type="button" onClick={() => setEditing('new')} className={btnPrimary}>
          <Plus size={14} /> Kampaniya
        </button>
      </div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {campaignsLoaded && campaigns.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          Hali kampaniya yo'q.
        </div>
      )}
      <div className="space-y-2">
        {campaigns.map((c) => {
          const processed = c.sent + c.failed + c.skipped
          const pct = c.total > 0 ? Math.round((processed / c.total) * 100) : 0
          const editable = c.status === 'draft' || c.status === 'scheduled' || c.status === 'paused'
          return (
            <div
              key={c.id}
              className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.name || `Kampaniya #${c.id}`}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_CLS[c.status]}`}
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                    <span className="text-xs text-slate-500">{c.account_label}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                    {c.text.replace(/<[^>]+>/g, '') || (c.media ? 'Media' : '')}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {c.status === 'scheduled' && c.scheduled_at
                      ? `Reja: ${formatInTz(c.scheduled_at, timezone)}`
                      : formatInTz(sqliteToIso(c.created_at), timezone)}
                    {` · ${c.sent}/${c.total} yuborildi`}
                    {c.failed > 0 && `, ${c.failed} xato`}
                    {c.skipped > 0 && `, ${c.skipped} o'tkazildi`}
                  </div>
                  {c.last_error && (c.status === 'paused' || c.status === 'failed') && (
                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      {c.last_error}
                      {c.resumeAt ? ` · davom etadi: ${formatInTz(c.resumeAt, timezone)}` : ''}
                    </div>
                  )}
                  {(c.status === 'running' || c.status === 'paused') && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full bg-brand-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(c.status === 'draft' || c.status === 'scheduled') && (
                    <Btn title="Boshlash" onClick={() => act(() => startCampaign(c.id))}>
                      <Play size={14} />
                    </Btn>
                  )}
                  {c.status === 'running' && (
                    <Btn title="Pauza" onClick={() => act(() => pauseCampaign(c.id))}>
                      <Pause size={14} />
                    </Btn>
                  )}
                  {c.status === 'paused' && (
                    <Btn title="Davom ettirish" onClick={() => act(() => resumeCampaign(c.id))}>
                      <Play size={14} />
                    </Btn>
                  )}
                  {editable && (
                    <Btn title="Tahrirlash" onClick={() => setEditing(c)}>
                      <Pencil size={14} />
                    </Btn>
                  )}
                  <Btn title="Hisobot" onClick={() => setReportId(c.id)}>
                    <FileText size={14} />
                  </Btn>
                  {(c.status === 'running' ||
                    c.status === 'paused' ||
                    c.status === 'scheduled') && (
                    <Btn
                      title="Bekor qilish"
                      danger
                      onClick={() =>
                        window.confirm(
                          'Kampaniyani bekor qilasizmi? Yuborilganlar qaytarilmaydi.'
                        ) && act(() => cancelCampaign(c.id))
                      }
                    >
                      <Ban size={14} />
                    </Btn>
                  )}
                  {c.status !== 'running' && (
                    <Btn
                      title="O'chirish"
                      danger
                      onClick={() =>
                        window.confirm("Kampaniyani o'chirasizmi?") &&
                        act(() => deleteCampaign(c.id))
                      }
                    >
                      <Trash2 size={14} />
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {editing && (
        <CampaignForm
          campaign={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {reportId !== null && <CampaignReportModal id={reportId} onClose={() => setReportId(null)} />}
    </div>
  )
}

function Btn({
  title,
  onClick,
  danger,
  children
}: {
  title: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md p-1.5 ${danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
    >
      {children}
    </button>
  )
}
