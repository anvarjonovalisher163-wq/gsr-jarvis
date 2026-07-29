import { useEffect, useState } from "react";
import { api } from "../api.js";

const STATUS_LABELS = {
  idea: "g'oya",
  draft: "qoralama",
  review: "ko'rib chiqishda",
  approved: "tasdiqlangan",
  rejected: "rad etilgan",
  published: "joylandi",
};

const TYPE_LABELS = { post: "POST", carousel: "KARUSEL", reels: "REELS" };

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

export default function ShtabTab() {
  const [summary, setSummary] = useState(null);
  const [posts, setPosts] = useState([]);
  const [intel, setIntel] = useState([]);
  const [strategy, setStrategy] = useState([]);
  const [seasonsList, setSeasonsList] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [lang, setLang] = useState("uz"); // uz | ru view of the open post
  const [editing, setEditing] = useState(null); // {title, body, body_ru, hashtags, best_time, imagesText}
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const [s, p, i, st, se] = await Promise.all([
        api.dashboard(),
        api.plan(),
        api.intelReports(),
        api.strategyReports(),
        api.seasons(),
      ]);
      setSummary(s);
      setPosts(p);
      setIntel(i);
      setStrategy(st);
      setSeasonsList(se);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      await load();
      if (okMsg) flash(okMsg);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const startEdit = (post) => {
    setEditing({
      id: post.id,
      title: post.title,
      body: post.body,
      body_ru: post.body_ru,
      hashtags: post.hashtags,
      best_time: post.best_time,
      imagesText: JSON.parse(post.image_urls || "[]").join(", "),
    });
  };

  const saveEdit = () =>
    run(
      `save-${editing.id}`,
      async () => {
        await api.updatePost(editing.id, {
          title: editing.title,
          body: editing.body,
          body_ru: editing.body_ru,
          hashtags: editing.hashtags,
          best_time: editing.best_time,
          image_urls: editing.imagesText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
        setEditing(null);
      },
      "Saqlandi"
    );

  const publish = (post) => {
    if (!window.confirm(`"${post.title}" postini Instagramga joylaymizmi?`)) return;
    run(`pub-${post.id}`, () => api.publishPost(post.id), "Instagramga joylandi 🎉");
  };

  // Group posts by week
  const weeks = {};
  for (const p of posts) {
    (weeks[p.week_start] = weeks[p.week_start] || []).push(p);
  }
  const weekKeys = Object.keys(weeks).sort().reverse();

  return (
    <div className="shtab">
      {error && <div className="error-text">{error}</div>}
      {notice && <div className="notice-text">{notice}</div>}

      {/* --- Seasonal signals --- */}
      {seasonsList.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Mavsumiy signallar</h2>
          </div>
          {seasonsList.slice(0, 4).map((s) => (
            <div key={s.name + s.date} className={`season-row ${s.active ? "active" : ""}`}>
              <div className="season-head">
                <span className="season-name">{s.name}</span>
                <span className={`mono ${s.active ? "accent" : "muted"}`}>
                  {s.days_left} kun qoldi
                </span>
              </div>
              <div className="muted">{s.note}</div>
              {s.active && <div className="season-cta mono">→ {s.cta}</div>}
            </div>
          ))}
        </section>
      )}

      {/* --- Metrics --- */}
      {summary && (
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-value">{summary.pending_review}</div>
            <div className="metric-label">TASDIQ KUTMOQDA</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{summary.approved}</div>
            <div className="metric-label">TASDIQLANGAN</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{summary.published_this_month}</div>
            <div className="metric-label">SHU OY JOYLANDI</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{summary.competitors}</div>
            <div className="metric-label">RAQOBATCHILAR</div>
          </div>
        </div>
      )}

      {/* --- Content plan --- */}
      <section className="section">
        <div className="section-head">
          <h2>Kontent-plan</h2>
          <button
            className="btn btn-outline"
            disabled={busy === "gen"}
            onClick={() => run("gen", api.generatePlan, "Yangi haftalik plan tayyor")}
          >
            {busy === "gen" ? "Yozilmoqda…" : "+ Yangi plan"}
          </button>
        </div>

        {weekKeys.length === 0 && <p className="muted">Hozircha plan yo'q — "+ Yangi plan" bosing.</p>}

        {weekKeys.map((wk) => (
          <div key={wk} className="week-block">
            <div className="week-label">HAFTA · {fmtDate(wk)}</div>
            {weeks[wk].map((post) => (
              <div key={post.id} className="post-card">
                <button
                  className="post-summary"
                  onClick={() => {
                    setOpenId(openId === post.id ? null : post.id);
                    setLang("uz");
                    setEditing(null);
                  }}
                >
                  <span className={`type-tag ${post.post_type}`}>{TYPE_LABELS[post.post_type]}</span>
                  <span className="post-title">{post.title || "(nomsiz)"}</span>
                  <span className={`status-chip ${post.status}`}>{STATUS_LABELS[post.status]}</span>
                </button>

                {openId === post.id && (
                  <div className="post-detail">
                    {editing?.id === post.id ? (
                      <div className="edit-form">
                        <label className="field">
                          <span className="field-label">SARLAVHA</span>
                          <input
                            value={editing.title}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">MATN (UZ)</span>
                          <textarea
                            rows={10}
                            value={editing.body}
                            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">MATN (RU)</span>
                          <textarea
                            rows={10}
                            value={editing.body_ru}
                            onChange={(e) => setEditing({ ...editing, body_ru: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">HASHTAGLAR</span>
                          <textarea
                            rows={2}
                            value={editing.hashtags}
                            onChange={(e) => setEditing({ ...editing, hashtags: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">JOYLASH VAQTI</span>
                          <input
                            value={editing.best_time}
                            onChange={(e) => setEditing({ ...editing, best_time: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">RASM URL (vergul bilan, karusel uchun bir nechta)</span>
                          <textarea
                            rows={2}
                            placeholder="https://…/rasm1.jpg, https://…/rasm2.jpg"
                            value={editing.imagesText}
                            onChange={(e) => setEditing({ ...editing, imagesText: e.target.value })}
                          />
                        </label>
                        <div className="btn-row">
                          <button className="btn btn-primary" onClick={saveEdit}>
                            Saqlash
                          </button>
                          <button className="btn btn-outline" onClick={() => setEditing(null)}>
                            Bekor
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="post-meta">
                          <span className="mono">{post.pillar}</span>
                          <span className="mono">🕐 {post.best_time}</span>
                        </div>
                        {post.body_ru && (
                          <div className="lang-toggle">
                            <button
                              className={`lang-btn ${lang === "uz" ? "on" : ""}`}
                              onClick={() => setLang("uz")}
                            >
                              UZ
                            </button>
                            <button
                              className={`lang-btn ${lang === "ru" ? "on" : ""}`}
                              onClick={() => setLang("ru")}
                            >
                              RU
                            </button>
                          </div>
                        )}
                        <pre className="post-body">
                          {lang === "ru" && post.body_ru ? post.body_ru : post.body}
                        </pre>
                        <div className="post-hashtags mono">{post.hashtags}</div>
                        {JSON.parse(post.image_urls || "[]").length > 0 && (
                          <div className="post-meta mono">
                            🖼 {JSON.parse(post.image_urls).length} ta rasm biriktirilgan
                          </div>
                        )}
                        <div className="btn-row">
                          {post.status !== "published" && post.status !== "approved" && (
                            <button
                              className="btn btn-primary"
                              disabled={busy === `ap-${post.id}`}
                              onClick={() =>
                                run(`ap-${post.id}`, () => api.approvePost(post.id), "Tasdiqlandi ✓")
                              }
                            >
                              ✓ Tasdiqlash
                            </button>
                          )}
                          {post.status === "approved" && (
                            <button
                              className="btn btn-primary"
                              disabled={busy === `pub-${post.id}`}
                              onClick={() => publish(post)}
                            >
                              {busy === `pub-${post.id}` ? "Joylanmoqda…" : "📤 Instagramga joylash"}
                            </button>
                          )}
                          {post.status !== "published" && (
                            <>
                              <button className="btn btn-outline" onClick={() => startEdit(post)}>
                                ✎ Tahrirlash
                              </button>
                              <button
                                className="btn btn-danger"
                                disabled={busy === `rj-${post.id}`}
                                onClick={() =>
                                  run(`rj-${post.id}`, () => api.rejectPost(post.id), "Rad etildi")
                                }
                              >
                                ✕ Rad etish
                              </button>
                            </>
                          )}
                          {post.status === "published" && (
                            <span className="muted mono">IG: {post.ig_media_id}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* --- Competitor intel --- */}
      <section className="section">
        <div className="section-head">
          <h2>Raqobat razvedkasi</h2>
          <div className="btn-row">
            <button
              className="btn btn-outline"
              disabled={busy === "scrape"}
              onClick={() => run("scrape", api.runScrape, "Skan tugadi")}
            >
              {busy === "scrape" ? "Skan…" : "Skan qilish"}
            </button>
            <button
              className="btn btn-outline"
              disabled={busy === "analyze"}
              onClick={() => run("analyze", api.runAnalyze, "Tahlil tayyor")}
            >
              {busy === "analyze" ? "Tahlil…" : "Tahlil qilish"}
            </button>
          </div>
        </div>
        {intel.length === 0 && <p className="muted">Hisobotlar hali yo'q.</p>}
        {intel.slice(0, 3).map((r) => (
          <div key={r.id} className="report-card">
            <div className="week-label">
              {fmtDate(r.period_start)} — {fmtDate(r.period_end)}
            </div>
            <pre className="post-body">{r.summary}</pre>
          </div>
        ))}
      </section>

      {/* --- Strategy --- */}
      <section className="section">
        <div className="section-head">
          <h2>Oylik strategiya</h2>
          <button
            className="btn btn-outline"
            disabled={busy === "strat"}
            onClick={() => run("strat", api.generateStrategy, "Strategiya tayyor")}
          >
            {busy === "strat" ? "Yozilmoqda…" : "Yaratish"}
          </button>
        </div>
        {strategy.length === 0 && <p className="muted">Strategiya hisobotlari hali yo'q.</p>}
        {strategy.slice(0, 1).map((r) => (
          <div key={r.id} className="report-card">
            <div className="week-label">OY · {r.month}</div>
            <pre className="post-body">{r.content}</pre>
          </div>
        ))}
      </section>
    </div>
  );
}
