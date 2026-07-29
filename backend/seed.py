"""Seed script — populates one example weekly content plan, two demo
competitors and a sample intel report so the dashboard is not empty on
first run.

Usage (from backend/ with the venv active):
    python seed.py            # creates the sample plan
    python seed.py --clear    # removes the previous sample first
"""
import sys
from datetime import date, timedelta

from app.database import Base, SessionLocal, engine
from app.models import Competitor, ContentPost, IntelReport, PostStatus


def week_start_today() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


POSTS = [
    {
        "post_type": "post",
        "pillar": "xizmat tushuntirish (avia vs temir yo'l vs avto)",
        "title": "Avia, temir yo'l yoki avto — qaysi biri sizga?",
        "body": (
            "Xitoydan yuk kelishi 5 kunmi yoki 25 kunmi — farqi nimada?\n\n"
            "GSR Logistics 10 yildan beri uch yo'nalishda ishlaydi:\n"
            "✈️ AVIA — 5-7 kun. Shoshilinch va qimmatbaho yuklar uchun.\n"
            "🚂 TEMIR YO'L — 15-18 kun. Narx va tezlik balansi.\n"
            "🚛 AVTO — 12-15 kun. Moslashuvchan, eshikkacha yetkazish.\n\n"
            "Qaysi biri sizning biznesingizga to'g'ri kelishini bilmaysizmi? "
            "Yukingiz turi va muddatini yozing — 10 daqiqada bepul hisob-kitob beramiz.\n\n"
            "📩 Direct'ga yozing yoki bio'dagi raqamga qo'ng'iroq qiling."
        ),
        "body_ru": (
            "Груз из Китая идёт 5 дней или 25? В чём разница?\n\n"
            "GSR Logistics уже 10 лет работает по трём направлениям:\n"
            "✈️ АВИА — 5-7 дней. Для срочных и дорогих грузов.\n"
            "🚂 Ж/Д — 15-18 дней. Баланс цены и скорости.\n"
            "🚛 АВТО — 12-15 дней. Гибко, с доставкой до двери.\n\n"
            "Не знаете, что подходит вашему бизнесу? Напишите тип груза и сроки — "
            "сделаем бесплатный расчёт за 10 минут.\n\n"
            "📩 Пишите в Direct или звоните по номеру в шапке профиля."
        ),
        "hashtags": "#logistika #xitoydanyuk #cargo #uzbekistan #import #aviacargo #temiryol #avtocargo #gsrlogistics #biznes #marketplace #tashkent",
        "best_time": "Dushanba 19:00",
    },
    {
        "post_type": "carousel",
        "pillar": "rasstamojka / bojxona FAQ",
        "title": "Rasstamojka: 5 ta eng ko'p so'raladigan savol",
        "body": (
            "1-slayd: Rasstamojka — 5 savol, 5 aniq javob 👇\n\n"
            "2-slayd: \"Bojxona to'lovi qancha bo'ladi?\" — Yuk turiga qarab: boj + QQS. "
            "TN VED kodi bo'yicha aniq stavkani biz hisoblab beramiz.\n\n"
            "3-slayd: \"Hujjatlar kimda bo'ladi?\" — Invoys, upakovka listi, CMR/AWB — "
            "hammasini biz tayyorlaymiz, siz faqat yuk ma'lumotini berasiz.\n\n"
            "4-slayd: \"Qancha vaqt ketadi?\" — To'g'ri hujjat bilan 1-3 ish kuni. "
            "Xato hujjat bilan — haftalab. Shuning uchun tajriba muhim.\n\n"
            "5-slayd: \"Sertifikat kerakmi?\" — Ayrim tovarlarga majburiy sertifikat bor. "
            "Buyurtmadan OLDIN biz bilan tekshiring — omborda qolib ketmasin.\n\n"
            "6-slayd: 10 yillik tajriba bilan rasstamojkani biz o'z zimmamizga olamiz. "
            "Savolingizni Direct'ga yozing ✍️"
        ),
        "body_ru": (
            "Слайд 1: Растаможка — 5 вопросов, 5 точных ответов 👇\n\n"
            "Слайд 2: «Сколько составит таможенный платёж?» — Зависит от товара: "
            "пошлина + НДС. Точную ставку по коду ТН ВЭД рассчитаем мы.\n\n"
            "Слайд 3: «Кто занимается документами?» — Инвойс, упаковочный лист, "
            "CMR/AWB — всё готовим мы, от вас только данные по грузу.\n\n"
            "Слайд 4: «Сколько это займёт?» — С правильными документами 1-3 рабочих дня. "
            "С ошибками — недели. Поэтому опыт решает.\n\n"
            "Слайд 5: «Нужен ли сертификат?» — На часть товаров сертификат обязателен. "
            "Проверьте с нами ДО заказа — чтобы груз не застрял на складе.\n\n"
            "Слайд 6: С 10-летним опытом берём растаможку на себя. "
            "Задайте вопрос в Direct ✍️"
        ),
        "hashtags": "#rasstamojka #bojxona #import #logistika #xitoydanyuk #tnved #sertifikat #gsrlogistics #uzbekistan #savdo",
        "best_time": "Chorshanba 12:30",
    },
    {
        "post_type": "reels",
        "pillar": "mijoz keysi",
        "title": "Keys: Guangzhou'dan Toshkentgacha 9 kun",
        "body": (
            "REELS SSENARIY (30-40 soniya):\n\n"
            "Kadr 1 (0-3s): Omborda korobkalar. Overlay: \"Guangzhou → Toshkent: 9 kun. Qanday?\"\n"
            "Kadr 2 (3-10s): Mijoz muammosi — \"Marketplace sotuvchisi, tovar 25 kunda kelardi, "
            "sotuv to'xtab qolardi.\"\n"
            "Kadr 3 (10-20s): Yechim — konsolidatsiya ombori Guangzhou'da, avto-ekspress liniya, "
            "rasstamojka oldindan tayyorlangan hujjatlar bilan.\n"
            "Kadr 4 (20-30s): Natija — \"Endi har 10 kunda yangi partiya. Aylanma 2 barobar oshdi.\"\n"
            "Kadr 5 (30-35s): CTA — \"Sizning yukingiz ham tezroq kelishi mumkin. "
            "Direct'ga 'TEZKOR' deb yozing — liniya jadvalini yuboramiz.\"\n\n"
            "Musiqa: energik, trend. Overlay matnlar yirik, o'qish oson."
        ),
        "body_ru": (
            "СЦЕНАРИЙ REELS (30-40 секунд):\n\n"
            "Кадр 1 (0-3с): Коробки на складе. Оверлей: «Гуанчжоу → Ташкент: 9 дней. Как?»\n"
            "Кадр 2 (3-10с): Проблема клиента — «Продавец на маркетплейсе, товар шёл "
            "25 дней, продажи вставали».\n"
            "Кадр 3 (10-20с): Решение — консолидационный склад в Гуанчжоу, авто-экспресс "
            "линия, документы для растаможки готовятся заранее.\n"
            "Кадр 4 (20-30с): Результат — «Теперь новая партия каждые 10 дней. "
            "Оборот вырос вдвое».\n"
            "Кадр 5 (30-35с): CTA — «Ваш груз тоже может приходить быстрее. "
            "Напишите в Direct слово ЭКСПРЕСС — пришлём расписание линии».\n\n"
            "Музыка: энергичная, трендовая. Текст оверлеев крупный, легко читаемый."
        ),
        "hashtags": "#reels #logistika #keys #marketplace #uzum #xitoydanyuk #cargo #biznes #gsrlogistics #toshkent",
        "best_time": "Payshanba 20:00",
    },
    {
        "post_type": "post",
        "pillar": "narx / tarif yangiliklari",
        "title": "Yangi tariflar: avto-ekspress liniya",
        "body": (
            "📢 Yangilik: avto-ekspress liniyaga yangi tarif!\n\n"
            "Guangzhou / Yiwu → Toshkent:\n"
            "🚛 Avto-ekspress: 12-14 kun — 1 kg uchun raqobatbardosh narx\n"
            "📦 Konsolidatsiya: 1 kg'dan boshlab qabul qilamiz\n"
            "🏭 Ombor xizmati: Xitoyda 10 kungacha BEPUL saqlash\n\n"
            "Narx yuk hajmi va turiga bog'liq — aniq hisob-kitob uchun yuk "
            "ma'lumotlarini yuboring, 10 daqiqada javob beramiz.\n\n"
            "📲 Direct yoki bio'dagi telefon orqali bog'laning."
        ),
        "body_ru": (
            "📢 Новость: новый тариф на авто-экспресс линии!\n\n"
            "Гуанчжоу / Иу → Ташкент:\n"
            "🚛 Авто-экспресс: 12-14 дней — конкурентная цена за кг\n"
            "📦 Консолидация: принимаем от 1 кг\n"
            "🏭 Складская услуга: до 10 дней хранения в Китае БЕСПЛАТНО\n\n"
            "Цена зависит от объёма и типа груза — для точного расчёта пришлите "
            "данные по грузу, ответим за 10 минут.\n\n"
            "📲 Direct или телефон в шапке профиля."
        ),
        "hashtags": "#tarif #narx #avtocargo #logistika #xitoydanyuk #konsolidatsiya #guangzhou #yiwu #gsrlogistics #import",
        "best_time": "Seshanba 11:00",
    },
    {
        "post_type": "post",
        "pillar": "Juma tabrigi",
        "title": "Juma muborak!",
        "body": (
            "Juma muborak bo'lsin! 🤲\n\n"
            "Yangi hafta yangi imkoniyatlar olib kelsin, bizneslaringiz barokali, "
            "yo'llaringiz ochiq bo'lsin.\n\n"
            "GSR Logistics jamoasi sizga xayrli juma tilaydi. "
            "Yuklaringiz doim o'z vaqtida yetib kelsin! 🚛✈️🚂"
        ),
        "body_ru": (
            "Благословенной пятницы! 🤲\n\n"
            "Пусть новая неделя принесёт новые возможности, ваш бизнес будет "
            "в достатке, а дороги — открытыми.\n\n"
            "Команда GSR Logistics желает вам доброй пятницы. "
            "Пусть ваши грузы всегда приходят вовремя! 🚛✈️🚂"
        ),
        "hashtags": "#jumamuborak #juma #gsrlogistics #uzbekistan #logistika",
        "best_time": "Juma 09:00",
    },
]

COMPETITORS = [
    # Placeholder handles — replace with real competitor accounts in the app.
    {"name": "Demo Cargo (namuna)", "platform": "telegram", "handle": "cargo_demo_kanal"},
    {"name": "Demo Express (namuna)", "platform": "instagram", "handle": "cargo_demo_insta"},
]

INTEL_SAMPLE = (
    "NAMUNA HISOBOT (seed ma'lumoti)\n\n"
    "1. Aksiyalar va takliflar: raqobatchilardan biri birinchi jo'natmaga 10% "
    "chegirma e'lon qilgan; yana biri bepul konsolidatsiya taklif qilyapti.\n\n"
    "2. Kontent formatlari: eng ko'p ko'rishlar qisqa video (ombor jarayoni) va "
    "narx-jadval postlarida.\n\n"
    "3. Narx signallari: avia yo'nalishida narxlar pasayish tendensiyasida.\n\n"
    "4. GSR uchun tavsiyalar: ombordan video-kontent boshlash, narx-jadvalni "
    "haftalik yangilab borish, birinchi jo'natma aksiyasini sinab ko'rish.\n\n"
    "Haqiqiy hisobot raqobatchilarni qo'shib, skan qilingandan keyin yaratiladi."
)


def main() -> None:
    Base.metadata.create_all(engine)
    ws = week_start_today()
    with SessionLocal() as db:
        if "--clear" in sys.argv:
            n = db.query(ContentPost).delete()
            db.query(IntelReport).delete()
            db.commit()
            print(f"{n} ta post o'chirildi.")

        existing = db.query(ContentPost).count()
        if existing:
            print(f"DB bo'sh emas ({existing} ta post bor) — seed o'tkazib yuborildi.")
            return

        for item in POSTS:
            db.add(ContentPost(week_start=ws, status=PostStatus.REVIEW, **item))
        if db.query(Competitor).count() == 0:
            for comp in COMPETITORS:
                db.add(Competitor(**comp))
        db.add(
            IntelReport(
                period_start=ws - timedelta(days=7),
                period_end=ws,
                summary=INTEL_SAMPLE,
            )
        )
        db.commit()
    print(f"Seed tayyor: {len(POSTS)} ta post ({ws} haftasi), "
          f"{len(COMPETITORS)} ta namuna raqobatchi, 1 ta namuna hisobot.")


if __name__ == "__main__":
    main()
