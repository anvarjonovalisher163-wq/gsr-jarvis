-- TG Manager litsenziyalari.
-- Jadvallar faqat service_role (Edge Function) orqali o'qiladi/yoziladi:
-- RLS yoqilgan, anon uchun hech qanday policy yo'q.

create table if not exists public.licenses (
  key           text primary key,
  email         text not null,
  plan          text not null check (plan in ('trial', 'pro', 'agency')),
  max_accounts  integer not null,
  max_bots      integer not null,
  -- null = cheksiz. Trial uchun jami (post + rassilka) xabarlar soni.
  max_messages  integer,
  expires_at    timestamptz not null,
  device_ids    text[] not null default '{}',
  max_devices   integer not null default 1,
  revoked       boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);

-- Bitta qurilma faqat bitta trial oladi.
create table if not exists public.trial_devices (
  device_id    text primary key,
  email        text not null,
  license_key  text not null references public.licenses(key) on delete cascade,
  created_at   timestamptz not null default now()
);

-- Tekshiruvlar jurnali (ixtiyoriy statistika / shubhali faollik uchun).
create table if not exists public.license_checks (
  id           bigserial primary key,
  license_key  text references public.licenses(key) on delete cascade,
  device_id    text not null,
  action       text not null check (action in ('activate', 'check', 'trial')),
  ok           boolean not null,
  error        text,
  app_version  text,
  created_at   timestamptz not null default now()
);
create index if not exists license_checks_key_idx on public.license_checks(license_key, created_at desc);

alter table public.licenses      enable row level security;
alter table public.trial_devices enable row level security;
alter table public.license_checks enable row level security;
-- Policy yo'q → anon/authenticated hech narsa ko'rmaydi. service_role RLS'ni chetlab o'tadi.

-- Pullik kalit yaratish (SQL Editor'da yoki admin skriptda):
--   insert into public.licenses (key, email, plan, max_accounts, max_bots, max_messages, expires_at, max_devices)
--   values ('TGM-PRO-XXXX-XXXX-XXXX', 'mijoz@example.com', 'pro', 10, 5, null, now() + interval '365 days', 2);
--
-- Tariflar (ilovadagi limits.ts bilan bir xil bo'lsin):
--   trial  → 2 akkaunt, 1 bot, 100 xabar, 7 kun
--   pro    → 10 akkaunt, 5 bot, cheksiz xabar
--   agency → cheksiz (ilovada 9999 sifatida saqlanadi)
