-- 工作大腦 (brain) — 隔離於 heart-cards 產品的 public schema 之外
create extension if not exists vector;

create schema if not exists brain;

do $$ begin
  create type brain.category as enum ('knowledge','tool','game','social','business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type brain.work_status as enum ('idea','scripting','producing','reviewing','published','done');
exception when duplicate_object then null; end $$;

-- ① 作品台帳 (所有類型共用)
create table if not exists brain.works (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      brain.category not null,
  tags          text[] not null default '{}',
  platform      text,
  status        brain.work_status not null default 'idea',
  link          text,
  metrics       jsonb not null default '{}',
  notes         text,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  completed_at  timestamptz
);

-- ② 知識庫 (RAG 目標)
create table if not exists brain.knowledge (
  id          uuid primary key default gen_random_uuid(),
  work_id     uuid references brain.works(id) on delete set null,
  categories  brain.category[] not null default '{}',
  type        text,
  title       text,
  content     text not null,
  embedding   vector(1536),
  source_url  text,
  created_at  timestamptz not null default now()
);

-- ③ 審核紀錄
create table if not exists brain.reviews (
  id          uuid primary key default gen_random_uuid(),
  work_id     uuid references brain.works(id) on delete cascade,
  stage       text,
  score       numeric,
  checks      jsonb not null default '{}',
  passed      boolean,
  predicted   jsonb,
  actual      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists knowledge_embedding_hnsw
  on brain.knowledge using hnsw (embedding vector_cosine_ops);
create index if not exists works_category_idx on brain.works (category);
create index if not exists works_status_idx   on brain.works (status);
create index if not exists knowledge_categories_gin on brain.knowledge using gin (categories);
