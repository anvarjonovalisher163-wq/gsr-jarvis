# Litsenziya serveri (Supabase)

Ilova `activate` va `check` Edge Function'lariga murojaat qiladi. Ma'lumotlar `licenses` jadvalida,
javoblar Ed25519 bilan imzolanadi — ilova faqat ochiq kalit bilan tekshiradi.

## Bir martalik sozlash

1. https://supabase.com da loyiha oching. Settings → API dan **Project URL** va **anon key** ni oling.
2. Supabase CLI o'rnating: https://supabase.com/docs/guides/cli

```bash
npm install -g supabase
```

```bash
supabase login
```

```bash
supabase link --project-ref <PROJECT_REF>
```

3. Jadvallarni yarating:

```bash
supabase db push
```

4. Imzo kalitlarini yarating va secret qiling (buyruq chiqishini bajaring):

```bash
node scripts/gen-license-keys.mjs
```

5. Funksiyalarni deploy qiling:

```bash
supabase functions deploy activate
```

```bash
supabase functions deploy check
```

6. Ilova `.env` fayli (`.env.example` dan nusxa):

```
MAIN_VITE_SUPABASE_URL=https://xxxx.supabase.co
MAIN_VITE_SUPABASE_ANON_KEY=eyJ...
MAIN_VITE_LICENSE_PUBLIC_KEY=<gen-license-keys chiqargan ochiq kalit>
```

`service_role` kaliti **hech qachon** ilovaga qo'yilmaydi — u faqat Edge Function ichida
(`SUPABASE_SERVICE_ROLE_KEY` Supabase tomonidan avtomatik beriladi).

## Pullik kalit berish

SQL Editor'da:

```sql
insert into public.licenses (key, email, plan, max_accounts, max_bots, max_messages, expires_at, max_devices)
values ('TGM-PRO-AB12-CD34-EF56', 'mijoz@example.com', 'pro', 10, 5, null, now() + interval '365 days', 2);
```

Agency: `plan = 'agency', max_accounts = 9999, max_bots = 9999, max_messages = null`.

Bekor qilish: `update public.licenses set revoked = true where key = '...';` — ilova keyingi
kunlik tekshiruvda (yoki 3 kun oflayn muddat tugaganda) faqat ko'rish rejimiga o'tadi.

Uzaytirish: `update public.licenses set expires_at = expires_at + interval '365 days' where key = '...';`

Qurilmani bo'shatish: `update public.licenses set device_ids = '{}' where key = '...';`

## Ilova tomonidagi qoidalar

- Birinchi ochilishda email so'raladi → 7 kunlik trial (qurilma bo'yicha bitta marta).
- Kuniga bir marta `check`; internet bo'lmasa oxirgi imzolangan holat **3 kungacha** amal qiladi.
- Muddat tugasa yoki bekor qilinsa: faqat ko'rish, yangi akkaunt/bot/post/rassilka bloklanadi.
- Imzo yoki `device_id` mos kelmasa holat rad etiladi (fayl tahrirlash foyda bermaydi).
