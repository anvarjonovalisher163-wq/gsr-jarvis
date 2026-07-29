import { useState } from "react";
import { api, setToken } from "../api.js";

export default function Login({ onLogin }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await api.login(login, password);
      setToken(token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="j-avatar big">J</span>
          <div>
            <div className="brand-name">GSR JARVIS</div>
            <div className="brand-sub">Marketing shtabi · CN → UZ</div>
          </div>
        </div>
        <label className="field">
          <span className="field-label">LOGIN</span>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">PAROL</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Kirilmoqda…" : "Kirish"}
        </button>
      </form>
    </div>
  );
}
