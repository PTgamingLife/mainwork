-- LadyS 顧問:GitHub 工作紀錄精簡表 + 問答紀錄
-- ladys_knowledge:每晚 ladys-knowledge-sync 從 GitHub 讀有變動的 repo,用 Haiku 精簡後 upsert
--   project = 一個作品(repo 或 mainwork 子資料夾)、model = 一份 MODEL.md、worklog = 一週工作紀錄
-- ladys_advice_log:一對一「問 xxx」的問答(只有帳號擁有者能問)

create table if not exists public.ladys_knowledge (
  id                bigserial primary key,
  ladys_kind        text not null check (ladys_kind in ('project', 'model', 'worklog')),
  ladys_key         text not null unique,          -- 例:repo:aisec-seat、dir:mainwork/ladys、model:household-finance、week:2026-W47
  ladys_repo        text not null default '',
  ladys_title       text not null default '',
  ladys_summary     text not null default '' check (char_length(ladys_summary) <= 1200),
  ladys_source_sha  text not null default '',      -- 精簡時依據的 commit / 檔案 sha,一樣就不重算
  ladys_pushed_at   timestamptz,                   -- repo 最後推送時間(判斷要不要重算)
  ladys_updated_at  timestamptz not null default now()
);
create index if not exists ladys_knowledge_kind_idx on public.ladys_knowledge (ladys_kind, ladys_updated_at desc);
alter table public.ladys_knowledge enable row level security;
revoke all on public.ladys_knowledge from anon, authenticated;

create table if not exists public.ladys_advice_log (
  id                bigserial primary key,
  ladys_question    text not null check (char_length(ladys_question) <= 1000),
  ladys_answer      text not null default '' check (char_length(ladys_answer) <= 3000),
  ladys_line_msg_id text unique,
  ladys_created_at  timestamptz not null default now()
);
create index if not exists ladys_advice_log_created_idx on public.ladys_advice_log (ladys_created_at desc);
alter table public.ladys_advice_log enable row level security;
revoke all on public.ladys_advice_log from anon, authenticated;

-- 每晚 03:17(台北)同步一次 GitHub;獨立排程,不動 ladys_tick
select cron.unschedule('ladys-knowledge-sync') where exists (select 1 from cron.job where jobname = 'ladys-knowledge-sync');
select cron.schedule('ladys-knowledge-sync', '17 19 * * *', $job$
  select net.http_post(
    url := 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/ladys-knowledge-sync',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-ladys-key', (select ladys_token from public.ladys_push_auth where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$job$);
