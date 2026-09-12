-- 爬梯子卡的一次性推播(台北 9/13 12:05 = UTC 04:05)。
-- 刻意排 12:05 不排 12:00 —— 9/12 那次就是整點三個 cron 擠在一起,
-- PostgREST 回 504,卡片整批沒送出。
--
-- 排程本身不在這支 migration 裡,要發那天才下:
--   select cron.schedule('amp-ladder-push', '5 4 13 9 *', 'select public.amp_ladder_push_once()');
create or replace function public.amp_ladder_push_once()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text;
begin
  select token into k from public.amp_push_auth where id = 1;

  perform net.http_post(
    url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/amp-ladder-push',
    headers := jsonb_build_object('content-type', 'application/json', 'x-amp-key', k),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  if exists (select 1 from cron.job where jobname = 'amp-ladder-push') then
    perform cron.unschedule('amp-ladder-push');
  end if;
end;
$$;

revoke all on function public.amp_ladder_push_once() from anon, authenticated;
