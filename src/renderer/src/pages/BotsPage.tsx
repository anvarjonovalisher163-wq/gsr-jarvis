import { useState } from 'react'
import { Bot as BotIcon, ExternalLink, ListChecks, Megaphone, Users } from 'lucide-react'
import BotList from '@renderer/components/bots/BotList'
import RulesPanel from '@renderer/components/bots/RulesPanel'
import SubscribersPanel from '@renderer/components/bots/SubscribersPanel'
import BroadcastPanel from '@renderer/components/bots/BroadcastPanel'
import Placeholder from '@renderer/components/Placeholder'
import { useBots } from '@renderer/store/bots'

type Tab = 'rules' | 'subscribers' | 'broadcast'

export default function BotsPage() {
  const { bots, selectedId } = useBots()
  const [tab, setTab] = useState<Tab>('rules')
  const bot = bots.find((b) => b.id === selectedId) ?? null

  return (
    <div className="flex h-full">
      <aside className="w-[300px] shrink-0 border-r border-slate-200 dark:border-slate-800">
        <BotList />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!bot ? (
          <Placeholder icon={BotIcon} title="Botlar" description="Chapdan bot qo'shing yoki tanlang. Avto-javob qoidalari va obunachilar shu yerda." step={8} />
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{bot.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${bot.running ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                    {bot.running ? 'Ishlayapti' : "To'xtagan"}
                  </span>
                </div>
                <a
                  href={`https://t.me/${bot.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-300"
                  title="Sinab ko'rish: botni Telegram'da ochish"
                >
                  t.me/{bot.username} <ExternalLink size={11} />
                </a>
              </div>
              <nav className="ml-auto flex items-center gap-1">
                <TabBtn active={tab === 'rules'} icon={ListChecks} onClick={() => setTab('rules')}>
                  Qoidalar
                </TabBtn>
                <TabBtn active={tab === 'subscribers'} icon={Users} onClick={() => setTab('subscribers')}>
                  Obunachilar <span className="ml-1 text-xs opacity-70">({bot.subscribers})</span>
                </TabBtn>
                <TabBtn active={tab === 'broadcast'} icon={Megaphone} onClick={() => setTab('broadcast')}>
                  Rassilka
                </TabBtn>
              </nav>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'rules' ? <RulesPanel botId={bot.id} /> : tab === 'subscribers' ? <SubscribersPanel botId={bot.id} /> : <BroadcastPanel botId={bot.id} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, icon: Icon, onClick, children }: { active: boolean; icon: typeof Users; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
        active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      ].join(' ')}
    >
      <Icon size={15} />
      {children}
    </button>
  )
}
