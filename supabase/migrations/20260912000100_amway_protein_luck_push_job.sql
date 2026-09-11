-- 刮刮樂卡的一次性推播(台北 9/12 12:00 = UTC 04:00)。
-- 跟 amp_wish_push_once() 同一套:發完自己 unschedule,不會發第二次。
--
-- 排程本身不在這支 migration 裡,要發那天才下:
--   select cron.schedule('amp-luck-push', '0 4 12 9 *', 'select public.amp_luck_push_once()');
create or replace function public.amp_luck_push_once()
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
    url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/amp-luck-push',
    headers := jsonb_build_object('content-type', 'application/json', 'x-amp-key', k),
    body := '{}'::jsonb
  );

  if exists (select 1 from cron.job where jobname = 'amp-luck-push') then
    perform cron.unschedule('amp-luck-push');
  end if;
end;
$$;

revoke all on function public.amp_luck_push_once() from anon, authenticated;
