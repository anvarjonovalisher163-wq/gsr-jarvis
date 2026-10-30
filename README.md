# TG Manager

Mac va Windows uchun Telegram boshqaruv paneli: bir nechta akkaunt, kanal/guruhlarga rejali
postinг, botlar (avto-javob va obunachilarga rassilka), CRM-teglar, litsenziya.

**Stek:** Electron + React 18 + Vite + TypeScript + Tailwind, GramJS, grammY, better-sqlite3,
electron-builder, Supabase.

## Talablar

- Node.js 20+
- npm 10+

## Ishga tushirish

```bash
npm install
```

```bash
npm run dev
```

Oyna 1280×800 o'lchamda ochiladi. Tepadagi tablar almashadi, chap pastdagi tarif blokida va
Sozlamalar tabida ilova versiyasi ko'rinadi.

## Boshqa buyruqlar

| Buyruq              | Vazifasi                                   |
| ------------------- | ------------------------------------------ |
| `npm run typecheck` | TypeScript tekshiruvi (main + renderer)    |
| `npm run lint`      | ESLint                                     |
| `npm run format`    | Prettier bilan formatlash                  |
| `npm run build`     | `out/` papkasiga build                     |
| `npm run build:mac` | macOS `.dmg` (release/)                    |
| `npm run build:win` | Windows NSIS installer (release/)          |

## Loyiha tuzilishi

```
src/
  main/       Electron main process (Node). Telegram va DB faqat shu yerda.
  preload/    contextBridge orqali typed window.api
  renderer/   React UI (faqat IPC orqali so'raydi)
  shared/     ipc.ts — typed IPC kontrakt, umumiy tiplar
```

Arxitektura qoidalari: `contextIsolation: true`, `nodeIntegration: false`, barcha IPC kanallar
`src/shared/ipc.ts` da e'lon qilinadi, har modul `src/main/modules/<modul>/` papkasida.
