-- 十神修行錄 — Supabase 資料表草稿(尚未套用;套用前需使用者同意)
-- 所有表/欄位以 sg_ 為前綴。寫入一律經 Edge Function(驗證 LINE ID token 後以 service role 寫入)。

create table if not exists sg_users (
  sg_id uuid primary key default gen_random_uuid(),
  sg_line_uid text unique not null,
  sg_nickname text not null check (char_length(sg_nickname) between 1 and 12),
  sg_birth_date date not null,
  sg_birth_time time,                 -- null = 不知道時辰
  sg_consent_at timestamptz not null, -- 個資同意時間
  sg_created_at timestamptz not null default now()
);

create table if not exists sg_charts (
  sg_user_id uuid primary key references sg_users(sg_id) on delete cascade,
  sg_pillars jsonb not null,
  sg_scores jsonb not null,           -- 十格先天分數(%)
  sg_yima text[] not null default '{}',
  sg_updated_at timestamptz not null default now()
);

create table if not exists sg_assess (
  sg_id bigint generated always as identity primary key,
  sg_user_id uuid not null references sg_users(sg_id) on delete cascade,
  sg_answers jsonb not null,          -- 10 題 1–5 分
  sg_taken_at timestamptz not null default now()
);

create table if not exists sg_vows (
  sg_id bigint generated always as identity primary key,
  sg_user_id uuid not null references sg_users(sg_id) on delete cascade,
  sg_kind text not null check (sg_kind in ('precept', 'bond', 'oath')),
  sg_god text,
  sg_text text not null check (char_length(sg_text) <= 120),
  sg_start date not null,
  sg_end date,
  sg_status text not null default 'active' check (sg_status in ('active', 'done', 'failed', 'renewed'))
);

create table if not exists sg_checkins (
  sg_user_id uuid not null references sg_users(sg_id) on delete cascade,
  sg_date date not null,
  sg_precept_ok boolean not null default false,
  sg_bond_ok boolean not null default false,
  sg_oath_pct smallint not null default 0 check (sg_oath_pct between 0 and 100),
  sg_note text check (char_length(sg_note) <= 60),
  sg_amulet boolean not null default false, -- 護符補上的日子
  primary key (sg_user_id, sg_date)
);

-- 前端不直接讀寫:全開 RLS、不給 anon 任何 policy
alter table sg_users enable row level security;
alter table sg_charts enable row level security;
alter table sg_assess enable row level security;
alter table sg_vows enable row level security;
alter table sg_checkins enable row level security;

create index if not exists sg_checkins_date_idx on sg_checkins (sg_date);
