-- 12:00 的一次性推播。排程本身不在這支 migration 裡 —— 這支只定義「怎麼發」,
-- 真的要發那天才下:
--   select cron.schedule('amp-wish-push', '0 4 11 9 *', 'select public.amp_wish_push_once()');
--   (0 4 = UTC 04:00 = 台北 12:00)
--
-- 為什麼用 pg_cron 不用 GitHub Actions:GitHub 的 schedule 會延遲,
-- 9/9 那班排 17:00 的實際 21:32 才跑。這個任務是「中午 12 點」,延遲就沒意義了。
create or replace function public.amp_wish_push_once()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text;
begin
  select token into k from public.amp_push_auth where id = 1;

  -- pg_net 預設 5 秒就斷線,冷啟動 + broadcast 常常不夠。
  -- 斷線不代表函式沒跑完,但回應拿不到就看不出成敗,所以拉長到 30 秒。
  perform net.http_post(
    url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/amp-wish-push',
    headers := jsonb_build_object('content-type', 'application/json', 'x-amp-key', k),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  -- 一次性任務:發完就把自己的排程拿掉,絕不會發第二次。
  -- 排程不存在時 cron.unschedule 會丟錯,所以先確認有沒有。
  if exists (select 1 from cron.job where jobname = 'amp-wish-push') then
    perform cron.unschedule('amp-wish-push');
  end if;
end;
$$;

revoke all on function public.amp_wish_push_once() from anon, authenticated;
