-- LadyS:工作群組(只記錄、不說話)+ 待確認區
-- 工作群的對話每晚整理成「待確認項目」,在家庭群組按 ✅ 加入才寫進行程 / 待辦 / 支出;7 天沒按自動作廢
alter table public.ladys_settings add column if not exists ladys_work_group_ids text[] not null default '{}';

create table if not exists public.ladys_pending (
  id               uuid primary key default gen_random_uuid(),
  ladys_batch      uuid not null,
  ladys_kind       text not null check (ladys_kind in ('event', 'todo', 'expense')),
  ladys_payload    jsonb not null,
  ladys_group_id   text not null,
  ladys_status     text not null default 'pending' check (ladys_status in ('pending', 'added', 'skipped', 'expired')),
  ladys_created_at timestamptz not null default now()
);
create index if not exists ladys_pending_status_idx on public.ladys_pending (ladys_status, ladys_created_at);
alter table public.ladys_pending enable row level security;
revoke all on public.ladys_pending from anon, authenticated;
