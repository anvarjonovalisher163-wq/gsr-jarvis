import { useEffect, useState } from 'react'
import type { CampaignReport } from '@shared/outreach'
import Modal from '@renderer/components/ui/Modal'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'

const RS: Record<string, string> = {
  pending: 'Navbatda',
  sent: 'Yuborildi',
  failed: 'Xato',
  skipped: "O'tkazildi"
}

export default function CampaignReportModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [report, setReport] = useState<CampaignReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.campaigns
      .get(id)
      .then(setReport)
      .catch((e) => setError(describeError(e).message))
  }, [id])
  return (
    <Modal title="Kampaniya hisoboti" onClose={onClose} size="lg">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {report && (
        <>
          <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
            {[
              ['Jami', report.campaign.total],
              ['Yuborildi', report.campaign.sent],
              ['Xato', report.campaign.failed],
              ["O'tkazildi", report.campaign.skipped]
            ].map(([l, n]) => (
              <div key={String(l)} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                <div className="text-lg font-semibold">{n}</div>
                <div className="text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
            {report.recipients.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate">
                  {r.title || r.peer_id}
                  {r.username && <span className="ml-1 text-slate-400">@{r.username}</span>}
                </span>
                <span
                  className={
                    r.status === 'sent'
                      ? 'text-emerald-600'
                      : r.status === 'failed'
                        ? 'text-red-600'
                        : r.status === 'skipped'
                          ? 'text-amber-600'
                          : 'text-slate-400'
                  }
                  title={r.error ?? ''}
                >
                  {RS[r.status]}
                  {r.error ? ` — ${r.error}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}
