-- B-roll 素材庫:記錄每段生成過的 B-roll(prompt / 成本 / 標籤),
-- 讓 auto_edit.py 在排 B-roll 計畫時先找既有素材,找得到就不再生成。
--
-- 安全模型:兩張表都開 RLS 且「不建任何 policy」→ anon / authenticated 完全讀不到,
-- 只有 service_role(scripts 用的金鑰)能存取。素材路徑與成本不該對外公開。

create extension if not exists pg_trgm;

-- ── 素材本體 ────────────────────────────────────────────────────────────────
create table if not exists public.broll_assets (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- 檔案位置(本機為主;storage_path 保留給日後搬上 Supabase Storage)
  file_path     text not null,
  storage_path  text,
  sha256        text unique,

  -- 來源與成本
  source        text not null default 'higgsfield'
                check (source in ('higgsfield', 'stock', 'self', 'other')),
  provider      text,
  model         text,
  cost_usd      numeric(10, 4) not null default 0,

  -- 語意(比對重用時看這兩欄 + tags)
  prompt        text not null,
  intent        text,                      -- 中文:這段畫面要表達什麼
  tags          text[] not null default '{}',
  style         text,                      -- 對應風格庫的 key

  -- 規格
  duration_sec  numeric(6, 2),
  width         int,
  height        int,
  orientation   text generated always as (
                  case
                    when width is null or height is null then null
                    when height >= width then 'vertical'
                    else 'horizontal'
                  end) stored,

  -- 使用紀錄
  rating        smallint check (rating between 1 and 5),
  use_count     int not null default 0,
  last_used_at  timestamptz,
  notes         text
);

create index if not exists broll_assets_tags_idx    on public.broll_assets using gin (tags);
create index if not exists broll_assets_intent_idx  on public.broll_assets using gin (intent gin_trgm_ops);
create index if not exists broll_assets_prompt_idx  on public.broll_assets using gin (prompt gin_trgm_ops);

alter table public.broll_assets enable row level security;

-- ── 使用紀錄:哪支影片、在第幾秒用了哪段素材 ─────────────────────────────
create table if not exists public.broll_usages (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.broll_assets(id) on delete cascade,
  video_slug text not null,                -- 影片識別(檔名或專案代號)
  start_sec  numeric(8, 2),
  end_sec    numeric(8, 2),
  used_at    timestamptz not null default now(),
  unique (asset_id, video_slug, start_sec)
);

create index if not exists broll_usages_asset_idx on public.broll_usages (asset_id);
create index if not exists broll_usages_video_idx on public.broll_usages (video_slug);

alter table public.broll_usages enable row level security;

-- 用過就回寫 use_count / last_used_at,供搜尋時做「避免重複用同一段」的降權
create or replace function public.broll_bump_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.broll_assets
     set use_count = use_count + 1,
         last_used_at = new.used_at
   where id = new.asset_id;
  return new;
end;
$$;

drop trigger if exists broll_usages_bump on public.broll_usages;
create trigger broll_usages_bump
  after insert on public.broll_usages
  for each row execute function public.broll_bump_usage();

-- ── 搜尋:回傳可重用的素材,分數高者優先 ─────────────────────────────────
-- 分數 = 語意相似度(intent / prompt 取高者)
--        + 標籤重疊比例 * 0.35
--        - 使用次數 * 0.02(同一段用太多次會膩,輕度降權)
create or replace function public.broll_search(
  q               text,
  want_tags       text[] default '{}',
  want_orientation text default null,
  min_sim         real   default 0.10,
  max_rows        int    default 5
)
returns table (
  id           uuid,
  file_path    text,
  prompt       text,
  intent       text,
  tags         text[],
  style        text,
  duration_sec numeric,
  orientation  text,
  use_count    int,
  score        real
)
language sql
stable
security invoker
set search_path = public
as $$
  with scored as (
    select a.id, a.file_path, a.prompt, a.intent, a.tags, a.style,
           a.duration_sec, a.orientation, a.use_count,
           (
             greatest(
               similarity(coalesce(a.intent, ''), q),
               similarity(a.prompt, q)
             )
             + case
                 when cardinality(want_tags) = 0 then 0
                 else 0.35 * (
                   cardinality(array(select unnest(a.tags) intersect select unnest(want_tags)))::real
                   / cardinality(want_tags)::real)
               end
             - 0.02 * a.use_count
           )::real as score
      from public.broll_assets a
     where want_orientation is null
        or a.orientation is null
        or a.orientation = want_orientation
  )
  select * from scored
   where score >= min_sim
   order by score desc
   limit greatest(max_rows, 1);
$$;
