-- LadyS:拍片行程(主題 / 內文 / 需準備事項)+ 每日拍片提醒;群組指令「拍片主題 xxx」先存成未排日期的主題
create table if not exists public.ladys_shoots (
  id                   uuid primary key default gen_random_uuid(),
  ladys_date           date,              -- null = 只有主題、還沒排日期(「拍片主題」指令)
  ladys_time           text not null default '' check (ladys_time = '' or ladys_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ladys_owner          text not null default 'both' check (ladys_owner in ('husband', 'wife', 'both')),
  ladys_topic          text not null,
  ladys_content        text not null default '',
  ladys_content_ai     boolean not null default false,
  ladys_prep           text not null default '',
  ladys_source         text not null default 'ai' check (ladys_source in ('ai', 'manual')),
  ladys_source_msg_ids bigint[] not null default '{}',
  ladys_deleted        boolean not null default false,
  ladys_created_at     timestamptz not null default now(),
  ladys_updated_at     timestamptz not null default now()
);
create index if not exists ladys_shoots_date_idx on public.ladys_shoots (ladys_date) where not ladys_deleted;
alter table public.ladys_shoots enable row level security;
revoke all on public.ladys_shoots from anon, authenticated;

alter table public.ladys_settings add column if not exists ladys_shoot_enabled boolean not null default true;
alter table public.ladys_settings add column if not exists ladys_shoot_time text not null default '09:00'
  check (ladys_shoot_time ~ '^[0-2][0-9]:[0-5][0-9]$');
alter table public.ladys_settings add column if not exists ladys_shoot_dir_husband text not null default 'LINE 個人 AI 秘書設定與教學';
alter table public.ladys_settings add column if not exists ladys_shoot_dir_wife text not null default '銅鑼浴';

alter table public.ladys_runs drop constraint if exists ladys_runs_ladys_kind_check;
alter table public.ladys_runs add constraint ladys_runs_ladys_kind_check check (ladys_kind in ('nightly', 'morning', 'workout', 'shoot'));

create or replace function public.ladys_tick()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s   public.ladys_settings;
  k   text;
  now_tpe timestamp := (now() at time zone 'Asia/Taipei');
  today date := now_tpe::date;
  hm  text := to_char(now_tpe, 'HH24:MI');
  m   text;
begin
  select * into s from public.ladys_settings where id = 1;
  if s.ladys_group_id is null then return; end if;
  select ladys_token into k from public.ladys_push_auth where id = 1;

  foreach m in array array['morning', 'nightly', 'workout', 'shoot'] loop
    if hm >= (case m when 'morning' then s.ladys_morning_time when 'nightly' then s.ladys_nightly_time
                     when 'workout' then s.ladys_workout_time else s.ladys_shoot_time end)
       and (m <> 'workout' or s.ladys_workout_enabled)
       and (m <> 'shoot' or s.ladys_shoot_enabled)
       and not exists (select 1 from public.ladys_runs r where r.ladys_kind = m and r.ladys_run_date = today) then
      perform net.http_post(
        url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/ladys-' || m,
        headers := jsonb_build_object('content-type', 'application/json', 'x-ladys-key', k),
        body := jsonb_build_object('run_date', today),
        timeout_milliseconds := 120000
      );
    end if;
  end loop;

  delete from public.ladys_messages
   where ladys_processed_at is not null and ladys_processed_at < now() - interval '30 days';
end;
$$;

revoke all on function public.ladys_tick() from public, anon, authenticated;

-- 上線當天若已過提醒時間,不要立刻補推(從隔天開始)
insert into public.ladys_runs (ladys_kind, ladys_run_date, ladys_status, ladys_detail)
select 'shoot', (now() at time zone 'Asia/Taipei')::date, 'skipped', '{"reason":"launched_after_time"}'::jsonb
 where to_char(now() at time zone 'Asia/Taipei', 'HH24:MI') >= '09:00'
on conflict (ladys_kind, ladys_run_date) do nothing;
