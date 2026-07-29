# GSR marketing platformasi — texnik arxitektura va ish rejasi

Loyiha maqsadi: GSR Logistics uchun chuqur tahlil, statistika va AI kontent generatsiyasini bajaradigan marketing platformasi. Uch bosqich, birinchi ikkitasi asosiy vaqtni oladi.

---

## Arxitektura tamoyili — 4 mustaqil modul

**Yagona bog'lanish nuqtasi — ma'lumot qatlami.** Modullar bir-birini to'g'ridan-to'g'ri chaqirmaydi. Har biri faqat bazadan o'qiydi va bazaga yozadi. Shuning uchun bitta modul buzilsa (masalan, Ad Library API javob bermay qolsa), qolgan to'rttasi ishlashda davom etadi.

| # | Modul | Papka | Vazifasi |
|---|---|---|---|
| 1 | Ma'lumot qatlami | `modules/crm_data.py`, `meta_ads.py`, `page_insights.py` | CRM, Meta Ads va Insights'dan ma'lumot yig'ish va normalizatsiya |
| 2 | Tahlil | `modules/analytics.py` | ROI, konversiya, savdo tsikli, sovigan leadlar |
| 3 | AI kontent | `modules/content_factory.py`, `seasons.py` | Kontent-reja, reels ssenariy, 2 tilli matn, mavsumiy signallar |
| 4 | Razvedka | `modules/competitor_intel.py` | Raqobatchi kuzatuvi va obro' signali |

### Qabul qilingan qaror: modulli monolit

Talab: "bitta modul buzilsa boshqalari ishlashda davom etsin". Buni **modulli monolit** bilan bajaramiz — bitta jarayon, lekin qat'iy chegaralar: har bir modul alohida papka, o'z scheduler vazifasi, o'z konfiguratsiya bayrog'i. Har bir fon vazifasi xato tutuvchiga o'ralgan va nosozlik faqat o'sha vazifani to'xtatadi.

5 ta alohida mikroservis ham shu natijani beradi, lekin bitta odam qo'llab-quvvatlaydigan VPS uchun operatsion yuk (5 ta systemd unit, 5 ta port, o'zaro HTTP, alohida monitoring) asossiz.

Hozirgi kod allaqachon shu tamoyilda: razvedka modulini `.env` orqali butunlay o'chirsa bo'ladi, qolgani ishlayveradi. Keyinchalik biror modul og'irlashsa, aynan o'shanisini alohida servisga ajratish oson — chegaralar tayyor.

---

## Bazadagi asosiy jadvallar (1-bosqich uchun)

**`leads`** — CRM'dagi leadning **ko'zgusi** (nusxasi), tahlil uchun. Jarvis bu jadvalga faqat CRM'dan kelgan ma'lumotni yozadi, o'zi yangi lead yaratmaydi.

| Maydon | Izoh |
|---|---|
| `crm_id` | CRM'dagi ID — takrorlanmaslik va bog'lanish uchun |
| `source` | manba: qaysi ABO segment, kanal yoki referral |
| `referral_by` | tavsiya qilgan odam (bo'sh bo'lishi mumkin) |
| `status` | CRM bosqichi: yangi / bog'lanildi / narx aytildi / javob kutilmoqda / xisoblashga berildi / mijoz bo'ldi / yo'qotildi |
| `stage_changed_at` | oxirgi bosqich o'zgargan sana |
| `created_at` | CRM'da tushgan sana |
| `deal_amount` | bitim summasi (mijoz bo'lgan bo'lsa) |

**`lead_events`** — har bir status o'zgarishi alohida yozuv (qaysi bosqichdan qaysi bosqichga, qachon). Busiz "lead qaysi bosqichda yo'qolayotgani" hisoblanmaydi. Agar CRM bunday tarixni saqlamasa, webhook orqali bugundan boshlab yig'iladi — o'tmish uchun tsikl tahlili bo'lmaydi.

**`ad_spend`** — kun × kampaniya × ad set × segment kesimida xarajat, ko'rsatish, klik, lead soni.

**`page_insights`** — o'z Instagram/Facebook sahifamiz statistikasi (qamrov, saqlash, profil bosishlari).

**`competitor_ads`** — Ad Library'dan olingan raqobatchi reklamalari.

**`rank_checks`** — brend nomi bo'yicha haftalik o'rin tekshiruvi.

Mavjud `content_posts`, `chat_messages` va boshqalar o'z joyida qoladi.

---

## 1-BOSQICH — platforma to'g'ri va xatosiz ishlashi

Eng yuqori ustuvorlik. AI yo'q, faqat haqiqiy raqamlar.

### 1.1 Ma'lumot qatlami

**Qabul qilingan qaror: CRM — egasining o'zi qurgan alohida platforma.** Leadlar o'sha yerga tushadi, jadvalga emas.

Bu eng qulay holat: CRM begona xizmat emas, siz uni boshqarasiz, ya'ni integratsiyani aynan kerakli shaklda qilish mumkin.

**Muhim tamoyil: CRM — leadlar bo'yicha yagona haqiqat manbai.** Jarvis lead yaratmaydi, statusni o'zgartirmaydi va CRM'ni takrorlamaydi. U faqat **o'qiydi va tahlil qiladi**. Ikkita tizim bitta leadni alohida-alohida yuritsa, ma'lumot darrov bir-biriga mos kelmay qoladi va ikkalasiga ham ishonib bo'lmaydi.

CRM'dagi mavjud voronka bosqichlari:

`Yangi → Bog'lanildi → Narx aytildi → Javob kutilmoqda → Xisoblashga berildi → Mijoz bo'ldi → Yo'qotildi`

Bundan tashqari CRM'da `Bitimlar`, `Mijozlar`, `Bugun qo'ng'iroq` va `Uxlab qolgan mijozlar` bo'limlari bor. Oxirgisi diqqatga sazovor: "sovib qolgan leadlar" talabi CRM'da allaqachon qisman bajarilgan, shuning uchun Jarvis buni qaytadan qurmaydi — CRM'dan o'qib, tahlil va signal qismini qo'shadi.

**Qabul qilingan qaror: webhook.** CRM har bir o'zgarishda Jarvis'ga xabar yuboradi. Status qachon o'zgargani real vaqtda yoziladi, ya'ni savdo tsikli tahlili CRM tarix saqlaydimi-yo'qmi — baribir aniq ishlaydi.

**Qabul qilingan qaror: CRM'da lead manba maydoni bor.** Demak segment kesimida ROI to'g'ridan-to'g'ri hisoblanadi, qo'shimcha ish talab qilmaydi.

Qolgan manbalar:
- Meta Ads API: kampaniya → ad set → segment darajasida xarajat va natija
- Insights API: o'z sahifalarimiz statistikasi
- Har kecha avtomatik yangilanish + qo'lda "yangilash" tugmasi

### Webhook shartnomasi (CRM ↔ Jarvis)

CRM tomonidagi kodni siz yozasiz, shuning uchun shakl oldindan kelishiladi.

**Manzil:** `POST https://<jarvis-domen>/api/crm/webhook`
**Sarlavha:** `X-CRM-Secret: <umumiy maxfiy kalit>` — ikkala tomonning `.env` faylida bir xil turadi. Bu kalitsiz so'rov rad etiladi.

**Tana (JSON):**

```json
{
  "event": "lead.stage_changed",
  "event_id": "evt_8123",
  "occurred_at": "2026-07-28T19:33:00+05:00",
  "lead": {
    "id": "12345",
    "created_at": "2026-07-20T10:04:00+05:00",
    "status": "narx_aytildi",
    "previous_status": "boglanildi",
    "source": "meta_segment_2",
    "referral_by": null,
    "deal_amount": null
  }
}
```

**`event` qiymatlari:** `lead.created`, `lead.stage_changed`, `lead.updated`, `lead.deleted`

**`status` kodlari** (CRM voronkasiga mos): `yangi`, `boglanildi`, `narx_aytildi`, `javob_kutilmoqda`, `xisoblashga_berildi`, `mijoz_boldi`, `yoqotildi`

**Qoidalar:**
- `event_id` takrorlansa Jarvis uni e'tiborsiz qoldiradi — bir xil xabar ikki marta kelsa ham hisob buzilmaydi.
- Jarvis 2xx qaytarmasa, CRM 3 marta qayta urinsin (masalan 1, 5, 25 daqiqadan keyin). Jarvis o'chib qolsa ham ma'lumot yo'qolmaydi.
- **Shaxsiy ma'lumot yubormang.** Ism, telefon, manzil Jarvis'ga kerak emas — tahlil faqat `id`, sana, status va manba bilan ishlaydi. Mijoz bilan bog'lanish CRM'ning ishi. Bu ma'lumotni ikki joyda saqlamaslik va xavfni kamaytirish uchun.
- Bir martalik boshlang'ich yuklash uchun alohida manzil: `POST /api/crm/backfill` — o'sha shakldagi yozuvlar ro'yxatini qabul qiladi. Shu orqali eski leadlar ham tahlilga tushadi.

### Nomlanish qoidasi — Meta ad set ↔ CRM manba

ROI hisoblanishi uchun tizim reklama xarajatini CRM lidiga bog'lashi kerak. Bog'lanish **nom orqali** amalga oshadi: Meta'dagi ad set nomi CRM'dagi lead manbasi bilan bir xil bo'lishi kerak (katta-kichik harf, probel, tire va pastki chiziq hisobga olinmaydi).

**Haqiqiy ad set nomlari (Meta'dan o'qildi, 2026-07-29):** kampaniya `Yuk tashish - Lidlar`, uchta ad set:

| Meta ad set nomi | CRM `source` maydoniga yoziladigan qiymat |
|---|---|
| `Auditoriya 1` | `Auditoriya 1` yoki `auditoriya_1` |
| `Auditoriya 2` | `Auditoriya 2` yoki `auditoriya_2` |
| `Auditoriya 3` | `Auditoriya 3` yoki `auditoriya_3` |

Katta-kichik harf, probel, tire va pastki chiziq hisobga olinmaydi — `Auditoriya 1`, `auditoriya-1` va `AUDITORIYA_1` bir xil deb qabul qilinadi. Faqat harf va raqamlar mos kelishi kerak.

**Sherikka aytiladigan gap:** Meta'dan kelgan lidning `source` maydoniga aynan shu uch qiymatdan birini yozsin. Boshqa kanallar uchun ixtiyoriy nom (`telegram`, `tavsiya`, `instagram_organik`) — ular reklama bilan bog'lanmaydi va "reklamasiz kelgan lidlar" bo'limida ko'rinadi.

Mos kelmasa tizim **jim qolmaydi**: bunday ad set "CRM bilan bog'lanmagan" belgisi bilan ko'rsatiladi va tavsiyalar ro'yxatida "tekshiring" chiqadi. Ya'ni nomlanish xatosi yashirin qolmaydi, lekin uni odam tuzatishi kerak — buni avtomatik taxmin qilish noto'g'ri hisob-kitobga olib kelishi mumkin.

Amalda: ABO kampaniyasidagi 3 ta ad set nomini CRM'dagi manba qiymatlariga moslashtiring (yoki teskarisi). Bir marta qilinadigan ish.

### 1.2 Tahlil va dashboard
- Lead statistikasi: kunlik, oylik, yillik kesim — tushdi / gaplashildi / sotildi / javobsiz
- ROI tahlili: har bir ABO segment bo'yicha xarajat → lead → sotuv, va "byudjetni qayerga qo'shish, qayerni to'xtatish" tavsiyasi
- Savdo tsikli: lead qaysi bosqichda ko'proq yo'qolyapti
- Sovigan leadlar: 2+ hafta javobsiz qolganlar ro'yxati va qayta murojaat eslatmasi
- Referral sifati: tavsiya orqali kelgan leadlarning boshqa manbalarga nisbatan konversiyasi
- O'z sahifalarimiz statistikasi

### 1.3 Razvedka — yengil versiya

⚠️ **Ad Library API bu vazifani bajara olmaydi — tekshirildi va tasdiqlandi.**

Meta hujjatida aniq yozilgan: *"Ads that did not reach any location in the EU will only return if they are about social issues, elections or politics."* Ya'ni `ads_archive` endpointi tijorat reklamalarini faqat Yevropa Ittifoqi va Britaniya uchun qaytaradi (u yerda DSA qonuni majbur qiladi). O'zbekiston auditoriyasiga berilgan reklamalar API'da umuman ko'rinmaydi.

Ad Library **veb-sayti** esa butun dunyo bo'yicha ochiq — raqobatchilarni u yerda qo'lda ko'rish mumkin. Lekin uni avtomatik o'qish scraping bo'ladi, bu esa taqiqlangan.

**Qaror:** raqobatchi reklamalarini kuzatish 1-bosqichdan chiqarildi va 2.2 bandiga (pullik provayder bilan) ko'chirildi. Oraliqda: Telegram kanallari ochiq API orqali kuzatiladi (allaqachon ishlaydi) va Jarvis haftalik eslatma berib turadi — Ad Library saytini qo'lda ochib ko'rish uchun.

- **O'rin kuzatuvi 1-bosqichda yo'q** (qabul qilingan qaror) — Google va OLX'da o'rin tekshirish rasmiy bepul API'ga ega emas, pullik xizmat talab qiladi. Kerak bo'lganda keyinroq qo'shiladi.

**Muhim aniqlik:** "butun internetni skanerlash" va "doim birinchi o'rinda chiqishni kafolatlash" — bu dasturiy funksiya emas, SEO/ORM ish jarayoni. Platforma faqat **kuzatadi va signal beradi**, natijani kafolatlamaydi. WeChat monitoringi past prioritet — Xitoy tomonidagi cheklovlar sababli ishonchli emas.

**Tayyor mezoni:** telefondan ochib, o'tgan oy qaysi segment qancha pul yegani va qanchasi sotuvga aylanganini ko'ra olasiz.

---

## 2-BOSQICH — AI generatsiya

### 2.1 Kontent generatsiya
- Dashboard statistikasiga asoslanadi: qaysi kontent turi sotuv keltirgani AI'ga kirish ma'lumoti bo'ladi
- Sotuvga yo'naltirilgan tuzilma (3P yoki tanlangan freymvork)
- Ikki tilli: har bir g'oyaning o'zbekcha va ruscha versiyasi
- Mavsumiy bashorat: Xitoy bayramlari kalendari (Yangi yil, Golden Week) asosida oldindan "hozir buyurtma bering" signali
- Haftasiga 2-3 rasmli/karusel post — rasm generatsiyasi orqali (pastga qarang)

### 2.2 Razvedka — chuqurlashtirilgan
- Raqobatchi kontent rejalari — rasmiy pullik provayderlar orqali (Apify, Bright Data va shunga o'xshash). **To'g'ridan-to'g'ri scraping ishlatilmaydi** — ToS xavfi
- Ularning taktikasini aniqlash va javob rejasini tuzish
- Obro' kuzatuvi: Google reviews, OLX sharhlari, kommentlar — salbiy fikrda signal

---

## 3-BOSQICH — dizayn

Mantiq va funksionallik to'liq ishlagandan keyin: dashboard va UI'ni professional darajada pardozlash.

---

## Rejadan chiqarilgan

**Ops-sotuv ko'prigi (rasstamojka PDF taklif generatori)** — egasining qarori bilan olib tashlandi. Kerak bo'lsa keyinchalik alohida modul sifatida qo'shiladi; boshqa modullarga bog'liq emas.

---

## Hozir nima tayyor

| Qism | Holat |
|---|---|
| Backend yadrosi, auth, PWA, deploy fayllari | tayyor va sinovdan o'tgan |
| **Ma'lumot qatlami (1-modul) — Jarvis tomoni** | **tayyor** — webhook qabul qiluvchi, backfill, `leads` va `lead_events` |
| **Tahlil (2-modul)** | **tayyor** — voronka, oylik dinamika, manba kesimi, tavsiya sifati, sovigan lidlar, savdo tsikli |
| **Meta Ads integratsiyasi va ROI tahlili** | **kod tayyor** — token kelishi bilan ishlaydi |
| **Instagram Insights (o'z sahifamiz)** | **kod tayyor** — token kelishi bilan ishlaydi |
| **Mavsumiy kalendar** | **tayyor** — Xitoy bayramlari, kontent-planga avtomatik ulanadi |
| **Ikki tilli kontent (UZ + RU)** | **tayyor** — har post ikki tilda, ilovada almashtirgich |
| **Strategiya moduli** | **yangilandi** — endi lid, ROI, Insights va mavsum raqamlarini o'qiydi |
| **Avtomatik testlar** | **tayyor** — `backend/tests/`, 26 ta test |
| Ma'lumot qatlami — CRM tomoni | sherik yozadi (webhook yuborish) |
| Raqobatchi reklamalari | 2-bosqichga ko'chdi — Ad Library API O'zbekiston uchun ishlamaydi |
| Razvedka (4-modul) | qisman — Telegram o'qiydi, haftalik qo'lda tekshirish eslatmasi bor |

**Modul fayllari:**

| Fayl | Vazifasi |
|---|---|
| `app/modules/crm_data.py` | CRM webhook qabul qilish, backfill |
| `app/modules/meta_ads.py` | Reklama xarajati (Marketing API) |
| `app/modules/page_insights.py` | O'z Instagram sahifamiz statistikasi |
| `app/modules/analytics.py` | Voronka, ROI, sovigan lidlar, tsikl |
| `app/modules/seasons.py` | Xitoy bayramlari kalendari va signallar |
| `app/modules/content_factory.py` | Ikki tilli kontent-plan (mavsumga ulangan) |
| `app/modules/strategy_advisor.py` | Oylik strategiya (haqiqiy raqamlar asosida) |
| `app/modules/imagegen.py` | Rasm generatsiyasi (OpenAI) — Canva Enterprise talab qilgani uchun rad etildi |

**Demo ma'lumot:** `python seed.py` (kontent-plan), `seed_leads.py` (120 lid), `seed_ads.py` (reklama xarajati), `seed_insights.py` (Instagram statistikasi). Har biri `--clear` bilan o'chiriladi. Demo yozuvlar borligi ilovada ogohlantirish sifatida ko'rsatiladi.

**O'rnatish yordamchilari:** `bootstrap_env.py` (`.env`ni avtomatik kalitlar bilan yaratadi), `setup_check.py` (8 qadamli o'rnatish holatini tekshiradi, faqat o'qiydi), `setup_meta.py` / `check_meta_token.py --apply` (Meta tokenini tekshirib `.env`ga yozadi). To'liq tartib: README.md.

**Testlar:** `python -m pytest tests -q` — 33 ta test, tashqi API'larga bog'liq emas, alohida vaqtinchalik bazada ishlaydi.

**Meta tokeni kelgach nima bo'ladi:** `.env` ga `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` va `IG_BUSINESS_ID` yoziladi, xizmat qayta ishga tushiriladi. Shundan keyin har kuni 06:00 da reklama xarajati, 06:10 da Instagram statistikasi avtomatik yangilanadi. Qo'lda: `POST /api/analytics/sync-ads`, `POST /api/analytics/sync-insights`. Kodda boshqa o'zgarish kerak emas.

**Avtomatik jadval:**

| Vaqt | Ish |
|---|---|
| Har kuni 06:00 | Meta Ads xarajati (token bo'lsa) |
| Har kuni 06:10 | Instagram Insights (token bo'lsa) |
| Dushanba 08:00 | Haftalik kontent-plan (ikki tilli, mavsumga bog'langan) |
| Dushanba 09:00 | Haftalik eslatma: Ad Library'ni qo'lda ko'rish + mavsumiy signallar |
| Yakshanba 20:00 | Raqobatchi tahlili (yoqilgan bo'lsa) |
| Oyning 1-sanasi 09:00 | Oylik strategiya |

---

## Qabul qilingan qarorlar

| Savol | Qaror |
|---|---|
| CRM | Egasining o'zi qurgan platforma. U yagona haqiqat manbai, Jarvis faqat o'qiydi |
| CRM integratsiyasi | Webhook — CRM har o'zgarishda Jarvis'ga xabar yuboradi |
| Lead manbai | CRM'da manba maydoni bor — segment kesimida ROI hisoblanadi |
| Arxitektura | Modulli monolit, qat'iy chegaralar bilan |
| O'rin kuzatuvi | 1-bosqichda yo'q, keyinroq (pullik xizmat talab qiladi) |

## Hali ochiq savollar

1. **Meta tokeni** — hozir shu ustida ishlanmoqda. Olish tartibi README'da, tekshirish uchun `python scripts/check_meta_token.py`.
2. **CRM webhook** — sherik yozadi. Status tarixi saqlanadimi degan savol tahlilni to'smaydi; faqat eski ma'lumot backfill'ga tushadimi-yo'qmi shunga ta'sir qiladi.

## 1-bosqich ish ketma-ketligi

| # | Ish | Kim | Bog'liqlik |
|---|---|---|---|
| 1 | `leads` va `lead_events` jadvallari + webhook qabul qiluvchi | Jarvis tomoni | yo'q — hoziroq boshlanadi |
| 2 | CRM'dan webhook yuborish + backfill | CRM tomoni | 1-qadam tayyor bo'lgach |
| 3 | Dashboard: lead statistikasi, savdo tsikli, sovigan leadlar, referral sifati | Jarvis tomoni | 2-qadam |
| 4 | Meta Ads integratsiyasi va segment ROI | Jarvis tomoni | Meta tokeni |
| 5 | Insights — o'z sahifalarimiz statistikasi | Jarvis tomoni | Meta tokeni |
| 6 | Ad Library — raqobatchi reklamalari | Jarvis tomoni | yo'q |

1-qadam boshqa hech narsani kutmaydi: shartnoma kelishilgan, ya'ni qabul qiluvchi tomonni hoziroq qurish mumkin. Siz CRM tomonini keyin, o'zingizga qulay paytda yozasiz — Jarvis tayyor turadi.
