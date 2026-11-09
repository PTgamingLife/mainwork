-- LadyS:瑣事改為「目標 goal / 待辦 todo」兩類(舊的 shopping、memo 保留相容)
alter table public.ladys_notes drop constraint if exists ladys_notes_ladys_kind_check;
alter table public.ladys_notes add constraint ladys_notes_ladys_kind_check
  check (ladys_kind in ('goal', 'todo', 'shopping', 'memo'));
