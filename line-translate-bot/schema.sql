-- 群組翻譯目標語言設定(整個群組共用一組)
-- 在 Supabase SQL Editor 執行一次即可。

create table if not exists line_translate_settings (
  group_id    text primary key,
  target_langs jsonb not null default '["越南文","英文"]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Edge Function 用 service_role key 存取,維持 RLS 開啟、不開放匿名讀寫。
alter table line_translate_settings enable row level security;
