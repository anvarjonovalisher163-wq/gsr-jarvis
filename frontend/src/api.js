/* API client: JWT storage + JSON requests + chat streaming. */
const TOKEN_KEY = "gsr_jarvis_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Sessiya tugadi");
  }
  if (!res.ok) {
    let detail = "Xatolik yuz berdi";
    try {
      const data = await res.json();
      if (data.detail) detail = typeof data.detail === "string" ? data.detail : detail;
    } catch (e) {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.json();
}

/* Streams the assistant reply; calls onDelta(textChunk) as chunks arrive. */
export async function streamChat(message, onDelta) {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ message }),
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Sessiya tugadi");
  }
  if (!res.ok || !res.body) throw new Error("Jarvis bilan bog'lanishda xatolik");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }
}

export const api = {
  // auth
  login: (login, password) => request("/auth/login", { method: "POST", body: { login, password } }),
  // chat
  chatHistory: () => request("/chat/history"),
  // content
  plan: () => request("/content/plan"),
  generatePlan: () => request("/content/generate", { method: "POST", body: {} }),
  generateImage: (id) => request(`/content/${id}/generate-image`, { method: "POST" }),
  updatePost: (id, patch) => request(`/content/${id}`, { method: "PATCH", body: patch }),
  approvePost: (id) => request(`/content/${id}/approve`, { method: "POST" }),
  rejectPost: (id) => request(`/content/${id}/reject`, { method: "POST" }),
  publishPost: (id) => request(`/publish/${id}`, { method: "POST" }),
  // dashboard
  dashboard: () => request("/dashboard/summary"),
  // leads & analytics
  analyticsReport: () => request("/analytics/report"),
  crmHealth: () => request("/crm/health"),
  insights: () => request("/analytics/insights"),
  seasons: () => request("/seasons/upcoming"),
  // competitors & intel
  competitors: () => request("/competitors/"),
  addCompetitor: (body) => request("/competitors/", { method: "POST", body }),
  deleteCompetitor: (id) => request(`/competitors/${id}`, { method: "DELETE" }),
  intelReports: () => request("/competitors/reports"),
  runScrape: () => request("/competitors/scrape", { method: "POST" }),
  runAnalyze: () => request("/competitors/analyze", { method: "POST" }),
  // strategy
  strategyReports: () => request("/strategy/reports"),
  generateStrategy: () => request("/strategy/generate", { method: "POST" }),
  // push
  vapidKey: () => request("/push/vapid-key"),
  subscribePush: (sub) => request("/push/subscribe", { method: "POST", body: sub }),
};

/* --- Web Push helpers --- */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Bu brauzer push bildirishnomalarni qo'llab-quvvatlamaydi");
  }
  const { key } = await api.vapidKey();
  if (!key) throw new Error("Serverda VAPID kalitlari sozlanmagan");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Bildirishnomalarga ruxsat berilmadi");

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  await api.subscribePush(sub.toJSON());
}
