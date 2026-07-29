import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the API is proxied to the local FastAPI server; in production
// nginx serves /api from the same origin, so no proxy is involved.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
