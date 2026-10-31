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

**Sessiya import** (Sozlamalar → Akkauntlarni import qilish): boshqa dasturdan (GramJS, Telethon)
olingan StringSession satrlari, har qatorga bittadan — kodsiz ulanadi. Avtomatik "kodsiz login"
boshqa yo'l bilan mumkin emas: Telegram har kirishda akkauntga kod yuboradi. `tdata` qo'llanmaydi.

**Akkauntlar boshqaruvi** (chap paneldagi ⚙-ga o'xshash tugma): jadval ko'rinishida barcha
akkauntlar; **Fayldan import** — `.session` (Telethon/Pyrogram SQLite), `.zip` (ichida .session/.json),
`.json` (ichida `session` maydoni), `.txt` (StringSession satrlari); **Eksport** — tanlangan
akkauntlar sessiyalarini matn fayliga (fayl akkauntga to'liq kirish beradi — ehtiyot bo'ling);
**Spam test** — @SpamBot'dan akkauntda cheklov bor-yo'qligini so'raydi (faqat holat, hech narsani
aylanib o'tmaydi).

## Chatlar

**Chatlar** tabi: tepada akkaunt tablari (har biri alohida akkaunt), o'rtada dialoglar (qidiruv,
filtr: Hammasi / Shaxsiy / Guruhlar / Kanallar; 50 tadan sahifalab, pastga skroll qilganda yana),
o'ngda xabarlar tarixi (tepaga skroll — eskilari), matn/rasm/video/fayl ko'rinishi, xabar yozish va
fayl biriktirish. Yangi xabarlar real vaqtda keladi (GramJS `NewMessage`). Ro'yxatlar
virtualizatsiyalangan (`react-virtuoso`) — 1000+ chatda ham tez.

Bu yerda faqat foydalanuvchi o'zi tanlagan chatga qo'lda xabar yuboriladi — ommaviy yuborish yo'q.
Rasm/video thumbnail'lari va avatarlar `userData/media-cache`, `avatars/` da keshlanadi.

## Kontaktlar (CRM) va statistika

- **Teglar**: Kontaktlar tabida yaratiladi (nom, rang). Chatda **ⓘ Kontakt** kartasi — teglar va
  eslatma (faqat sizga ko'rinadi). Chatlar ro'yxatida filtr chiplarida teglar, qatorlarda rangli
  nuqtalar. Bot obunachilarida teglar jadvalda qalam orqali tahrirlanadi (vergul bilan).
- **Kontaktlar** tabi: teglangan yoki eslatmali chatlar ro'yxati, qidiruv, teg bo'yicha filtr,
  chatga o'tish.
- **Statistika** (Vazifalar → Statistika): kunlik yuborilgan postlar, rejali postlar, bot
  obunachilari o'sishi (grafik), oxirgi rassilkalar natijalari, kanal postlari ko'rishlari
  (Telegram'dan, ulangan akkaunt orqali).

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

### Kontent kalendar

Posting → **Kalendar**: oy va hafta ko'rinishi, har kunda rejali postlar (kanal avatarlari, vaqt,
holat rangi). Postni **sudrab** boshqa kun/soatga tashlang — Telegram'dagi rejali xabar o'chirilib
yangi vaqt bilan qayta rejalanadi (yuborilgan postlar sudralmaydi). Bo'sh kunga **ikki marta
bosing** (yoki «+») — o'sha sana bilan yangi post muharriri ochiladi.

### Stories va import

Posting → **Stories**: o'z profilingizga (Telegram Premium kerak) yoki admin kanalingizga (boost
darajasi kerak) rasm/video story, izoh, muddat (6–48 soat), kim ko'rishi, profilda saqlash.
Posting → **Import**: `.txt` (postlar `---` bilan ajratiladi, `# sarlavha` birinchi qatorda),
`.json` (`[{"title","text"}]`) yoki `.csv` (`sarlavha;matn`) fayldan postlar qoralama sifatida.
Chap panelda **Kanallar / Guruhlar** filtri.

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

### Rassilka

Botlar → bot → **Rassilka** → "+ Rassilka": auditoriya (barcha faol yoki teg bo'yicha), matn (HTML),
bitta media, URL tugmalar, hozir yoki rejali, ixtiyoriy "Obunadan chiqish: /stop" qatori.

- Faqat `unsubscribed_at IS NULL` obunachilarga.
- Tezlik: har xabar orasida kamida 50 ms (≤20/s, Bot API limiti 30/s dan zaxira bilan).
- 429 → `retry_after` + 1 s kutib qayta urinadi (3 marta); 403 (bloklagan) → obunadan chiqariladi.
- Har yetkazish `broadcast_deliveries` jadvalida: ilova yopilib qolsa keyingi ochilishda
  to'xtagan joyidan davom etadi, hech kimga ikki marta bormaydi.
- Pauza / davom / bekor; hisobot: yetkazildi, xato (sababi bilan), bloklaganlar.
- Rejali rassilka ilova ochiq (bot ishlayotgan) paytda boshlanadi — bu Bot API, Telegram
  tomonida rejalashtirish yo'q.

## Litsenziya

Server tomoni — Supabase (`supabase/` papkasi, to'liq yo'riqnoma: `supabase/README.md`).
Ilova `.env` dagi `MAIN_VITE_SUPABASE_URL`, `MAIN_VITE_SUPABASE_ANON_KEY`, `MAIN_VITE_LICENSE_PUBLIC_KEY`
orqali ulanadi (`.env.example` dan nusxa oling).

| Tarif  | Akkaunt | Bot | Xabar (post + rassilka) | Muddat        |
| ------ | ------- | --- | ----------------------- | ------------- |
| Trial  | 2       | 1   | 100 (jami)              | 7 kun         |
| Pro    | 10      | 5   | cheksiz                 | kalit bo'yicha |
| Agency | cheksiz | cheksiz | cheksiz             | kalit bo'yicha |

- Birinchi ochilishda email → 7 kunlik trial (bitta qurilma = bitta trial).
- Chap pastda: tarif, "Yuborildi X/Y", akkaunt/bot soni, "Tugaydi: sana".
- Kuniga bir marta serverdan tekshiriladi; internet bo'lmasa oxirgi holat **3 kun** amal qiladi.
- Muddat tugasa / 3 kun tekshirilmasa / bekor qilinsa — **faqat ko'rish**: yangi akkaunt, bot,
  post yuborish, rassilka bloklanadi (main process'da tekshiriladi, UI'ni aylanib o'tib bo'lmaydi).
- Javoblar Ed25519 bilan imzolangan; ilovada faqat ochiq kalit. Kesh `device_id` ga bog'langan.
- `.env` bo'sh bo'lsa — dev rejim: mahalliy 7 kunlik trial limitlari, server so'rovlari yo'q.

### Egasi rejimi (o'zingiz uchun, sotmasdan)

`.env` da `MAIN_VITE_OWNER_MODE=1` — Supabase kerak emas, limitlar yo'q (Agency darajasi), trial/kalit
oynasi chiqmaydi, chap pastda "Shaxsiy rejim · Cheksiz". Ixtiyoriy `MAIN_VITE_OWNER_DEVICE_ID`
(Sozlamalar → Litsenziya → Qurilma ID) — faqat o'sha kompyuterda cheksiz, boshqa joyda oddiy
litsenziya qoidalari. Keyinchalik sotmoqchi bo'lsangiz flagni olib tashlab Supabase'ni sozlaysiz.

## Xabarnoma: kampaniyalar, tayyor xabarlar, qora ro'yxat

**Kampaniya** — bitta xabar (matn + media) akkauntning **mavjud chatlariga** (siz bilan yozishgan
odamlar; akkaunt dialoglaridan tanlanadi, CRM tegi bo'yicha filtr) ketma-ket yuboriladi:
- xabarlar orasida tasodifiy kechikish (eng kami 3 s), har N xabardan keyin uzun pauza;
- akkaunt bo'yicha 24 soatlik limit (kampaniya + API birga; maks 200), «faqat yangilarga»;
- rejalashtirish, pauza/davom/bekor, hisobot (yuborildi / xato / o'tkazildi, sababi bilan);
- FLOOD_WAIT → kampaniya pauza, kutish tugagach o'zi davom etadi (2 soatgacha); **boshqa
  akkauntga o'tilmaydi**; PEER_FLOOD → to'xtaydi (ertaga davom eting).

Atayin **yo'q** narsalar: username/ID ro'yxatini import yoki guruhdan parsing qilib notanishlarga
yuborish, akkaunt rotatsiyasi, matnni «unikallashtirish». Bu spam va akkauntni ban qildiradi.

**Tayyor xabarlar** — nomi, matn, media, tugmalar (tugmalar faqat botlarda). Posting muharriri,
Chatlar, bot rassilkasi va kampaniyada «Tayyor xabar» tugmasi orqali qo'yiladi.

**Qora ro'yxat** — Telegram user ID bo'yicha; kampaniya va API ularga yubormaydi, botlar javob
bermaydi va obunaga olmaydi (rassilkada ham chiqarib tashlanadi).

## REST API (CRM integratsiyasi)

Sozlamalar → **REST API**: faqat `127.0.0.1` da ishlaydigan lokal server (default port 48123),
`X-Api-Key` (yoki `Authorization: Bearer`) kalit bilan. Dastur ishlab turgan kompyuterdan CRM yoki
skript so'rov yuboradi, xabar tanlangan akkauntdan ketadi.

```bash
curl -X POST http://127.0.0.1:48123/api/send \
  -H "X-Api-Key: <kalit>" -H "Content-Type: application/json" \
  -d '{"account_id": 1, "to": "@username", "text": "Salom! Buyurtmangiz tayyor."}'
```

- `GET /api/status` — holat, akkauntlar, kunlik limit; `GET /api/accounts`.
- `POST /api/send` — `to`: `@username`, `+998…` (faqat foydalanuvchi maxfiyligi ruxsat bersa),
  raqamli id yoki `u<id>`; `parse_mode`: `html` (default) yoki `text`. Javob `{"ok":true,
  "message_id":…}`; xatolar: 401 kalit, 400 so'rov, 404 topilmadi, 422 Telegram xatosi, 429
  kunlik limit yoki FLOOD_WAIT (`retryAfter` soniya — kutib qayta yuboring).
- Akkaunt bo'yicha navbat (kamida 3 s oralig'i), qora ro'yxat, kunlik limit (kampaniya bilan umumiy).
  Kalitni brauzer yoki xabarlarga bermang; «Yangilash» eski kalitni bekor qiladi.

## Vazifalar, loglar, tray, proksi, zaxira

- **Vazifalar** tabi: rejali postlar (Telegram'da turganlar), rassilkalar va kampaniyalar (ishlayotgan/pauza/rejali),
  sinxronlash va post yuborish jarayonlari — progress va to'xtatish tugmasi bilan. Rejali postni
  to'xtatish Telegram'dagi xabarni o'chiradi, post qoralamaga qaytadi.
- **Loglar**: daraja/modul filtri, qidiruv, nusxa olish, `.txt` eksport, tozalash. 30 kundan eski
  yozuvlar avtomatik o'chadi.
- **Tray**: oyna yopilganda ilova tray'da qoladi (Sozlamalar → Ilova; default yoqilgan) — rejali
  rassilkalar va botlar ishlashda davom etadi. Tray menyusi: Ochish, Botlarni to'xtatish, Chiqish.
- **Avto-start**: tizim bilan birga (macOS/Windows), yashirin holda (`--hidden`).
- **Proksi** (bitta umumiy): SOCKS5 — akkauntlar (GramJS), botlar va litsenziya; HTTP — faqat
  botlar va litsenziya (MTProto HTTP orqali ishlamaydi). O'zgartirilganda ulanishlar qayta quriladi.
- **Zaxira nusxa**: `.zip` (baza + avatarlar) eksport/import; import ilovani qayta ishga tushiradi.
  Sessiya/tokenlar shifrlangan — boshqa kompyuterda ochilmaydi (qayta login kerak).

## Build va tarqatish

| Buyruq                | Natija (`release/`)                                   |
| --------------------- | ----------------------------------------------------- |
| `npm run build:mac`   | `TG Manager-x.y.z-mac-arm64.dmg`, `…-mac-x64.dmg` + zip |
| `npm run build:win`   | `TG Manager-x.y.z-win-x64.exe` (NSIS installer)       |
| `npm run build:linux` | AppImage                                              |
| `npm run release`     | build + GitHub Release'ga yuklash (`GH_TOKEN` kerak)   |

Lokal build (`scripts/pack.mjs`) faqat shu kompyuter arxitekturasi uchun, native modul
rebuild'siz quradi (`postinstall` yuklagan tayyor `better-sqlite3` binar ishlatiladi) — Visual
Studio/Xcode kerak emas. Mac'da Windows build qilib bo'lmaydi (va aksincha). Ikkala mac
arxitekturasi (arm64 + x64) va GitHub Release — CI orqali (`release.yml`), u yerda electron-builder
native modullarni o'zi rebuild qiladi.

Build'dan oldin `.env` tekshiriladi (`scripts/check-env.mjs`): litsenziya serveri sozlanmagan
bo'lsa `build:*` ogohlantiradi, `release` esa to'xtaydi.

### Versiya chiqarish (GitHub Actions)

```bash
npm version patch
```

```bash
git push --follow-tags
```

`v*` tegi `.github/workflows/release.yml` ni ishga tushiradi: macOS (arm64 + x64) va Windows
build → GitHub Release. Kerakli secrets ro'yxati workflow faylining boshida.

### Avto-yangilanish

`electron-updater` GitHub Releases'dan tekshiradi (ishga tushgach 15 s, keyin har 6 soat).
Yangi versiya bo'lsa yuqorida banner: **Yuklab olish** → **O'rnatish va qayta ishga tushirish**.
Avtomatik yuklab olinmaydi. Sozlamalar → Ilova haqida → "Yangilanishni tekshirish".

Talab: Release'lar **ochiq (public)** repoda bo'lishi kerak — electron-updater private repodan
tokensiz yuklay olmaydi. Private bo'lsa, release'larni alohida public repoga chiqaring va
`electron-builder.cjs` dagi `publish.owner/repo` ni o'zgartiring.

### macOS: imzo va notarization

Apple Developer hisobi bo'lsa CI secrets'ga `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
`APPLE_TEAM_ID` va `CSC_LINK`/`CSC_KEY_PASSWORD` (Developer ID Application .p12, base64) qo'ying —
notarization avtomatik yoqiladi.

Bo'lmasa ilova imzosiz chiqadi va macOS "ochib bo'lmaydi" deydi. Foydalanuvchiga yo'riqnoma:
**Finder → ilova ustida o'ng klik → Ochish → Ochish**. Yoki terminalda:

```bash
xattr -cr "/Applications/TG Manager.app"
```

Windows'da imzosiz installer SmartScreen ogohlantiradi: **Qo'shimcha → Baribir ishga tushirish**.

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
