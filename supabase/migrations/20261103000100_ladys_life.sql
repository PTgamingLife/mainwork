-- LadyS:生活紀錄(經期、身體、生活細節)+ 每年重複的紀念日 + 提醒設定
create table if not exists public.ladys_life (
  id                   uuid primary key default gen_random_uuid(),
  ladys_date           date not null,
  ladys_kind           text not null default 'other' check (ladys_kind in ('period_start', 'period_end', 'health', 'other')),
  ladys_content        text not null default '',
  ladys_owner          text not null default 'both' check (ladys_owner in ('husband', 'wife', 'both')),
  ladys_source         text not null default 'ai' check (ladys_source in ('ai', 'manual')),
  ladys_source_msg_ids bigint[] not null default '{}',
  ladys_deleted        boolean not null default false,
  ladys_created_at     timestamptz not null default now(),
  ladys_updated_at     timestamptz not null default now()
);
create index if not exists ladys_life_date_idx on public.ladys_life (ladys_date) where not ladys_deleted;
alter table public.ladys_life enable row level security;
revoke all on public.ladys_life from anon, authenticated;

-- 行程可設為每年重複(生日、結婚紀念日…);ladys_start_at 存第一次(原始)日期
alter table public.ladys_events add column if not exists ladys_recur text not null default 'none'
  check (ladys_recur in ('none', 'yearly'));

-- 紀念日提前幾天提醒(0 = 當天);經期預測提醒(提前天數、私訊對象)
alter table public.ladys_settings add column if not exists ladys_anniv_remind_days int[] not null default '{7,0}';
alter table public.ladys_settings add column if not exists ladys_period_remind_days int not null default 2;
alter table public.ladys_settings add column if not exists ladys_period_remind_to text not null default 'both'
  check (ladys_period_remind_to in ('wife', 'both', 'off'));

-- 重複行程的內容變動也要重新同步 Google
create or replace function public.ladys_events_mark_dirty()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.ladys_title, new.ladys_start_at, new.ladys_end_at, new.ladys_all_day, new.ladys_location, new.ladys_owner, new.ladys_recur)
     is distinct from
     (old.ladys_title, old.ladys_start_at, old.ladys_end_at, old.ladys_all_day, old.ladys_location, old.ladys_owner, old.ladys_recur) then
    new.ladys_gcal_dirty := true;
  end if;
  return new;
end;
$$;
