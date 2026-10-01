-- 安麗蛋白素挑戰 — 賽季結算卡的「發出掌聲給前五名」
--
-- 規則(使用者確認):一鍵送給全部五位、整輪只能送一次、不加分(賽季已結束,分數不該再動)。
-- 所以掌聲不進 amp_actions —— 那張表的每一列都是分數。
--
-- 「送給誰」不存:一鍵就是給全部五位,前五名是結算時從 amp_leaderboard 算出來的,
-- 存成五列只是把同一件事寫五次。每位收到的數字 = amp_claps 的總列數。

create table if not exists public.amp_claps (
  id              uuid primary key default extensions.uuid_generate_v4(),
  round_id        uuid not null references public.amp_rounds(id) on delete cascade,
  from_member_id  uuid not null references public.amp_members(id) on delete cascade,
  created_at      timestamptz not null default now(),
  -- 整輪只能一次,由資料庫擋,不是只靠前端
  constraint amp_claps_once_per_round unique (round_id, from_member_id)
);

-- 21:00 的結算推播:先寫這張 log 再推,撞到 primary key 就代表已經送過。
-- 重跑或補發都不會洗版 —— 跟 amp_poke_digest_log 同一套作法。
create table if not exists public.amp_clap_digest_log (
  round_id    uuid not null references public.amp_rounds(id) on delete cascade,
  member_id   uuid not null references public.amp_members(id) on delete cascade,
  clap_count  integer not null default 0,
  sent_at     timestamptz not null default now(),
  primary key (round_id, member_id)
);

alter table public.amp_claps           enable row level security;
alter table public.amp_clap_digest_log enable row level security;
-- 不建任何 policy:這兩張表只走 service role(edge function),前端碰不到。
