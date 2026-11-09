-- 十神修行錄:今日卜卦用的《周易》64 卦(卦辭、爻辭、白話說明)
-- 資料來源:supabase/seed/sg_iching.json;卦辭、爻辭依維基文庫《周易》各卦頁(使用者提供之整理檔,〔〕校注已移除)
create table if not exists public.sg_iching (
  sg_no        int primary key check (sg_no between 1 and 64),
  sg_name      text not null,
  sg_full_name text not null,
  sg_bits      text not null unique check (sg_bits ~ '^[01]{6}$'), -- 由下而上,1=陽
  sg_upper     text not null,
  sg_lower     text not null,
  sg_judgment  text not null,
  sg_plain     text not null,
  sg_lines     jsonb not null,  -- 6 條爻辭,由初爻到上爻
  sg_extra     text,            -- 用九 / 用六
  sg_verified  boolean not null default false
);
alter table public.sg_iching enable row level security; -- 只由 sg-api(service role)讀取
