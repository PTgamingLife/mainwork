-- LadyS:Google 日曆同步。行程內容一變動就標 dirty,由 ladysGcalSweep() 推到 Google。
alter table public.ladys_events add column if not exists ladys_gcal_dirty boolean not null default false;

create or replace function public.ladys_events_mark_dirty()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.ladys_title, new.ladys_start_at, new.ladys_end_at, new.ladys_all_day, new.ladys_location, new.ladys_owner)
     is distinct from
     (old.ladys_title, old.ladys_start_at, old.ladys_end_at, old.ladys_all_day, old.ladys_location, old.ladys_owner) then
    new.ladys_gcal_dirty := true;
  end if;
  return new;
end;
$$;

drop trigger if exists ladys_events_mark_dirty on public.ladys_events;
create trigger ladys_events_mark_dirty before update on public.ladys_events
  for each row execute function public.ladys_events_mark_dirty();
