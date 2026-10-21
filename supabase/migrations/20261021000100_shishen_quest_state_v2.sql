-- 十神修行錄 v2:遊戲狀態整份存在 sg_users.sg_state(jsonb)
-- v1 的 sg_charts / sg_assess / sg_vows / sg_checkins 已不再使用(皆 0 筆);
-- 刪除屬破壞性操作,待使用者在 Supabase 確認後另行執行:
--   drop table public.sg_checkins, public.sg_vows, public.sg_assess, public.sg_charts;
--   alter table public.sg_users drop column sg_amulets;

alter table public.sg_users add column if not exists sg_state jsonb;
