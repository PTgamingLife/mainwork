-- IG 拍攝規劃(igp_)— 每天一集,一人一份
-- 前端用 Supabase Auth(Email 驗證碼/魔術連結)登入,RLS 只讓本人讀寫自己的列。
-- 每集內容整包存在 igp_data(jsonb),欄位定義見 ig-planner/igp-seed.js 的 igpBlankEpisode()。
-- 註:透過 MCP 套用時是逐句執行(含 drop 的語句會卡住),所以這裡不放 drop policy。

create table if not exists public.igp_plan (
  igp_user_id uuid not null,
  igp_date date not null,
  primary key (igp_user_id, igp_date)
);

alter table public.igp_plan enable row level security;
revoke all on public.igp_plan from anon;

alter table public.igp_plan
  add column if not exists igp_data jsonb not null default '{}'::jsonb,
  add column if not exists igp_updated_at timestamptz not null default now();
alter table public.igp_plan
  add constraint igp_plan_data_size check (pg_column_size(igp_data) <= 60000);

create policy igp_plan_own on public.igp_plan for all to authenticated
  using (igp_user_id = (select auth.uid()))
  with check (igp_user_id = (select auth.uid()));

grant select, insert, update, delete on public.igp_plan to authenticated;
