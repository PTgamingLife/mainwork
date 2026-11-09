-- 十神修行錄:AI 整理立誓選項的每日次數上限(每人每天 5 次,由 sg-api 檢查)
alter table public.sg_users add column if not exists sg_ai_date date;
alter table public.sg_users add column if not exists sg_ai_count smallint not null default 0;
