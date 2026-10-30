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

`better-sqlite3@12.11.1` Node 20/22/24 va Electron 33 uchun Windows (x64) va macOS (arm64/x64)
tayyor binarlariga ega — Visual Studio yoki Xcode kerak emas. Agar `npm install` paytida
`gyp ERR! find VS` xatosi chiqsa, demak paket versiyasi Node versiyangizga mos tayyor binar
topa olmagan: `npm install` ni qayta ishga tushiring yoki Node 22 LTS o'rnating.

`npm install` oxirida `postinstall` avtomatik ravishda `better-sqlite3` ni Electron uchun qayta
yuklaydi (tayyor binar). Agar "was compiled against a different Node.js version" xatosi chiqsa:

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

## Kanallarni sinxronlash

**Posting** tabi → chapda "Kanallarim" → **Yangilash**. Ilova akkaunt dialoglaridan post yozish
huquqi bor joylarni yig'adi:

- kanal: siz yaratgan yoki admin bo'lib `post_messages` huquqi bor;
- supergruppa: siz yaratgan yoki har qanday admin huquqi bor.

Oddiy a'zo bo'lgan guruhlar va eski (basic) guruhlar ro'yxatga kirmaydi. Chiqib ketilgan yoki
admin huquqi olib tashlangan kanallar keyingi yangilashda ro'yxatdan o'chadi.

## Post yuborish va rejalashtirish

**Posting** tabi → "Yangi post": matn (Telegram HTML: `<b>`, `<i>`, `<u>`, `<s>`, `<a href>`,
`<code>`, `<spoiler>`), 1–10 ta rasm/video (albom) yoki bitta fayl, chapdan tanlangan kanallar.

- **Hozir yuborish** — kanallarga ketma-ket, orasida 2–3 soniya pauza.
- **Rejalashtirish** — Telegram'ning o'z `schedule_date` imkoniyati: post Telegram serverida
  rejalashtiriladi, **ilova yopiq bo'lsa ham** chiqadi (365 kungacha). Vaqt Sozlamalar'dagi
  vaqt zonasida kiritiladi (default Asia/Tashkent).
- **Qoralama** — saqlanadi, yuborilmaydi.

Holatlar: `draft` → `scheduled`/`sent`/`failed`. Har kanal (nishon) alohida holatga ega;
bittasi xato bo'lsa post `failed`, "Qayta urinish" faqat xato bo'lganlarni yuboradi.

**FLOOD_WAIT** kelsa: shu akkauntning qolgan kanallari ham `failed` bo'ladi, kutish vaqti
xato matnida va logda ko'rsatiladi. Boshqa akkauntga o'tib davom etilmaydi.

Rejali postni tahrirlash yoki o'chirish Telegram'dagi rejali xabarni ham bekor qiladi
(akkaunt ulangan bo'lishi kerak). Yuborilgan postni tahrirlab bo'lmaydi — dublikat qiling.

Eslatma: inline tugmalar faqat botlar uchun (9-qadam, rassilka). Shaxsiy akkaunt postlarida
tugma bo'lmaydi.

## Botlar

**Botlar** tabi → "Bot qo'shish" → @BotFather bergan token. Token `getMe` bilan tekshiriladi,
shifrlanib saqlanadi, bot long polling rejimida ishga tushadi (ilova ochiq bo'lsa ishlaydi).

- `/start [param]` — foydalanuvchi obunachilar ro'yxatiga yoziladi; deep-link parametri
  (`t.me/bot?start=promo1`) teg sifatida saqlanadi. Qaytgan foydalanuvchi qayta faollashadi.
- `/stop` — obunadan chiqadi (rassilka unga bormaydi). Bot bloklanganda (403) ham shunday.
- **Qoidalar**: buyruq (`/narx`), kalit so'z (xabarda "narx" bo'lsa), boshqa hammasi.
  Javob: matn (HTML) + ixtiyoriy media + URL tugmalar. `/start` uchun standart salomlashuv bor;
  o'zgartirish uchun `start` buyrug'iga qoida qo'shing.
- Faqat shaxsiy chatlar qayta ishlanadi (guruhlardagi xabarlar e'tiborsiz).
- **Obunachilar**: qidiruv, teg filtri, CSV eksport (Excel uchun BOM bilan, `;` ajratuvchi).

Xatolar: 401 — token noto'g'ri; 409 — bot boshqa joyda ham ishlayapti (ikkita polling bo'lmaydi).

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
