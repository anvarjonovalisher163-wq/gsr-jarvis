import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

const here = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(here, "certs");
const certFile = path.join(certDir, "dev-cert.pem");
const keyFile = path.join(certDir, "dev-key.pem");
const hasTrustedCert = fs.existsSync(certFile) && fs.existsSync(keyFile);

// The dev server runs over HTTPS. This is not about secrecy in development
// — it is what the browser requires before it will register a service
// worker, install the app as a PWA, or allow Web Push anywhere other than
// localhost. Testing on a phone over Wi-Fi only works over HTTPS.
//
// Two certificate modes:
//   * certs/ present  -> a locally trusted mkcert certificate. No browser
//     warning, and service workers actually register. See README.
//   * certs/ missing  -> self-signed fallback so `npm run dev` still runs.
//     The browser will warn, and PWA features stay disabled — a browser
//     refuses to register a service worker behind an untrusted certificate.
//
// In production nginx terminates TLS with a real certbot certificate; none
// of this applies there.
const httpsConfig = hasTrustedCert
  ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  : {};

const apiProxy = {
  "/api": {
    // The backend stays on plain HTTP behind this proxy; the browser only
    // ever talks to Vite, over HTTPS.
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), ...(hasTrustedCert ? [] : [basicSsl()])],
  server: {
    https: httpsConfig,
    // Listen on every interface so a phone on the same Wi-Fi can reach it.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  // `npm run build && npm run preview` serves the real production bundle,
  // which is the only way to test PWA install and push locally — the
  // service worker is deliberately not registered in dev mode.
  preview: {
    https: httpsConfig,
    host: true,
    port: 4173,
    strictPort: true,
    proxy: apiProxy,
  },
});
