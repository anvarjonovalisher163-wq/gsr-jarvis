import { useState } from "react";
import { getToken, clearToken, enablePushNotifications } from "./api.js";
import Login from "./components/Login.jsx";
import ChatTab from "./components/ChatTab.jsx";
import LeadsTab from "./components/LeadsTab.jsx";
import ShtabTab from "./components/ShtabTab.jsx";

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [tab, setTab] = useState("chat");
  const [pushMsg, setPushMsg] = useState("");

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const enablePush = async () => {
    try {
      await enablePushNotifications();
      setPushMsg("Bildirishnomalar yoqildi ✓");
    } catch (e) {
      setPushMsg(e.message);
    }
    setTimeout(() => setPushMsg(""), 4000);
  };

  const logout = () => {
    clearToken();
    setAuthed(false);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div className="brand">
            <span className="brand-name">GSR JARVIS</span>
            <span className="brand-sub">Marketing shtabi</span>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={enablePush} title="Bildirishnomalarni yoqish">
              🔔
            </button>
            <button className="icon-btn" onClick={logout} title="Chiqish">
              ⎋
            </button>
          </div>
        </div>
        <div className="route-line">
          <span className="route-dot" />
          <span className="route-dash" />
          <span className="route-label">CN → UZ</span>
          <span className="route-dash" />
          <span className="route-dot" />
        </div>
        {pushMsg && <div className="push-msg">{pushMsg}</div>}
      </header>

      <main className="main">
        {tab === "chat" && <ChatTab />}
        {tab === "lidlar" && <LeadsTab />}
        {tab === "shtab" && <ShtabTab />}
      </main>

      <nav className="tabbar">
        <button
          className={`tab ${tab === "chat" ? "active" : ""}`}
          onClick={() => setTab("chat")}
        >
          <span className="tab-icon">💬</span>
          <span className="tab-label">CHAT</span>
        </button>
        <button
          className={`tab ${tab === "lidlar" ? "active" : ""}`}
          onClick={() => setTab("lidlar")}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">LIDLAR</span>
        </button>
        <button
          className={`tab ${tab === "shtab" ? "active" : ""}`}
          onClick={() => setTab("shtab")}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">SHTAB</span>
        </button>
      </nav>
    </div>
  );
}
