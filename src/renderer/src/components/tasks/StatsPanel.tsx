import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Eye, Loader2, RefreshCw } from 'lucide-react'
import type { ChannelViewsReport, StatsOverview } from '@shared/stats'
import { formatInTz, sqliteToIso } from '@shared/time'
import { api } from '@renderer/lib/api'
import { describeError } from '@renderer/lib/errors'
import { usePosts } from '@renderer/store/posts'

const RANGES = [7, 14, 30, 90]

export default function StatsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<StatsOverview | null>(null)
  const [views, setViews] = useState<ChannelViewsReport[] | null>(null)
  const [viewsBusy, setViewsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timezone = usePosts((s) => s.timezone)

  useEffect(() => {
    api.stats
      .overview(days)
      .then(setData)
      .catch((e) => setError(describeError(e).message))
  }, [days])

  const loadViews = async () => {
    setViewsBusy(true)
    try {
      setViews(await api.stats.channelViews())
    } catch (e) {
      setError(describeError(e).message)
    } finally {
      setViewsBusy(false)
    }
  }

  if (!data) return <div className="py-8 text-center text-xs text-slate-400">{error ?? 'Yuklanmoqda…'}</div>
  const t = data.totals
  const shortDay = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-slate-500">Davr:</span>
        {RANGES.map((r) => (
          <button key={r} type="button" onClick={() => setDays(r)} className={`rounded-full px-2.5 py-0.5 text-xs ${days === r ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
            {r} kun
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Akkauntlar" value={t.accounts} />
        <Stat label="Kanallar" value={t.channels} />
        <Stat label="Botlar" value={t.bots} />
        <Stat label="Yuborilgan postlar" value={t.postsSent} accent />
        <Stat label="Rejali postlar" value={t.postsScheduled} />
        <Stat label="Faol obunachilar" value={t.activeSubscribers} accent />
        <Stat label="Rassilka xabarlari" value={t.broadcastsSent} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={`Kunlik yuborilgan postlar (${days} kun)`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.postsPerDay} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(d) => String(d)} formatter={(v) => [v, 'post']} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#2f7cff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`Bot obunachilari o'sishi (${days} kun)`}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.subscribersGrowth} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(d) => String(d)} formatter={(v) => [v, 'obunachi']} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Oxirgi rassilkalar">
          {data.broadcasts.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Hali rassilka yo'q.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 font-medium">Bot / matn</th>
                  <th className="py-1 text-right font-medium">Yetkazildi</th>
                  <th className="py-1 text-right font-medium">Xato</th>
                  <th className="py-1 text-right font-medium">Bloklagan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.broadcasts.map((b) => (
                  <tr key={b.id}>
                    <td className="py-1.5">
                      <div className="truncate font-medium">@{b.bot_username}</div>
                      <div className="truncate text-slate-500">{b.text.replace(/<[^>]+>/g, '').slice(0, 50)} · {formatInTz(sqliteToIso(b.created_at), timezone)}</div>
                    </td>
                    <td className="py-1.5 text-right text-emerald-600">{b.sent}/{b.total}</td>
                    <td className="py-1.5 text-right text-red-600">{b.failed}</td>
                    <td className="py-1.5 text-right text-slate-500">{b.blocked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Kanal postlari ko'rishlari"
          action={
            <button type="button" onClick={loadViews} disabled={viewsBusy} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
              {viewsBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Telegram'dan olish
            </button>
          }
        >
          {views === null ? (
            <p className="py-4 text-center text-xs text-slate-400">Ko'rishlar ulangan akkaunt orqali Telegram'dan olinadi — tugmani bosing.</p>
          ) : views.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Yuborilgan post yo'q.</p>
          ) : (
            <div className="space-y-3">
              {views.map((ch) => (
                <div key={ch.channel_id}>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
                    {ch.channel_title}
                    {ch.error && <span className="font-normal text-red-600">— {ch.error}</span>}
                  </div>
                  <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                    {ch.posts.map((p) => (
                      <div key={p.post_id} className="flex items-center gap-2 py-1">
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        <span className="text-slate-400">{formatInTz(p.sent_at, timezone).slice(0, 10)}</span>
                        <span className="inline-flex w-16 items-center justify-end gap-1 tabular-nums text-slate-600 dark:text-slate-300">
                          <Eye size={11} /> {p.views ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className={`text-2xl font-semibold tabular-nums ${accent ? 'text-brand-600 dark:text-brand-300' : ''}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
