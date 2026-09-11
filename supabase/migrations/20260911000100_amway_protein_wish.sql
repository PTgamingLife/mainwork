-- 安麗蛋白素挑戰 — 臨時任務「你希望誰變健康?」
--
-- 一次性的限時任務:中午 12:00 全員收到一張卡片,點進半頁 App 填一個人名,+3 分。
-- 整輪只能領一次 —— 由 partial unique index 保證,不是只靠前端擋。
--
-- 這支只加東西,不動既有資料:既有的 amp_actions 完全不受影響。

-- ---------- 1. 新的行動類型 wish ----------
alter table public.amp_actions
  drop constraint if exists amp_actions_action_type_check;
alter table public.amp_actions
  add constraint amp_actions_action_type_check
  check (action_type in ('eat', 'refer', 'share', 'quiz', 'wish'));

-- wish 跟 refer / share 一樣必須填對方名字(整個任務的重點就是那個名字)
alter table public.amp_actions
  drop constraint if exists amp_actions_target_required;
alter table public.amp_actions
  add constraint amp_actions_target_required
  check (
    action_type not in ('refer', 'share', 'wish')
    or length(btrim(target_name)) > 0
  );

-- 整輪一人一次。用 partial unique index,重複送出會撞 23505,
-- edge function 既有的 DUPLICATE 判斷直接就接得住。
create unique index if not exists amp_actions_one_wish_per_round
  on public.amp_actions (round_id, member_id)
  where action_type = 'wish';

-- ---------- 2. 排行榜 view 補一欄 ----------
-- total_points 本來就是 sum(points),不改也會把 wish 的 3 分算進去;
-- 補 wish_count 只是為了跟其他四項的欄位對齊,之後要看有多少人完成很方便。
drop view if exists public.amp_leaderboard;
create view public.amp_leaderboard as
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
  coalesce(s.wish_count, 0) as wish_count,
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
    count(*) filter (where a.action_type = 'wish') as wish_count,
    count(distinct a.action_date) as active_days,
    min(a.created_at) as first_at
  from public.amp_actions a
  where a.round_id = r.id and a.member_id = m.id
) s on true
where m.is_active;

revoke all on public.amp_leaderboard from anon, authenticated;

-- ---------- 3. 給資料庫自己的一把鑰匙 ----------
-- 12:00 的推播由 pg_cron 觸發(GitHub Actions 的排程昨天延遲了 4.5 小時,不能用)。
-- pg_cron 要呼叫 edge function,但 AMP_DIGEST_KEY 只存在 Supabase Edge Secrets 裡,
-- 資料庫讀不到。所以另外發一把只給資料庫用的 token,值不離開這張表。
create table if not exists public.amp_push_auth (
  id smallint primary key default 1 check (id = 1),
  token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
insert into public.amp_push_auth (id) values (1) on conflict (id) do nothing;

alter table public.amp_push_auth enable row level security;
revoke all on public.amp_push_auth from anon, authenticated;
