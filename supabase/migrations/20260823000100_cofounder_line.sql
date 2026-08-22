-- AI 創業合夥人 — LINE OA 每日問答的資料層
--
-- 專案:wcemkmwrlvijxxwybrgs(與 facialmonitor 共用,故所有表名加 cofounder_ 前綴)
-- 存取模式:只允許 service role(edge function 與排程腳本)。
--   RLS 全開但不建任何 policy —— 沿用 line-translate-bot/supabase/schema.sql 的前例。
-- 日期一律以 Asia/Taipei 計算後由呼叫端傳入,資料庫不做時區換算。

-- ---------- 成員(團隊版的種子;目前只有你一個) ----------
create table if not exists public.cofounder_members (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  display_name text not null default '',
  timezone text not null default 'Asia/Taipei',
  daily_message_limit integer not null default 60 check (daily_message_limit between 1 and 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 狀態(= cofounder/data.json 去掉 daily / revenue) ----------
-- data 內含:meta / north_star / plan / offers / streak / quests / badges / system_prompt
-- system_prompt 由 scripts/cofounder_sync.py 從 MODEL.md + SKILL.md 組出來寫入,
-- 這是「在 Claude Code 改模型 → OA 換腦」的生效路徑。
create table if not exists public.cofounder_state (
  member_id uuid primary key references public.cofounder_members(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  prompt_version text not null default 'cofounder-1.0.0',
  updated_at timestamptz not null default now()
);

-- ---------- 每日 6 個數字 ----------
-- unique(member_id, action_date) 對應 SKILL.md「同日重複回報就覆蓋」的規則,
-- 也沿用 destiny_daily_actions 的 unique(user_id, action_date) 設計。
create table if not exists public.cofounder_daily (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.cofounder_members(id) on delete cascade,
  action_date date not null,
  conversations integer not null default 0 check (conversations >= 0),
  leads integer not null default 0 check (leads >= 0),
  pitches integer not null default 0 check (pitches >= 0),
  deals integer not null default 0 check (deals >= 0),
  revenue numeric(12,2) not null default 0 check (revenue >= 0),
  ai_ratio integer check (ai_ratio between 0 and 100),
  mission text not null default '',
  result text not null default 'pending'
    check (result in ('pending','hit','partial','miss')),
  blocker text not null default ''
    check (blocker in ('','沒時間','沒名單','怕被拒','卡技術','方向錯')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, action_date)
);

-- ---------- 入帳明細(append-only) ----------
create table if not exists public.cofounder_revenue (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.cofounder_members(id) on delete cascade,
  entry_date date not null,
  source text not null default '',
  offer_id text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  client text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists cofounder_revenue_member_date
  on public.cofounder_revenue(member_id, entry_date desc);

-- ---------- 對話歷史(給 LLM 當記憶)+ 冪等 ----------
-- LINE 在收到非 2xx 時會重送,line_event_id 的唯一鍵保證同一則訊息不會被算兩次。
create table if not exists public.cofounder_messages (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.cofounder_members(id) on delete cascade,
  line_event_id text unique,
  role text not null check (role in ('user','assistant')),
  text text not null,
  intent text not null default '',
  model text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists cofounder_messages_member_created
  on public.cofounder_messages(member_id, created_at desc);

-- ---------- 每日呼叫額度(防跑掉燒錢) ----------
create table if not exists public.cofounder_usage (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.cofounder_members(id) on delete cascade,
  usage_date date not null,
  calls integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now(),
  unique (member_id, usage_date)
);

-- 原子遞增並回報是否超額。edge function 在呼叫 LLM 前呼叫這個,
-- 回 false 就直接回覆「今天額度用完」,不進 LLM。
create or replace function public.cofounder_consume_quota(
  p_member_id uuid,
  p_usage_date date
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_calls integer;
begin
  select daily_message_limit into v_limit
    from public.cofounder_members where id = p_member_id;
  if v_limit is null then
    return false;
  end if;

  insert into public.cofounder_usage (member_id, usage_date, calls)
  values (p_member_id, p_usage_date, 1)
  on conflict (member_id, usage_date)
  do update set calls = public.cofounder_usage.calls + 1, updated_at = now()
  returning calls into v_calls;

  return v_calls <= v_limit;
end;
$$;

-- ---------- RLS:全部關起來,只有 service role 進得去 ----------
alter table public.cofounder_members  enable row level security;
alter table public.cofounder_state    enable row level security;
alter table public.cofounder_daily    enable row level security;
alter table public.cofounder_revenue  enable row level security;
alter table public.cofounder_messages enable row level security;
alter table public.cofounder_usage    enable row level security;

revoke all on function public.cofounder_consume_quota(uuid, date) from public, anon, authenticated;
