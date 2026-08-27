-- AI Health OS 成熟度健檢 — 填答收集
--
-- 頁面:ai-health-check/index.html(公開,給冷名單與廣告流量填)
-- 存取:anon 只能 INSERT,不能 SELECT —— 填答者看不到別人的答案。
--       讀取一律走 service role(排程腳本、我這邊的彙整)。

create table if not exists public.health_check_responses (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null,
  scores jsonb not null default '{}'::jsonb,
  overall integer check (overall between 0 and 100),
  name text,
  contact text,
  seconds integer check (seconds >= 0),
  source text,                     -- ?src=ig / ?src=ad / ?src=dm,用來分辨來源
  created_at timestamptz not null default now(),
  -- 粗略擋一下亂送:必須是陣列且題數合理
  constraint answers_is_array check (jsonb_typeof(answers) = 'array'),
  constraint answers_len check (jsonb_array_length(answers) between 1 and 30)
);

create index if not exists health_check_created
  on public.health_check_responses(created_at desc);
create index if not exists health_check_source
  on public.health_check_responses(source);

alter table public.health_check_responses enable row level security;

-- anon 只能寫。刻意不建 select/update/delete policy。
drop policy if exists health_check_anon_insert on public.health_check_responses;
create policy health_check_anon_insert
  on public.health_check_responses
  for insert to anon
  with check (true);
