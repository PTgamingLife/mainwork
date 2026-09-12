-- 小遊戲紀錄。目前只有爬梯子(鬼腳圖),但欄位留 game 讓之後的小遊戲共用同一張表,
-- 不要每加一個遊戲就多一張表。
--
-- 這類遊戲不加分,所以不寫進 amp_actions —— 那張表的每一列都是分數,
-- 混進不加分的東西會讓排行榜的計算變得要處處排除。
create table if not exists public.amp_plays (
  id uuid primary key default extensions.uuid_generate_v4(),
  round_id uuid not null references public.amp_rounds(id) on delete cascade,
  member_id uuid not null references public.amp_members(id) on delete cascade,
  game text not null check (game in ('ladder')),
  play_date date not null,
  result text not null check (length(btrim(result)) > 0),
  created_at timestamptz not null default now(),
  -- 一天一次由資料庫保證,不是只靠前端擋(換手機、清快取都重玩不了)
  constraint amp_plays_once_per_day unique (member_id, game, play_date)
);

create index if not exists amp_plays_round_game_date
  on public.amp_plays (round_id, game, play_date);

alter table public.amp_plays enable row level security;
revoke all on public.amp_plays from anon, authenticated;
