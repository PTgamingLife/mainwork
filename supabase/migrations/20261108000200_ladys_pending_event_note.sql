-- LadyS:待確認區新增 event_note(補充行程備註的確認卡)
alter table public.ladys_pending drop constraint if exists ladys_pending_ladys_kind_check;
alter table public.ladys_pending add constraint ladys_pending_ladys_kind_check
  check (ladys_kind in ('event', 'todo', 'expense', 'event_note'));
