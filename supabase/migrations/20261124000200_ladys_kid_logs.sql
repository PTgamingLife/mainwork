-- LadyS:小孩每日完成事項(哥哥 / 弟弟),文字紀錄、不打勾。LIFF 待辦頁「👶 小孩每日」分頁 + 晚間整理群組對話自動記
create table if not exists public.ladys_kid_logs (
  id                   uuid primary key default gen_random_uuid(),
  ladys_date           date not null,
  ladys_child          text not null check (ladys_child in ('elder', 'younger')),
  ladys_content        text not null check (char_length(ladys_content) between 1 and 120),
  ladys_source         text not null default 'manual' check (ladys_source in ('ai', 'manual')),
  ladys_source_msg_ids bigint[] not null default '{}',
  ladys_deleted        boolean not null default false,
  ladys_created_at     timestamptz not null default now(),
  ladys_updated_at     timestamptz not null default now()
);
create index if not exists ladys_kid_logs_date_idx on public.ladys_kid_logs (ladys_date desc) where not ladys_deleted;
alter table public.ladys_kid_logs enable row level security;
revoke all on public.ladys_kid_logs from anon, authenticated;
