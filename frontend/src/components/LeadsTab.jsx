import { useEffect, useState } from "react";
import { api } from "../api.js";

function fmtMoney(n) {
  if (!n) return "0";
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(n);
}

function fmtPeriod(p) {
  const months = [
    "yanv", "fev", "mart", "apr", "may", "iyun",
    "iyul", "avg", "sent", "okt", "noy", "dek",
  ];
  const [y, m] = p.split("-");
  return m ? `${months[Number(m) - 1]} ${y.slice(2)}` : p;
}

export default function LeadsTab() {
  const [report, setReport] = useState(null);
  const [health, setHealth] = useState(null);
  const [ig, setIg] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.analyticsReport().then(setReport).catch((e) => setError(e.message));
    api.crmHealth().then(setHealth).catch(() => {});
    api.insights().then(setIg).catch(() => {});
  }, []);

  if (error) return <div className="shtab"><div className="error-text">{error}</div></div>;
  if (!report) return <div className="shtab"><p className="muted">Yuklanmoqda…</p></div>;

  const { overview, funnel, monthly, sources, referral, stale, cycle, roi } = report;
  const maxReached = Math.max(...funnel.map((s) => s.reached), 1);
  const maxLeads = Math.max(...monthly.map((m) => m.leads), 1);

  return (
    <div className="shtab">
      {health?.demo_data && (
        <div className="warn-banner">
          Namunaviy ma'lumot ko'rsatilmoqda
          {!health.connected && " — CRM hali ulanmagan"}. Haqiqiy lidlar kelgach,
          demo yozuvlarni o'chirib tashlang.
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-value">{overview.total}</div>
          <div className="metric-label">JAMI LID</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{overview.in_progress}</div>
          <div className="metric-label">JARAYONDA</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{overview.won}</div>
          <div className="metric-label">MIJOZ BO'LDI</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{overview.conversion_pct}%</div>
          <div className="metric-label">KONVERSIYA</div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Savdo voronkasi</h2>
          {cycle.avg_days != null && (
            <span className="mono muted">o'rtacha {cycle.avg_days} kun</span>
          )}
        </div>
        {funnel.map((s, i) => (
          <div key={s.status} className="funnel-row">
            <div className="funnel-head">
              <span className="funnel-label">{s.label}</span>
              <span className="mono">{s.reached}</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(s.reached / maxReached) * 100}%` }} />
            </div>
            {i < funnel.length - 1 && s.dropped_here > 0 && (
              <div className="funnel-drop mono">
                −{s.dropped_here} ta yo'qoldi ({s.drop_pct}%)
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Oylik dinamika</h2>
        </div>
        <div className="chart">
          {monthly.map((m) => (
            <div key={m.period} className="chart-col">
              <div className="chart-bars">
                <div
                  className="chart-bar leads"
                  style={{ height: `${(m.leads / maxLeads) * 100}%` }}
                  title={`${m.leads} lid`}
                />
                <div
                  className="chart-bar won"
                  style={{ height: `${(m.won / maxLeads) * 100}%` }}
                  title={`${m.won} sotildi`}
                />
              </div>
              <div className="chart-label mono">{fmtPeriod(m.period)}</div>
            </div>
          ))}
        </div>
        <div className="legend mono">
          <span className="dot leads" /> tushgan lid
          <span className="dot won" /> mijoz bo'ldi
        </div>
      </section>

      {roi && roi.total_spend > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Reklama ROI</h2>
            <span className="mono muted">
              {roi.days} kun · {fmtMoney(roi.total_spend)} {roi.currency}
            </span>
          </div>

          <div className="table roi-table">
            <div className="tr th">
              <span>Segment</span>
              <span>Sarf</span>
              <span>Lid</span>
              <span>Sotuv</span>
              <span>1 sotuv</span>
            </div>
            {roi.segments.map((s) => (
              <div key={s.segment} className={`tr ${s.matched ? "" : "unmatched"}`}>
                <span className="src-name">
                  {s.segment}
                  {!s.matched && <span className="warn-dot" title="CRM bilan bog'lanmagan" />}
                </span>
                <span className="mono">{fmtMoney(s.spend)}</span>
                <span className="mono">{s.crm_leads}</span>
                <span className="mono">{s.won}</span>
                <span className="mono accent">
                  {s.cost_per_sale != null ? fmtMoney(s.cost_per_sale) : "—"}
                </span>
              </div>
            ))}
          </div>

          {roi.advice.length > 0 && (
            <div className="advice">
              {roi.advice.map((a, i) => (
                <div key={i} className={`advice-row ${a.action.replace(/\s/g, "-")}`}>
                  <span className="advice-action mono">{a.action}</span>
                  <div>
                    <div className="advice-seg">{a.segment}</div>
                    <div className="muted">{a.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {roi.unmatched_sources.length > 0 && (
            <p className="muted" style={{ marginTop: 10 }}>
              Reklamasiz kelgan lidlar:{" "}
              {roi.unmatched_sources
                .slice(0, 4)
                .map((u) => `${u.source} (${u.leads})`)
                .join(", ")}
            </p>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Manba bo'yicha</h2>
        </div>
        <div className="table">
          <div className="tr th">
            <span>Manba</span>
            <span>Lid</span>
            <span>Sotuv</span>
            <span>Konv.</span>
          </div>
          {sources.map((s) => (
            <div key={s.source} className="tr">
              <span className="src-name">{s.source}</span>
              <span className="mono">{s.leads}</span>
              <span className="mono">{s.won}</span>
              <span className="mono accent">{s.conversion_pct}%</span>
            </div>
          ))}
        </div>
        {overview.revenue > 0 && (
          <p className="muted" style={{ marginTop: 10 }}>
            Jami bitim summasi: <b>{fmtMoney(overview.revenue)}</b>
          </p>
        )}
      </section>

      {ig && ig.daily.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Instagram sahifamiz</h2>
            <span className="mono muted">{ig.days} kun</span>
          </div>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-value">{fmtMoney(ig.followers)}</div>
              <div className="metric-label">OBUNACHI</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{fmtMoney(ig.reach_total)}</div>
              <div className="metric-label">QAMROV</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{fmtMoney(ig.profile_views_total)}</div>
              <div className="metric-label">PROFIL KO'RISH</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{fmtMoney(ig.website_clicks_total)}</div>
              <div className="metric-label">HAVOLA BOSISH</div>
            </div>
          </div>
          <div className="chart ig-chart">
            {ig.daily.map((d) => {
              const maxReach = Math.max(...ig.daily.map((x) => x.reach), 1);
              return (
                <div key={d.date} className="chart-col">
                  <div className="chart-bars">
                    <div
                      className="chart-bar leads"
                      style={{ height: `${(d.reach / maxReach) * 100}%` }}
                      title={`${d.date}: ${d.reach}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend mono">
            <span className="dot leads" /> kunlik qamrov (reach)
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Tavsiya sifati</h2>
        </div>
        <div className="compare">
          <div className="compare-card">
            <div className="metric-value">{referral.referral.conversion_pct}%</div>
            <div className="metric-label">TAVSIYA ORQALI</div>
            <div className="muted mono">{referral.referral.leads} ta lid</div>
          </div>
          <div className="compare-card">
            <div className="metric-value">{referral.other.conversion_pct}%</div>
            <div className="metric-label">BOSHQA MANBA</div>
            <div className="muted mono">{referral.other.leads} ta lid</div>
          </div>
        </div>
        {referral.advantage_pct !== 0 && (
          <p className="muted" style={{ marginTop: 10 }}>
            {referral.advantage_pct > 0
              ? `Tavsiya orqali kelganlar ${referral.advantage_pct}% ko'proq sotuvga aylanmoqda.`
              : `Tavsiya orqali kelganlar ${Math.abs(referral.advantage_pct)}% kamroq sotuvga aylanmoqda.`}
          </p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Sovigan lidlar</h2>
          <span className="mono muted">{stale.days} kundan beri jim</span>
        </div>
        {stale.count === 0 && <p className="muted">Sovigan lid yo'q — barchasi harakatda.</p>}
        {stale.items.slice(0, 15).map((l) => (
          <div key={l.crm_id} className="stale-row">
            <span className="mono">{l.crm_id}</span>
            <span className="status-chip review">{l.label}</span>
            <span className="mono muted">{l.days_idle} kun</span>
          </div>
        ))}
        {stale.count > 15 && (
          <p className="muted" style={{ marginTop: 8 }}>
            va yana {stale.count - 15} ta.
          </p>
        )}
      </section>
    </div>
  );
}
