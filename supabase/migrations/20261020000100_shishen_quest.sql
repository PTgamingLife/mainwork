-- 十神修行錄(sg_)— 資料表、推播金鑰、推播呼叫函式
-- 前端不直接讀寫:所有表開 RLS、不給 anon/authenticated policy;
-- 一律經 Edge Function sg-api(驗 LIFF ID token 後以 service role 寫入)。

create table if not exists public.sg_users (
  sg_id uuid primary key default gen_random_uuid(),
  sg_line_uid text unique not null,
  sg_nickname text not null check (char_length(sg_nickname) between 1 and 12),
  sg_birth_date date not null,
  sg_birth_time time,                 -- null = 不知道時辰
  sg_consent_at timestamptz not null, -- 個資同意時間
  sg_push_on boolean not null default true,
  sg_created_at timestamptz not null default now(),
  sg_updated_at timestamptz not null default now()
);

create table if not exists public.sg_charts (
  sg_user_id uuid primary key references public.sg_users(sg_id) on delete cascade,
  sg_pillars jsonb not null,
  sg_scores jsonb not null,           -- 十格先天分數(%)
  sg_yima text[] not null default '{}',
  sg_hour_known boolean not null default true,
  sg_near_jie boolean not null default false,
  sg_updated_at timestamptz not null default now()
);

create table if not exists public.sg_assess (
  sg_user_id uuid primary key references public.sg_users(sg_id) on delete cascade,
  sg_answers jsonb not null,          -- 10 題 1–5 分(只留最新一次)
  sg_taken_at timestamptz not null default now()
);

create table if not exists public.sg_vows (
  sg_id bigint generated always as identity primary key,
  sg_user_id uuid not null references public.sg_users(sg_id) on delete cascade,
  sg_kind text not null check (sg_kind in ('precept', 'bond', 'oath')),
  sg_god text,
  sg_mode text,
  sg_text text not null check (char_length(sg_text) <= 120),
  sg_start date not null,
  sg_end date,
  sg_pct smallint not null default 0 check (sg_pct between 0 and 100),
  sg_status text not null default 'active' check (sg_status in ('active', 'renewed')),
  unique (sg_user_id, sg_kind, sg_start)
);

create table if not exists public.sg_checkins (
  sg_user_id uuid not null references public.sg_users(sg_id) on delete cascade,
  sg_date date not null,
  sg_precept_ok boolean not null default false,
  sg_bond_ok boolean not null default false,
  sg_oath_pct smallint not null default 0 check (sg_oath_pct between 0 and 100),
  sg_note text check (char_length(sg_note) <= 60),
  sg_amulet boolean not null default false, -- 護符補上的日子
  sg_at timestamptz not null default now(),
  primary key (sg_user_id, sg_date)
);

-- 護符數量跟著使用者
alter table public.sg_users add column if not exists sg_amulets smallint not null default 0;

create index if not exists sg_checkins_date_idx on public.sg_checkins (sg_date);
create index if not exists sg_vows_active_idx on public.sg_vows (sg_user_id) where sg_status = 'active';

alter table public.sg_users enable row level security;
alter table public.sg_charts enable row level security;
alter table public.sg_assess enable row level security;
alter table public.sg_vows enable row level security;
alter table public.sg_checkins enable row level security;
revoke all on public.sg_users, public.sg_charts, public.sg_assess, public.sg_vows, public.sg_checkins from anon, authenticated;

-- 推播金鑰:pg_cron 呼叫 sg-push 時帶 x-sg-key,sg-push 比對這張表
create table if not exists public.sg_push_auth (
  id smallint primary key default 1 check (id = 1),
  token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
insert into public.sg_push_auth (id) values (1) on conflict (id) do nothing;
alter table public.sg_push_auth enable row level security;
revoke all on public.sg_push_auth from anon, authenticated;

-- 呼叫 sg-push。排程不在這支 migration 裡,等 LINE 憑證設定好才下:
--   select cron.schedule('sg-push-morning', '30 23 * * *', $$select public.sg_push_call('morning')$$); -- 台北 07:30
--   select cron.schedule('sg-push-evening', '0 13 * * *',  $$select public.sg_push_call('evening')$$); -- 台北 21:00
create or replace function public.sg_push_call(p_mode text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text;
begin
  if p_mode not in ('morning', 'evening') then
    raise exception 'sg_push_call: bad mode %', p_mode;
  end if;
  select token into k from public.sg_push_auth where id = 1;
  perform net.http_post(
    url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/sg-push',
    headers := jsonb_build_object('content-type', 'application/json', 'x-sg-key', k),
    body := jsonb_build_object('mode', p_mode),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.sg_push_call(text) from public, anon, authenticated;
