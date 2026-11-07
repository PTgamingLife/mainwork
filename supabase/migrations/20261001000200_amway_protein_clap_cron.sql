-- 掌聲結算的一次性排程函式(台北 2026-10-01 21:00 = UTC 13:00)。
--
-- 跟刮刮樂、爬梯子同一套:函式打 edge function,打完自己 unschedule,只會跑一次。
-- 用 pg_cron 不用 GitHub Actions —— GitHub 的 schedule 曾經把 17:00 的工作延到 21:32,
-- pg_cron 在 Supabase 內部跑,21:00 就是 21:00。
--
-- timeout 給 30 秒:預設 5 秒不夠,2026-09-12 刮刮樂那次就是 5 秒逾時沒送出。
--
-- 排程本身用 cron.schedule 另外下,不寫在這裡 —— 時間是一次性的,
-- 寫進 migration 之後重跑會排到已經過去的時間。

create or replace function public.amp_clap_digest_once()
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  k text;
begin
  select token into k from public.amp_push_auth where id = 1;

  perform net.http_post(
    url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/amp-clap-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-amp-key', k),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  -- 發完就把自己取消掉,不會明天同一時間又跑一次
  if exists (select 1 from cron.job where jobname = 'amp-clap-digest') then
    perform cron.unschedule('amp-clap-digest');
  end if;
end;
$$;

revoke all on function public.amp_clap_digest_once() from public, anon, authenticated;
