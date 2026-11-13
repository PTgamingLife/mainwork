-- LadyS:傍晚運動提醒(每天固定時間推兩招雙人運動動畫卡片到家庭群組)
alter table public.ladys_settings add column if not exists ladys_workout_enabled boolean not null default true;
alter table public.ladys_settings add column if not exists ladys_workout_time text not null default '18:00'
  check (ladys_workout_time ~ '^[0-2][0-9]:[0-5][0-9]$');

alter table public.ladys_runs drop constraint if exists ladys_runs_ladys_kind_check;
alter table public.ladys_runs add constraint ladys_runs_ladys_kind_check check (ladys_kind in ('nightly', 'morning', 'workout'));

-- 排程 tick 多一條 workout(到時間、今天還沒跑過才呼叫 ladys-workout)
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

  foreach m in array array['morning', 'nightly', 'workout'] loop
    if hm >= (case m when 'morning' then s.ladys_morning_time when 'nightly' then s.ladys_nightly_time else s.ladys_workout_time end)
       and (m <> 'workout' or s.ladys_workout_enabled)
       and not exists (select 1 from public.ladys_runs r where r.ladys_kind = m and r.ladys_run_date = today) then
      perform net.http_post(
        url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/ladys-' || m,
        headers := jsonb_build_object('content-type', 'application/json', 'x-ladys-key', k),
        body := jsonb_build_object('run_date', today),
        timeout_milliseconds := 120000
      );
    end if;
  end loop;

  -- 已整理的原始訊息保留 30 天
  delete from public.ladys_messages
   where ladys_processed_at is not null and ladys_processed_at < now() - interval '30 days';
end;
$$;

revoke all on function public.ladys_tick() from public, anon, authenticated;
