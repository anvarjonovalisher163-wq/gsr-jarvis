import { useState } from 'react'
import CampaignsPanel from '@renderer/components/outreach/CampaignsPanel'
import TemplatesPanel from '@renderer/components/outreach/TemplatesPanel'
import BlacklistPanel from '@renderer/components/outreach/BlacklistPanel'

type Tab = 'campaigns' | 'templates' | 'blacklist'
const TABS: { id: Tab; label: string }[] = [
  { id: 'campaigns', label: 'Kampaniyalar' },
  { id: 'templates', label: 'Tayyor xabarlar' },
  { id: 'blacklist', label: "Qora ro'yxat" }
]

/** Xabarnoma: akkaunt kampaniyalari (mavjud chatlarga), shablonlar, qora ro'yxat. */
export default function OutreachPage() {
  const [tab, setTab] = useState<Tab>('campaigns')
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Xabarnoma</h1>
      <div className="mb-4 mt-3 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? 'border-brand-500 font-medium text-brand-700 dark:text-brand-200' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'campaigns' && <CampaignsPanel />}
      {tab === 'templates' && <TemplatesPanel />}
      {tab === 'blacklist' && <BlacklistPanel />}
    </div>
  )
}
