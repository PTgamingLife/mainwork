-- LadyS:一對一傳錄音(10 分鐘內)→ 轉逐字稿 → 摘要 + 待辦/行程確認卡
-- 音檔本身不保存;只留逐字稿與摘要。ladys_pending 的 ladys_group_id 對錄音存帳號擁有者的 userId(確認卡發在一對一)
create table if not exists public.ladys_recordings (
  id                 bigserial primary key,
  ladys_line_msg_id  text not null unique,
  ladys_kind         text not null check (ladys_kind in ('audio', 'file')),
  ladys_status       text not null default 'processing' check (ladys_status in ('processing', 'done', 'error', 'rejected')),
  ladys_duration_s   integer,
  ladys_title        text not null default '',
  ladys_transcript   text not null default '' check (char_length(ladys_transcript) <= 20000),
  ladys_summary      text not null default '' check (char_length(ladys_summary) <= 3000),
  ladys_detail       jsonb not null default '{}'::jsonb,
  ladys_created_at   timestamptz not null default now()
);
create index if not exists ladys_recordings_created_idx on public.ladys_recordings (ladys_created_at desc);
alter table public.ladys_recordings enable row level security;
revoke all on public.ladys_recordings from anon, authenticated;
