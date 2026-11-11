-- LadyS:應收帳款(別人欠我們的錢)。按「已收款」才轉成一筆收入(ladys_expenses.ladys_flow = 'in')
create table if not exists public.ladys_receivables (
  id                   uuid primary key default gen_random_uuid(),
  ladys_party          text not null,
  ladys_amount         numeric(12, 0) not null check (ladys_amount > 0),
  ladys_owner          text not null default 'both' check (ladys_owner in ('husband', 'wife', 'both')),
  ladys_status         text not null default 'open' check (ladys_status in ('open', 'received')),
  ladys_received_at    timestamptz,
  ladys_source         text not null default 'ai' check (ladys_source in ('ai', 'manual')),
  ladys_source_msg_ids bigint[] not null default '{}',
  ladys_deleted        boolean not null default false,
  ladys_created_at     timestamptz not null default now(),
  ladys_updated_at     timestamptz not null default now()
);
create index if not exists ladys_receivables_status_idx on public.ladys_receivables (ladys_status, ladys_created_at desc) where not ladys_deleted;
alter table public.ladys_receivables enable row level security;
revoke all on public.ladys_receivables from anon, authenticated;
