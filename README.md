# GSR Jarvis — AI marketing shtabi

GSR Logistics uchun AI marketing assistenti: haftalik Instagram kontent-plan, raqobat razvedkasi, sotuv strategiyasi va tasdiqlash orqali Instagramga joylash. Miya — Anthropic Claude API. Interfeys — telefonga o'rnatiladigan PWA (o'zbek tilida).

## Tarkibi

| Modul | Vazifasi |
|---|---|
| **Ma'lumot qatlami** | CRM'dan lidlarni webhook orqali qabul qilish, Meta Ads xarajati, Instagram statistikasi |
| **Tahlil** | Savdo voronkasi va yo'qotish bosqichlari, segment bo'yicha ROI, sovigan lidlar, tavsiya sifati |
| **Content Factory** | Har dushanba 08:00 (Toshkent) — 5 ta postdan iborat haftalik plan, **o'zbekcha va ruscha**, mavsumiy signallarga bog'langan |
| **Mavsumiy kalendar** | Xitoy bayramlari (Yangi yil, Oltin hafta, 11.11) — oldindan "hozir buyurtma bering" signali |
| **Competitor Intelligence** | Telegram kanallarini (ochiq ma'lumot) skan qilish + haftalik Claude tahlili |
| **Sales Strategy Advisor** | Har oy 1-sanada keyingi oy taktikalari — haqiqiy lid va ROI raqamlari asosida |
| **Publishing Pipeline** | Meta Graph API orqali Instagramga joylash — **faqat egasi tasdiqlagandan keyin** |

To'liq texnik arxitektura va bosqichma-bosqich reja: [REJA.md](REJA.md)

**XAVFSIZLIK QOIDASI:** Hech narsa avtomatik joylanmaydi. `backend/app/modules/publisher.py` faqat bitta joydan — egasi JWT bilan himoyalangan `/api/publish` endpointidan chaqiriladi; scheduler'da publisher'ga umuman import yo'li yo'q, funksiya o'zi ham `approved` bo'lmagan postni rad etadi. Bu sozlama emas — arxitektura.

## Papka tuzilishi

```
backend/    FastAPI + SQLite + APScheduler + Claude klienti
frontend/   React + Vite PWA (Chat / Shtab)
deploy/     systemd service + nginx konfiguratsiyasi
.env.example  Barcha sozlamalar namunasi
```

---

# VPS'ga o'rnatish (Ubuntu 24.04, bosqichma-bosqich)

## 0. Talablar

- Ubuntu 24.04 VPS (Contabo), root yoki sudo kirish
- Domen (masalan `jarvis.gsr.uz`) — A-yozuvi VPS IP'ga qaratilgan. **PWA va push HTTPS'siz ishlamaydi**, shuning uchun domen shart.
- Anthropic API kaliti

```bash
sudo apt update && sudo apt install -y python3-venv python3-pip nginx git
# Node 20 (frontend build uchun)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 1. Kodni ko'chirish

```bash
sudo mkdir -p /opt/gsr-jarvis && sudo chown $USER /opt/gsr-jarvis
git clone https://github.com/anvarjonovalisher163-wq/gsr-jarvis.git /opt/gsr-jarvis
cd /opt/gsr-jarvis
git config core.hooksPath .githooks
```

Repo **yopiq (private)** — clone qilishda GitHub login so'raladi. VPS uchun eng qulayi [Personal Access Token](https://github.com/settings/tokens) yaratib, parol o'rniga ishlatish.

Oxirgi qator maxfiy ma'lumot himoyasini yoqadi (pastda tushuntirilgan) — har bir yangi nusxada bir marta bajariladi.

## 2. Backend: venv va kutubxonalar

```bash
cd /opt/gsr-jarvis/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 3. .env sozlash

Eng tez yo'l — avtomatik generatsiya (parol hash, JWT va CRM kalitlarini o'zi yaratadi):

```bash
cd /opt/gsr-jarvis/backend
source venv/bin/activate
python scripts/bootstrap_env.py
```

Dev parol standart bo'yicha `jarvis-dev-2026` — o'zgartirish: `--password "boshqa-parol"`. Mavjud `.env`ni ustidan yozmaydi; qayta yaratish uchun `--force` (eski nusxa `.env.bak` ga zaxiralanadi).

Yoki qo'lda:

```bash
cd /opt/gsr-jarvis
cp .env.example .env
nano .env
```

```bash
# Parol hash (OWNER_PASSWORD_HASH uchun)
python scripts/hash_password.py

# JWT_SECRET uchun
python -c "import secrets; print(secrets.token_hex(32))"

# VAPID kalitlari (push uchun)
python scripts/generate_vapid_keys.py
```

`.env` da to'ldirilishi shart: `ANTHROPIC_API_KEY`, `OWNER_LOGIN`, `OWNER_PASSWORD_HASH`, `JWT_SECRET`. Qolganlari ixtiyoriy (pastda).

### O'rnatish holatini istalgan payt tekshirish

```bash
python scripts/setup_check.py            # barcha 8 qadam
python scripts/setup_check.py --step 5    # faqat bitta qadam (masalan Meta)
```

Faqat o'qiydi — hech narsani o'zgartirmaydi. Har qadamni tekshiradi: Python muhiti → `.env` → baza → testlar → Meta token → frontend build → VPS → CRM. Birinchi muvaffaqiyatsiz **majburiy** qadamda to'xtaydi va nima qilish kerakligini ko'rsatadi (Meta/Instagram va VPS/CRM qadamlari ixtiyoriy — ular yo'qligi keyingi qadamlarni bloklamaydi).

## 4. Seed — namunaviy ma'lumot

Birinchi ishga tushirishda ekranlar bo'sh bo'lmasligi uchun. CRM va Meta ulangach `--clear` bilan o'chiriladi.

```bash
cd /opt/gsr-jarvis/backend
source venv/bin/activate
python seed.py            # kontent-plan (5 post, UZ + RU)
python seed_leads.py      # 120 ta namunaviy lid
python seed_ads.py        # 30 kunlik reklama xarajati
python seed_insights.py   # Instagram statistikasi
```

Testlarni ishga tushirish (tashqi API'ga bog'liq emas):

```bash
python -m pytest tests -q
```

## 5. Lokal tekshirish

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
# boshqa terminalda:
curl http://127.0.0.1:8000/api/health   # -> {"status":"ok"}
```

Ishlasa `Ctrl+C` bilan to'xtating.

## 6. systemd xizmati

```bash
sudo useradd -r -s /usr/sbin/nologin jarvis
sudo chown -R jarvis:jarvis /opt/gsr-jarvis
sudo cp /opt/gsr-jarvis/deploy/gsr-jarvis.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gsr-jarvis
sudo systemctl status gsr-jarvis        # active (running) bo'lishi kerak
journalctl -u gsr-jarvis -f             # jonli loglar
```

## 7. Frontend build

```bash
cd /opt/gsr-jarvis/frontend
npm install
npm run build          # -> frontend/dist
sudo chown -R jarvis:jarvis /opt/gsr-jarvis/frontend/dist
```

## 8. nginx + SSL

```bash
sudo cp /opt/gsr-jarvis/deploy/nginx.conf /etc/nginx/sites-available/gsr-jarvis
sudo nano /etc/nginx/sites-available/gsr-jarvis   # server_name'ni o'z domeningizga o'zgartiring
sudo ln -s /etc/nginx/sites-available/gsr-jarvis /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL (majburiy — PWA/push HTTPS talab qiladi)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d jarvis.gsr.uz
```

Brauzerda `https://jarvis.gsr.uz` oching — login sahifasi chiqadi.

## 9. PWA'ni telefonga o'rnatish

**Android (Chrome):** saytni oching → menyu (⋮) → **"Ilovani o'rnatish" / "Add to Home screen"**.

**iPhone (Safari):** saytni oching → Ulashish tugmasi → **"Add to Home Screen"**.

O'rnatilgach ilova alohida oynada, ilovadek ochiladi. Ko'rilgan sahifalar offlayn ham ochiladi.

## 10. Push bildirishnomalarni yoqish

Ilovaga kirib, yuqoridagi **🔔** tugmasini bosing va ruxsat bering. Shundan keyin haftalik plan, raqobat tahlili va oylik strategiya tayyor bo'lganda telefonga bildirishnoma keladi. (`.env` da VAPID kalitlari to'ldirilgan bo'lishi kerak — 3-bosqich.)

---

# Instagramga joylash

Token yuqoridagi bo'limda olinadi — qo'shimcha sozlash kerak emas.

**Muhim:** Instagram API matnli postni rasmsiz qabul qilmaydi. Postga **ochiq internetdan yuklab olinadigan** rasm URL biriktiring (Shtab → post → Tahrirlash → RASM URL). 1080x1080 (post) yoki 1080x1350 (karusel) tavsiya etiladi. Bir nechta URL vergul bilan yozilsa — karusel bo'lib joylanadi.

**Xavfsizlik:** hech qanday post avtomatik joylanmaydi. Joylash faqat siz "Instagramga joylash" tugmasini bosganingizda sodir bo'ladi va faqat tasdiqlangan postlar uchun ishlaydi.

# CRM ulash (webhook)

Lidlar sizning CRM'ingizda qoladi — Jarvis ularni faqat o'qib tahlil qiladi, o'zi lead yaratmaydi.

1. `.env` da `CRM_WEBHOOK_SECRET` uchun kalit yarating:
   `python -c "import secrets; print(secrets.token_hex(32))"`
2. Xuddi shu kalitni CRM tomonida ham saqlang.
3. CRM har bir o'zgarishda `POST https://<domen>/api/crm/webhook` ga JSON yuborsin, `X-CRM-Secret` sarlavhasi bilan.
4. Eski lidlarni bir marta yuklash: `POST /api/crm/backfill`.

To'liq shakl, status kodlari va qoidalar: [REJA.md](REJA.md) → "Webhook shartnomasi".

**Muhim:** ism va telefon yubormang — tahlil uchun kerak emas, mijoz bilan bog'lanish CRM'ning ishi.

# Meta tokenini olish (bosqichma-bosqich)

Bitta token uchta ishni ochadi: reklama xarajati (ROI), Instagram statistikasi va postni joylash.

> ⚠️ **Tokenni hech kimga yubormang** — chatga ham yozmang. U faqat `.env` fayliga yoziladi.

## Tayyorgarlik

- Instagram profilingiz **Business** turida va Facebook sahifaga bog'langan bo'lsin
- [business.facebook.com](https://business.facebook.com) da Business Manager mavjud bo'lsin
- [developers.facebook.com](https://developers.facebook.com) da ilova (app) yarating, unga **Marketing API** va **Instagram Graph API** mahsulotlarini qo'shing

## Token olish — System User (tavsiya, muddati tugamaydi)

1. [business.facebook.com/settings](https://business.facebook.com/settings) → **Users → System Users**
2. **Add** → nom bering (masalan `jarvis`), roli: **Admin**
3. **Add Assets** — uchtasini ham biriktiring:
   - **Ad Account** → reklama akkauntingiz → `View performance` (yoki `Manage`)
   - **Pages** → Facebook sahifangiz → `Full control`
   - **Instagram accounts** → Instagram profilingiz
4. **Generate New Token** → ilovangizni tanlang → quyidagi ruxsatlarni belgilang:

   | Ruxsat | Nima uchun |
   |---|---|
   | `ads_read` | Reklama xarajati va ROI |
   | `instagram_basic` | Instagram sahifa ma'lumoti |
   | `instagram_manage_insights` | Qamrov, profil ko'rishlar |
   | `pages_show_list` | Instagram business ID'ni topish |
   | `instagram_content_publish` | Postni joylash |
   | `pages_read_engagement` | Sahifa ma'lumoti |

5. **Token faqat bir marta ko'rsatiladi** — darhol nusxalang.

> Tezroq sinash uchun [Graph API Explorer](https://developers.facebook.com/tools/explorer) orqali ham token olsa bo'ladi, lekin u 1-2 soatda tugaydi. Doimiy ishlash uchun System User tokeni kerak.

## Tokenni tekshirish va saqlash

Eng tez yo'l — yo'riqnoma + tekshiruv + saqlash bitta buyruqda:

```bash
cd /opt/gsr-jarvis/backend
source venv/bin/activate
python scripts/setup_meta.py --apply
```

Tokenni oldin `.env` fayliga qo'ying (`META_ACCESS_TOKEN=EAAG...`) — skript uni o'zi o'qiydi. Yo'riqnomasiz, faqat tekshirish uchun:

```bash
python scripts/check_meta_token.py          # faqat ko'rsatadi, .env ga tegmaydi
python scripts/check_meta_token.py --apply  # tekshiradi va topilgan ID'larni .env ga yozadi
```

Ikkalasi ham:

- qaysi ruxsatlar berilgan va qaysi biri yetishmayotganini ko'rsatadi
- reklama akkauntingiz va Instagram business ID'ni **o'zi topib beradi**
- xarajat va statistikani haqiqatan o'qib ko'radi
- token topilmasa sababini aniqlaydi (bo'sh qator, izohga aylangan qator, BOM va h.k.) — qiymatning o'zini ko'rsatmasdan

`--apply` faqat `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `IG_BUSINESS_ID` qatorlarini yangilaydi — qolgan sozlamalarga tegmaydi. `--apply` siz skript hech narsani o'zgartirmaydi, faqat o'qiydi.

So'ng qayta ishga tushiring:

```bash
sudo systemctl restart gsr-jarvis
```

Shundan keyin har kuni 06:00 da reklama xarajati, 06:10 da Instagram statistikasi avtomatik yangilanadi.

## ROI ishlashi uchun bitta shart

**Meta'dagi ad set nomi CRM'dagi lead manbasi bilan mos bo'lishi kerak** (katta-kichik harf va tinish belgilari hisobga olinmaydi): `Meta Segment 1` ↔ `meta_segment_1`.

Mos kelmasa ilova jim qolmaydi — o'sha segment yonida to'q sariq nuqta chiqadi va tavsiyalar ichida "tekshiring" yoziladi. Bir marta ABO kampaniyangizdagi 3 ta ad set nomini CRM manbalariga moslashtirsangiz, keyin doim ishlaydi.

# Raqobat razvedkasi

- Shtab'da raqobatchilarni API orqali qo'shish mumkin (`POST /api/competitors/`), yoki seed'dagi namunalarni o'zgartiring.
- **Telegram** kanallari ochiq `t.me/s/<kanal>` sahifasidan ishonchli o'qiladi.
- **Instagram** anonim skanerlashni bloklaydi — modul faqat ochiq ma'lumot bilan ishlaydi va hech qanday login/parol ishlatmaydi. Kerak bo'lsa `competitor_intel.py` dagi `fetch_instagram_posts` ga rasmiy API ulang.
- **Meta Ad Library API O'zbekiston uchun ishlamaydi.** Meta hujjatiga ko'ra, tijorat reklamalari faqat Yevropa Ittifoqi hududida ko'rinadi; O'zbekistonga berilgan reklamalar API'da umuman qaytmaydi. Ad Library **veb-sayti** esa ochiq — shuning uchun Jarvis har dushanba 09:00 da uni qo'lda ko'rish uchun eslatma yuboradi. Avtomatik raqobatchi reklama tahlili 2-bosqichda, pullik provayder orqali qo'shiladi.
- Rejalashtirilgan skan `.env` da `COMPETITOR_SCRAPE_ENABLED=true` bo'lgandagina ishlaydi; ilovadagi "Skan qilish" tugmasi doim ishlaydi. Modul to'liq izolyatsiyalangan — o'chirilsa ham qolgan tizim ishlayveradi.

# Xarajatlarni nazorat qilish

- `CLAUDE_MODEL` — standart `claude-sonnet-4-6`; sifat kerak bo'lsa `claude-opus-4-8` ga almashtirish mumkin (qimmatroq).
- `CHAT_HISTORY_WINDOW` — har so'rovda Claude'ga yuboriladigan tarix hajmi.
- `CLAUDE_MAX_TOKENS` / `CLAUDE_PLAN_MAX_TOKENS` — javob uzunligi cheklovlari.
- System prompt keshlanadi (prompt caching) — prompt kattalashsa takroriy so'rovlar arzonlashadi.
- System promptni o'zgartirish: `backend/app/prompts/system_prompt.txt` → `sudo systemctl restart gsr-jarvis`.

# Postgres'ga o'tish yo'li

SQLite bitta foydalanuvchi uchun bemalol yetadi. O'sganda:

```bash
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER jarvis WITH PASSWORD 'kuchli-parol';"
sudo -u postgres psql -c "CREATE DATABASE jarvis OWNER jarvis;"
/opt/gsr-jarvis/backend/venv/bin/pip install "psycopg[binary]"
```

`.env` da:

```
DATABASE_URL=postgresql+psycopg://jarvis:kuchli-parol@localhost/jarvis
```

`sudo systemctl restart gsr-jarvis` — jadvallar avtomatik yaratiladi (eski ma'lumotni ko'chirish kerak bo'lsa `pgloader` ishlating yoki `seed.py` ni qayta ishga tushiring).

# Lokal ishga tushirish (HTTPS)

Dev server HTTPS'da ishlaydi. Bu maxfiylik uchun emas: brauzer service worker'ni ro'yxatdan o'tkazishi, ilovani PWA sifatida o'rnatishi va push yuborishi uchun `localhost` dan tashqarida **HTTPS shart**. Telefonda sinash faqat shu yo'l bilan ishlaydi.

## Bir martalik tayyorgarlik — ishonchli sertifikat

Oddiy self-signed sertifikat yetarli emas: brauzer unga ishonmaydi va **service worker'ni umuman ro'yxatdan o'tkazmaydi**, ya'ni PWA ishlamaydi. Shuning uchun `mkcert` — u mahalliy ishonchli sertifikat markazini o'rnatadi.

```bash
winget install FiloSottile.mkcert     # Windows
mkcert -install                        # ishonchli CA ni tizimga qo'shadi

cd frontend
mkdir certs && cd certs
mkcert -cert-file dev-cert.pem -key-file dev-key.pem localhost 127.0.0.1 ::1 <KOMPYUTER-IP>
```

`<KOMPYUTER-IP>` — Wi-Fi tarmoqdagi manzilingiz (`ipconfig` da ko'rinadi, masalan `192.168.68.107`). Telefonda ochish uchun kerak.

Sertifikatlar `.gitignore` da — repoga tushmaydi.

Agar `certs/` papkasi bo'lmasa, dev server baribir ishga tushadi (self-signed bilan), lekin brauzer ogohlantiradi va PWA funksiyalari o'chiq bo'ladi.

## Kundalik ishlash

```bash
# 1-terminal — backend
cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --port 8000

# 2-terminal — frontend
cd frontend && npm run dev
```

Ochiladi: `https://localhost:5173`

## PWA'ni telefonda sinash

Dev rejimida service worker **ataylab o'chirilgan** — u yerda modul manzillari hash'siz (`/src/App.jsx`), keshlansa har tahrirdan keyin eski kod ko'rinaverardi.

PWA'ni sinash uchun haqiqiy build kerak:

```bash
cd frontend
npm run build
npm run preview
```

Telefonda oching: `https://<KOMPYUTER-IP>:4173`

Telefon sertifikatga ishonishi uchun mkcert ildiz sertifikatini unga ham o'rnatish kerak (`mkcert -CAROOT` papkasidagi `rootCA.pem` faylini telefonga yuborib o'rnatasiz). Busiz brauzer ogohlantiradi va service worker ro'yxatdan o'tmaydi.

Ishlab chiqarishda bu muammo yo'q — nginx certbot bilan haqiqiy sertifikat beradi.

# Kod bilan ishlash (GitHub)

Repo: [github.com/anvarjonovalisher163-wq/gsr-jarvis](https://github.com/anvarjonovalisher163-wq/gsr-jarvis) — **private**.

## Maxfiy ma'lumot himoyasi

Repoda `.githooks/pre-commit` bor. U har bir commitdan oldin ishga tushib, quyidagilarni **bloklaydi**:

- `.env` va shunga o'xshash sozlama fayllari (`.env.example` bundan mustasno)
- `.pem`, `.key`, SSH kalitlari
- kod ichidagi Meta tokeni (`EAAG...`), Claude kaliti (`sk-ant-...`), GitHub tokeni (`ghp_...`)
- `SECRET`, `TOKEN`, `PASSWORD` o'zgaruvchisiga berilgan uzun haqiqiy qiymatlar

Yoqish (har bir yangi nusxada bir marta):

```bash
git config core.hooksPath .githooks
```

Bu shunchaki qulaylik emas: Meta tokeni va CRM kaliti qo'lga tushsa, reklama akkauntingiz va mijoz ma'lumotlaringizga kirish ochiladi. `.gitignore` faylni ko'rinmas qiladi, hook esa `git add -f` bilan majburan qo'shishga ham yo'l qo'ymaydi.

Agar hook xato ishga tushsa (masalan test ma'lumoti), bir martalik chetlab o'tish: `git commit --no-verify`. Buni faqat qiymat haqiqatan maxfiy emasligiga ishonch hosil qilgandan keyin qiling.

## Kundalik ish

```bash
git pull                      # oxirgi o'zgarishlarni olish
# ... kod yoziladi ...
git add -A && git commit -m "nima o'zgardi"
git push
```

Commitdan oldin testlarni ishga tushiring: `cd backend && python -m pytest tests -q`

# VPS'ni yangilash

```bash
cd /opt/gsr-jarvis && git pull
backend/venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
sudo systemctl restart gsr-jarvis
```

# Kengaytirish uchun yo'l xarita

- Yangi AI modul: `backend/app/modules/` ga fayl qo'shing, router yarating, `main.py` ga ulang.
- Yangi scheduled vazifa: `backend/app/scheduler.py` (⚠️ publisher'ni import qilmang — xavfsizlik qoidasi).
- **Modelga yangi ustun qo'shsangiz** `main.py` dagi `MIGRATIONS` lug'atiga yozing — `create_all()` faqat yangi jadval yaratadi, mavjud jadvalga ustun qo'shmaydi.
- **Mavsumiy kalendar** har yili yangilanishi kerak: `app/modules/seasons.py` dagi `LUNAR` jadvaliga keyingi yil sanalarini qo'shing (hozir 2026-2028 qamrab olingan). Yil yetishmasa o'sha bayram jimgina tushib qoladi, xato bermaydi.
- Rasm generatsiyasi: `backend/app/modules/imagegen.py` dagi shablon bo'yicha provayder yozing va `.env` da `IMAGE_PROVIDER` ni o'rnating (rasm ochiq URL'da joylashishi shart).
- Kunlik jadval: barcha vaqtlar `Asia/Tashkent` bo'yicha (`.env` `TIMEZONE`).
