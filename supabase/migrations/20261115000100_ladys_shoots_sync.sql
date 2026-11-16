-- LadyS:ladys_shoots 改為「行銷 agent / 剪片 agent / LadyS 秘書」三方共用的拍片進度表(欄位名稱供 /video-sync skill 讀寫)
alter table public.ladys_shoots add column if not exists ladys_status text not null default '構想'
  check (ladys_status in ('構想', '待寫腳本', '腳本完成', '待拍攝', '已拍攝', '剪輯中', '剪完待審', '已上片', '暫停'));
alter table public.ladys_shoots add column if not exists ladys_brief text not null default '';      -- 行銷 agent:受眾/定位/CTA/文宣重點
alter table public.ladys_shoots add column if not exists ladys_script text not null default '';     -- 剪片 agent:腳本/分鏡全文或連結
alter table public.ladys_shoots add column if not exists ladys_assets_url text not null default ''; -- 剪片 agent:素材位置
alter table public.ladys_shoots add column if not exists ladys_final_url text not null default '';  -- 剪片 agent:成片連結
alter table public.ladys_shoots add column if not exists ladys_next_step text not null default '';
alter table public.ladys_shoots add column if not exists ladys_blocker text not null default '';
alter table public.ladys_shoots add column if not exists ladys_updated_by text not null default 'user'
  check (ladys_updated_by in ('marketing', 'secretary', 'editor', 'user', 'ai'));

-- 既有列:有日期 = 待拍攝,沒日期 = 構想
update public.ladys_shoots set ladys_status = case when ladys_date is null then '構想' else '待拍攝' end;

create index if not exists ladys_shoots_status_idx on public.ladys_shoots (ladys_status);
