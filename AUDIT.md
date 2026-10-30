# Audit (14-qadam)

Format: **muammo → fayl → tuzatish**. Holat: ✅ tuzatildi · ⏳ keyingi qadamlarda · ℹ️ qaror (o'zgartirilmadi).

## 1. Xavfsizlik

| # | Muammo | Fayl | Tuzatish | Holat |
|---|--------|------|----------|-------|
| 1.1 | IPC so'rovlari validatsiyasiz handler'ga yetardi — renderer'ga kirib olgan kod ixtiyoriy shakl yuborishi mumkin edi | `src/main/ipc.ts` | Har kanal uchun zod sxema (`src/main/ipc-schemas.ts`, 49 ta); tip darajasida har kanalga sxema majburiy (`satisfies`). Mos kelmasa `BAD_REQUEST`, handler chaqirilmaydi | ✅ |
| 1.2 | IPC yuboruvchisi tekshirilmasdi | `src/main/ipc.ts` | Faqat bizning oynaning asosiy frame'i (`file://` yoki dev URL) qabul qilinadi, aks holda `FORBIDDEN` | ✅ |
| 1.3 | `sandbox: false` — preload'ga Node ruxsati ortiqcha edi | `src/main/index.ts` | `sandbox: true` (preload faqat `electron` ishlatadi) | ✅ |
| 1.4 | `setWindowOpenHandler` har qanday URL'ni `openExternal` ga uzatardi (`file:`, `javascript:` ham) | `src/main/index.ts` | Faqat `https?:`, `mailto:`, `tg:`; qolgani log bilan bloklanadi | ✅ |
| 1.5 | `will-navigate` himoyasi yo'q — oynaga fayl tashlansa renderer o'sha faylga o'tardi | `src/main/index.ts` | Dev URL'dan tashqari barcha navigatsiya bloklanadi | ✅ |
| 1.6 | Loglarga maxfiy ma'lumot tushishi | `src/main/logger.ts`, `security/crypto.ts` | Tekshirildi: meta'dagi `token/session/password/secret/api_hash` kalitlari yashiriladi, bot tokeni `mask()` bilan, GramJS logger `ERROR` darajasida. Qo'shimcha o'zgarish kerak emas | ℹ️ |
| 1.7 | Sessiya/token shifrlanishi | `security/crypto.ts` | Tekshirildi: `safeStorage` (Keychain/DPAPI), mavjud bo'lmasa aniq xato; renderer'ga `session_encrypted`/`token_encrypted` hech qachon yuborilmaydi (`PublicAccount`/`PublicBot`) | ℹ️ |
| 1.8 | `api_hash` sozlamalarda ochiq saqlanadi | `db/repositories/settings.ts` | Bu foydalanuvchining o'z ilova kaliti (my.telegram.org), sessiya emas; fayl userData'da. Xavf past — o'zgartirilmadi. Istalsa 2-bosqichda `safeStorage` bilan shifrlash mumkin | ℹ️ |
| 1.9 | `contextIsolation`, `nodeIntegration`, CSP | `index.ts`, `renderer/index.html` | Tekshirildi: `contextIsolation: true`, `nodeIntegration: false`, CSP `script-src 'self'`, rasm/media faqat `tgm-avatar:`/`tgm-file:` (whitelist yo'llar) | ℹ️ |
| 1.10 | Litsenziya keshi | `modules/license/service.ts` | Tekshirildi: imzo va `device_id` har o'qishda tasdiqlanadi; limitlar main'da | ℹ️ |

## 2. Barqarorlik

| # | Muammo | Fayl | Tuzatish | Holat |
|---|--------|------|----------|-------|
| 2.1 | Internet uzilib GramJS'ning o'z urinishlari tugasa akkaunt qayta ulanmasdi | `modules/accounts/clientManager.ts` | Holat kuzatuvi (15 s) ulanmagan klientni har 60 s da qayta ulaydi; sessiya saqlanadi | ✅ |
| 2.2 | Ushlanmagan promise xatolari jimgina yo'qolardi | `src/main/index.ts` | `unhandledRejection`/`uncaughtException` → log | ✅ |
| 2.3 | `logs` jadvali cheksiz o'sardi | `src/main/index.ts` | Ishga tushganda 30 kundan eski yozuvlar tozalanadi (`logsRepo.prune`) | ✅ |
| 2.4 | FLOOD_WAIT / 429 | `posting/send.ts`, `bots/broadcast.ts` | Tekshirildi: post — akkauntning qolgan nishonlari failed, boshqa akkauntga o'tilmaydi; rassilka — `retry_after`+1 s kutib 3 urinish. E2E bilan tasdiqlangan | ℹ️ |
| 2.5 | Ilova qulaganda navbatlar | `bots/broadcast.ts`, `posting/service.ts` | Rassilka — `broadcast_deliveries` orqali davom etadi (E2E). Post yuborish o'rtasida qulasa: yuborilganlar `sent`, qolganlari `pending` → post `draft`ga tushadi, foydalanuvchi qayta yuboradi (takror yubormaydi) | ℹ️ |
| 2.6 | Post yuborishda timeout yo'q (katta video yuklash uzoq bo'lishi mumkin) | `posting/send.ts` | Ataylab qoldirildi: upload progressi bilan birga 11-qadamda (Vazifalar) | ⏳ |
| 2.7 | Bot polling 409/401 | `bots/botManager.ts` | Tekshirildi: polling to'xtaydi, `lastError` UI'da | ℹ️ |

## 3. Ishlash tezligi va xotira

| # | Muammo | Fayl | Tuzatish | Holat |
|---|--------|------|----------|-------|
| 3.1 | Renderer `api.on` obunalari | `App.tsx`, `store/*.ts` | Tekshirildi: har `initXSync()` unsubscribe qaytaradi, `useEffect` cleanup'da chaqiriladi; `SettingsPage` interval'i tozalanadi | ℹ️ |
| 3.2 | Main interval'lari | `clientManager`, `broadcast.ts`, `license/service.ts` | Tekshirildi: `disconnectAll`/`stop` da tozalanadi; litsenziya tekshiruvi ilova umri davomida (maqsadli) | ℹ️ |
| 3.3 | `listPosts` har post uchun nishonlarni alohida so'raydi (N+1) | `posting/service.ts` | 200 ta post × 1 so'rov SQLite'da < 10 ms. O'zgartirilmadi; 1000+ post bo'lsa JOIN'ga o'tkaziladi | ℹ️ |
| 3.4 | Avatar yuklash sinxronlashda | `channels/sync.ts` | Tekshirildi: 40 ta/sinxronlash chegarasi, keshlanganlar qayta yuklanmaydi | ℹ️ |
| 3.5 | Katta chat ro'yxatlari (virtualizatsiya) | — | 4-qadam (Chatlar) hali qurilmagan; qurilganda `react-virtuoso` | ⏳ |
| 3.6 | Asar hajmi | `electron-builder.cjs`, `package.json` | Renderer kutubxonalari devDependencies'ga → 17 MB → 7 MB (13-qadam) | ✅ |

## 4. UI

| # | Muammo | Fayl | Tuzatish | Holat |
|---|--------|------|----------|-------|
| 4.1 | Ro'yxatlar yuklanguncha bo'sh joy ko'rinardi | `PostList`, `BotList`, `ChannelList`, `BroadcastPanel` | "Yuklanmoqda…" holati | ✅ |
| 4.2 | Bo'sh holatlar | barcha ro'yxatlar | Tekshirildi: akkaunt yo'q, kanal yo'q, post yo'q, bot yo'q, obunachi yo'q, rassilka yo'q — har birida yo'naltiruvchi matn | ℹ️ |
| 4.3 | O'zbekcha matnlar | — | "Postinг" (kirill г) → "Posting" (1-qadam); qolganlari ko'rib chiqildi | ✅ |
| 4.4 | Yuklanish skeletlari | `PlanBlock` | Tarif blokida bor; boshqa joylarda matnli holat yetarli | ℹ️ |

## Tekshiruv

- `typecheck`, `lint`, `build` toza.
- E2E to'plamlari (litsenziya dev fazasi, kanallar, posting, botlar) validatsiya qo'shilgandan keyin qayta o'tkazildi — normal oqimlar buzilmagan, noto'g'ri shakl `BAD_REQUEST` qaytaradi.
