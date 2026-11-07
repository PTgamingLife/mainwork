-- LadyS:記帳加入收入(同一張表,ladys_flow 區分 out=支出 / in=收入;舊資料全部視為支出)
alter table public.ladys_expenses add column if not exists ladys_flow text not null default 'out'
  check (ladys_flow in ('out', 'in'));
create index if not exists ladys_expenses_flow_date_idx on public.ladys_expenses (ladys_flow, ladys_date) where not ladys_deleted;
