import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the PWA service worker (offline shell + push).
// Production only: in dev the SW would cache unhashed module URLs like
// /src/App.jsx and keep serving stale code after every edit.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW is optional — the app still works without it */
    });
  });
} else if ("serviceWorker" in navigator) {
  // Clean up a worker registered by an earlier dev session.
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}
