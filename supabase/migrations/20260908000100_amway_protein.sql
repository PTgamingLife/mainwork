-- 安麗蛋白素推薦比賽 — LINE OA 的資料層
--
-- 專案:hhcubvixldieuwdeqnwc(與 sprint28-challenge 共用,故所有表名加 amp_ 前綴)
-- 存取模式:只允許 service role(amp-api / amp-line / amp-poke-digest 三支 Edge Function)。
--   RLS 全開但不建任何 policy —— 沿用 20260823000100_cofounder_line.sql 的前例。
-- 日期一律以 Asia/Taipei 由呼叫端算好傳入,資料庫不做時區換算。

-- ---------- 賽季(7 天一輪,同時間只允許一輪 active) ----------
create table if not exists public.amp_rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null default '安麗蛋白素 7 天挑戰',
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint amp_rounds_date_order check (end_date >= start_date)
);

-- 部分唯一索引 = 「最多一輪 is_active」的硬性保證,開新輪次前必須先關掉舊的。
create unique index if not exists amp_rounds_single_active
  on public.amp_rounds ((is_active)) where is_active;

-- ---------- 夥伴(第一次開 LIFF 或加好友時建立) ----------
create table if not exists public.amp_members (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  display_name text not null default '',
  avatar_url text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 加分行為 ----------
-- 規則(使用者確認):不設每日上限,但 refer / share 必須填對方名字。
-- eat=1 / share=3 / refer=5 / quiz=1,points 由 Edge Function 決定,資料庫只擋不合法值。
create table if not exists public.amp_actions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.amp_rounds(id) on delete cascade,
  member_id uuid not null references public.amp_members(id) on delete cascade,
  action_date date not null,
  action_type text not null check (action_type in ('eat', 'refer', 'share', 'quiz')),
  points integer not null check (points between 1 and 5),
  target_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  -- 「自律且誠實,騙人胖十斤」的資料庫版本:推薦與分享一定要寫下對方是誰。
  constraint amp_actions_target_required check (
    action_type not in ('refer', 'share') or length(btrim(target_name)) > 0
  )
);

create index if not exists amp_actions_round_member on public.amp_actions (round_id, member_id);
create index if not exists amp_actions_round_date on public.amp_actions (round_id, action_date);

-- ---------- 每日問答題庫 ----------
create table if not exists public.amp_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  seq integer not null unique,
  question text not null,
  options jsonb not null,
  answer_index integer not null check (answer_index between 0 and 3),
  explanation text not null default '',
  is_active boolean not null default true
);

-- ---------- 作答紀錄(每人每天一題) ----------
create table if not exists public.amp_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.amp_rounds(id) on delete cascade,
  member_id uuid not null references public.amp_members(id) on delete cascade,
  question_id uuid not null references public.amp_quiz_questions(id) on delete restrict,
  quiz_date date not null,
  chosen_index integer not null check (chosen_index between 0 and 3),
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (member_id, quiz_date)
);

-- ---------- 戳一下 ----------
-- 即時不推播;每天台北 17:00 由 amp-poke-digest 彙總前 24 小時後才發一次。
create table if not exists public.amp_pokes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.amp_rounds(id) on delete cascade,
  from_member_id uuid not null references public.amp_members(id) on delete cascade,
  to_member_id uuid not null references public.amp_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint amp_pokes_not_self check (from_member_id <> to_member_id)
);

create index if not exists amp_pokes_to_created on public.amp_pokes (to_member_id, created_at desc);

-- ---------- 彙總推播紀錄(同日重跑不重送) ----------
create table if not exists public.amp_poke_digest_log (
  digest_date date not null,
  member_id uuid not null references public.amp_members(id) on delete cascade,
  poke_count integer not null default 0,
  sent_at timestamptz not null default now(),
  primary key (digest_date, member_id)
);

-- ---------- 排行榜 ----------
-- 同分時較早開始累積的人排前面(first_at),避免名次每次查詢跳動。
create or replace view public.amp_leaderboard as
select
  r.id as round_id,
  m.id as member_id,
  m.line_user_id,
  m.display_name,
  m.avatar_url,
  coalesce(s.total_points, 0) as total_points,
  coalesce(s.eat_count, 0) as eat_count,
  coalesce(s.refer_count, 0) as refer_count,
  coalesce(s.share_count, 0) as share_count,
  coalesce(s.quiz_count, 0) as quiz_count,
  coalesce(s.active_days, 0) as active_days,
  rank() over (
    partition by r.id
    order by coalesce(s.total_points, 0) desc, coalesce(s.first_at, now()) asc
  ) as rank
from public.amp_rounds r
cross join public.amp_members m
left join lateral (
  select
    sum(a.points) as total_points,
    count(*) filter (where a.action_type = 'eat') as eat_count,
    count(*) filter (where a.action_type = 'refer') as refer_count,
    count(*) filter (where a.action_type = 'share') as share_count,
    count(*) filter (where a.action_type = 'quiz') as quiz_count,
    count(distinct a.action_date) as active_days,
    min(a.created_at) as first_at
  from public.amp_actions a
  where a.round_id = r.id and a.member_id = m.id
) s on true
where m.is_active;

-- ---------- 權限 ----------
alter table public.amp_rounds enable row level security;
alter table public.amp_members enable row level security;
alter table public.amp_actions enable row level security;
alter table public.amp_quiz_questions enable row level security;
alter table public.amp_quiz_answers enable row level security;
alter table public.amp_pokes enable row level security;
alter table public.amp_poke_digest_log enable row level security;

-- 不建任何 policy = anon / authenticated 讀不到任何一列,只有 service role 進得來。
-- view 以 owner 權限執行,會繞過 RLS,所以直接把 API 角色的權限收掉。
revoke all on public.amp_leaderboard from anon, authenticated;
