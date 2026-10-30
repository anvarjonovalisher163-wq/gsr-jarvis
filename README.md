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

## Native modullar (better-sqlite3)

`npm install` oxirida `postinstall` avtomatik ravishda native modullarni Electron uchun qayta
kompilyatsiya qiladi. Agar `npm install <paket>` bilan yangi native paket qo'shsangiz yoki
"was compiled against a different Node.js version" xatosi chiqsa:

```bash
npx electron-builder install-app-deps
```

Windows'da kompilyatsiya kerak bo'lib qolsa (prebuilt topilmasa) Visual Studio Build Tools
("Desktop development with C++") va Python 3 o'rnatilgan bo'lishi kerak.

## Ma'lumotlar bazasi

SQLite fayl `app.getPath('userData')` ichida: `tg-manager.db` (WAL rejimi).

| OS      | Yo'l                                            |
| ------- | ----------------------------------------------- |
| macOS   | `~/Library/Application Support/tg-manager/`     |
| Windows | `%APPDATA%\tg-manager\`                          |
| Linux   | `~/.config/tg-manager/`                          |

Migratsiyalar `src/main/db/migrations/` da, `schema_version` jadvali orqali boshqariladi.
Sessiya va tokenlar `safeStorage` bilan shifrlanadi (`src/main/security/crypto.ts`).

## Telegram akkaunt qo'shish

1. https://my.telegram.org → **API development tools** → `api_id` va `api_hash` oling.
2. Ilovada **Sozlamalar → Telegram API** bo'limiga kiriting va saqlang.
3. Chap paneldagi **+** → telefon raqam → kod → (bo'lsa) ikki bosqichli parol.

Sessiya shifrlanib `accounts` jadvaliga yoziladi; keyingi ochilishda qayta login so'ralmaydi.
Akkaunt ustida o'ng klik: **Chiqish** (Telegram sessiyasi yopiladi, akkaunt ro'yxatda qoladi) yoki
**O'chirish** (kanallari va teglari bilan butunlay o'chadi).

Qoida: FLOOD_WAIT kelsa ilova faqat kutadi va qolgan vaqtni ko'rsatadi — boshqa akkauntga o'tmaydi.

### Linux'da keyring bo'lmasa (faqat dev/test)

macOS (Keychain) va Windows (DPAPI) da shifrlash doim mavjud. Linux konteyner/CI'da keyring
bo'lmasa akkaunt qo'shish `ENCRYPTION_UNAVAILABLE` xatosi bilan to'xtaydi. Faqat test uchun:

```bash
TGM_ALLOW_PLAINTEXT_STORAGE=1 npm run dev
```

Bu rejimda sessiyalar kuchsiz shifrlanadi — haqiqiy akkauntlar uchun ishlatmang.

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
