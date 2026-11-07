-- LadyS:行程備註 + 家庭群組圖片編號(供「記憶以上圖片」找出一批圖片;只存編號,7 天內刪除,不存圖片)
alter table public.ladys_events add column if not exists ladys_note text not null default '';

create table if not exists public.ladys_images (
  id                bigserial primary key,
  ladys_line_msg_id text not null unique,
  ladys_group_id    text not null,
  ladys_user_uid    text,
  ladys_sent_at     timestamptz not null,
  ladys_done_at     timestamptz
);
create index if not exists ladys_images_group_sent_idx on public.ladys_images (ladys_group_id, ladys_sent_at);
alter table public.ladys_images enable row level security;
revoke all on public.ladys_images from anon, authenticated;

-- 備註變動也要重新同步 Google
create or replace function public.ladys_events_mark_dirty()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.ladys_title, new.ladys_start_at, new.ladys_end_at, new.ladys_all_day, new.ladys_location, new.ladys_owner, new.ladys_recur, new.ladys_note)
     is distinct from
     (old.ladys_title, old.ladys_start_at, old.ladys_end_at, old.ladys_all_day, old.ladys_location, old.ladys_owner, old.ladys_recur, old.ladys_note) then
    new.ladys_gcal_dirty := true;
  end if;
  return new;
end;
$$;
