-- LadyS 家庭生活秘書(LINE 群組 → 每晚 AI 整理行程/支出/瑣事 → 早上推播 + LIFF)
-- 所有表與欄位一律 ladys_ 前綴;只有 Edge Function(service role)能讀寫。

-- 成員:綁定群組裡說過話的人(你、老婆)。LIFF 只放行這張表裡的人。
create table if not exists public.ladys_members (
  ladys_line_uid   text primary key,
  ladys_name       text not null default '成員',
  ladys_emoji      text not null default '🙂',
  ladys_role       text not null default 'husband' check (ladys_role in ('husband', 'wife')),
  ladys_created_at timestamptz not null default now()
);

-- 單一設定列(id = 1)
create table if not exists public.ladys_settings (
  id                    smallint primary key default 1 check (id = 1),
  ladys_group_id        text,
  ladys_persona         text not null default 'butler' check (ladys_persona in ('butler', 'secretary', 'buddy', 'custom')),
  ladys_persona_custom  text not null default '',
  ladys_morning_time    text not null default '07:30' check (ladys_morning_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ladys_nightly_time    text not null default '23:00' check (ladys_nightly_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ladys_push_empty      boolean not null default true,   -- 今天沒行程也推「今天沒有安排」
  ladys_extract_events   boolean not null default true,
  ladys_extract_expenses boolean not null default true,
  ladys_extract_notes    boolean not null default true,
  ladys_gcal_enabled    boolean not null default false,
  ladys_gcal_calendar_id text,
  ladys_updated_at      timestamptz not null default now()
);
insert into public.ladys_settings (id) values (1) on conflict (id) do nothing;

-- 原始群組訊息:webhook 收到就存;晚上整理後標 processed,30 天後刪
create table if not exists public.ladys_messages (
  id                 bigserial primary key,
  ladys_line_msg_id  text not null unique,
  ladys_group_id     text not null,
  ladys_user_uid     text,
  ladys_text         text not null,
  ladys_sent_at      timestamptz not null,
  ladys_processed_at timestamptz,
  ladys_created_at   timestamptz not null default now()
);
create index if not exists ladys_messages_pending_idx on public.ladys_messages (ladys_sent_at) where ladys_processed_at is null;

create table if not exists public.ladys_events (
  id                  uuid primary key default gen_random_uuid(),
  ladys_title         text not null,
  ladys_start_at      timestamptz not null,
  ladys_end_at        timestamptz,
  ladys_all_day       boolean not null default false,
  ladys_location      text not null default '',
  ladys_owner         text not null default 'both' check (ladys_owner in ('husband', 'wife', 'both')),
  ladys_source        text not null default 'ai' check (ladys_source in ('ai', 'manual')),
  ladys_source_msg_ids bigint[] not null default '{}',
  ladys_gcal_event_id text,
  ladys_deleted       boolean not null default false,
  ladys_created_at    timestamptz not null default now(),
  ladys_updated_at    timestamptz not null default now()
);
create index if not exists ladys_events_start_idx on public.ladys_events (ladys_start_at) where not ladys_deleted;

create table if not exists public.ladys_expenses (
  id                  uuid primary key default gen_random_uuid(),
  ladys_date          date not null,
  ladys_amount        numeric(12, 0) not null check (ladys_amount >= 0),
  ladys_category      text not null default '其他',
  ladys_payer         text not null default 'both' check (ladys_payer in ('husband', 'wife', 'both')),
  ladys_note          text not null default '',
  ladys_source        text not null default 'ai' check (ladys_source in ('ai', 'manual')),
  ladys_source_msg_ids bigint[] not null default '{}',
  ladys_deleted       boolean not null default false,
  ladys_created_at    timestamptz not null default now(),
  ladys_updated_at    timestamptz not null default now()
);
create index if not exists ladys_expenses_date_idx on public.ladys_expenses (ladys_date) where not ladys_deleted;

create table if not exists public.ladys_notes (
  id                  uuid primary key default gen_random_uuid(),
  ladys_content       text not null,
  ladys_kind          text not null default 'todo' check (ladys_kind in ('todo', 'shopping', 'memo')),
  ladys_owner         text not null default 'both' check (ladys_owner in ('husband', 'wife', 'both')),
  ladys_done          boolean not null default false,
  ladys_source        text not null default 'ai' check (ladys_source in ('ai', 'manual')),
  ladys_source_msg_ids bigint[] not null default '{}',
  ladys_deleted       boolean not null default false,
  ladys_created_at    timestamptz not null default now(),
  ladys_updated_at    timestamptz not null default now()
);

-- 每次排程執行紀錄;(kind, 台北日期) 唯一 → 同一天不會重複推播/整理
create table if not exists public.ladys_runs (
  id             bigserial primary key,
  ladys_kind     text not null check (ladys_kind in ('nightly', 'morning')),
  ladys_run_date date not null,
  ladys_status   text not null default 'started',
  ladys_detail   jsonb not null default '{}',
  ladys_created_at timestamptz not null default now(),
  unique (ladys_kind, ladys_run_date)
);

-- pg_cron 呼叫 Edge Function 用的金鑰
create table if not exists public.ladys_push_auth (
  id               smallint primary key default 1 check (id = 1),
  ladys_token      text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  ladys_created_at timestamptz not null default now()
);
insert into public.ladys_push_auth (id) values (1) on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['ladys_members','ladys_settings','ladys_messages','ladys_events',
                           'ladys_expenses','ladys_notes','ladys_runs','ladys_push_auth'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 每 5 分鐘跑一次:到了設定的時間、今天還沒跑過,才呼叫 Edge Function。
-- 排程不在這支 migration 裡,LINE 憑證設定好才下:
--   select cron.schedule('ladys-tick', '*/5 * * * *', $$select public.ladys_tick()$$);
create or replace function public.ladys_tick()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s   public.ladys_settings;
  k   text;
  now_tpe timestamp := (now() at time zone 'Asia/Taipei');
  today date := now_tpe::date;
  hm  text := to_char(now_tpe, 'HH24:MI');
  m   text;
begin
  select * into s from public.ladys_settings where id = 1;
  if s.ladys_group_id is null then return; end if;
  select ladys_token into k from public.ladys_push_auth where id = 1;

  foreach m in array array['morning', 'nightly'] loop
    if hm >= (case m when 'morning' then s.ladys_morning_time else s.ladys_nightly_time end)
       and not exists (select 1 from public.ladys_runs r where r.ladys_kind = m and r.ladys_run_date = today) then
      perform net.http_post(
        url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/ladys-' || m,
        headers := jsonb_build_object('content-type', 'application/json', 'x-ladys-key', k),
        body := jsonb_build_object('run_date', today),
        timeout_milliseconds := 120000
      );
    end if;
  end loop;

  -- 已整理的原始訊息保留 30 天
  delete from public.ladys_messages
   where ladys_processed_at is not null and ladys_processed_at < now() - interval '30 days';
end;
$$;

revoke all on function public.ladys_tick() from public, anon, authenticated;
