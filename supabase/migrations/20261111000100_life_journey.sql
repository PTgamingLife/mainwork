-- 生命之旅(Life Journey)—— OA 改版後的資料表,全部 lj_ 前綴,跟舊的 amp_ 完全分開。
--
-- 先認識自己(自我探索問答 → lj_profiles),再紀錄自己(一段段旅程 → lj_stops)。
-- 別人送來的回憶先進 lj_gifts,對方同意後才在雙方的旅程各長出一段。
--
-- 全部 RLS enable、不建 policy:前端一律走 lj-api(service role),碰不到資料表。
-- 照片放私有 bucket lj-photos,前端只拿得到有時效的簽章網址。

-- 4 碼英數編號:排除容易看錯的 0/O、1/I/L,剩 31 個字元,約 92 萬組
create or replace function public.lj_new_code()
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  c text;
begin
  loop
    c := '';
    for i in 1..4 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.lj_members where code = c);
  end loop;
  return c;
end;
$$;

create table if not exists public.lj_members (
  id            uuid primary key default gen_random_uuid(),
  line_user_id  text not null unique,
  display_name  text not null default '',
  avatar_url    text not null default '',
  code          text not null unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- default 不能在建表時引用自己,建完再掛
alter table public.lj_members alter column code set default public.lj_new_code();

-- 自我探索的結果。一人一份;第一次生成不算,之後重生成/重寫合計最多 3 次
create table if not exists public.lj_profiles (
  member_id     uuid primary key references public.lj_members(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  tagline       text not null default '',
  story         text not null default '',
  highlights    jsonb not null default '[]'::jsonb,
  future        text not null default '',
  note_to_self  text not null default '',
  evidence      jsonb not null default '{}'::jsonb,   -- AI 說明每段依據哪幾題,只給測試看
  regen_used    smallint not null default 0 check (regen_used between 0 and 3),
  status        text not null default 'draft' check (status in ('draft', 'final')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finalized_at  timestamptz
);

-- 別人送來的回憶:pending → 對方同意(accepted)才會在雙方旅程各長一段
create table if not exists public.lj_gifts (
  id              uuid primary key default gen_random_uuid(),
  from_member_id  uuid not null references public.lj_members(id) on delete cascade,
  to_member_id    uuid not null references public.lj_members(id) on delete cascade,
  photo_path      text not null,
  memory          text not null check (length(btrim(memory)) between 1 and 500),
  when_label      text not null default '',
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  constraint lj_gifts_not_self check (from_member_id <> to_member_id)
);
create index if not exists lj_gifts_inbox on public.lj_gifts (to_member_id, status);

-- 旅程上的一段。自己新增的(self)或收下的回憶(gift)
create table if not exists public.lj_stops (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.lj_members(id) on delete cascade,
  source        text not null default 'self' check (source in ('self', 'gift')),
  gift_id       uuid references public.lj_gifts(id) on delete set null,
  photo_path    text not null,
  when_label    text not null default '',
  answers       jsonb not null default '{}'::jsonb,
  title         text not null default '',
  story         text not null default '',
  regen_used    smallint not null default 0 check (regen_used between 0 and 3),
  status        text not null default 'draft' check (status in ('draft', 'final')),
  created_at    timestamptz not null default now(),
  finalized_at  timestamptz
);
create index if not exists lj_stops_member on public.lj_stops (member_id, status, created_at);

-- 每次呼叫 AI 記一筆,用來對帳(費用)與找問題
create table if not exists public.lj_ai_log (
  id             bigint generated always as identity primary key,
  member_id      uuid references public.lj_members(id) on delete set null,
  kind           text not null,
  model          text not null default '',
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  ok             boolean not null default true,
  note           text not null default '',
  created_at     timestamptz not null default now()
);

-- 測試用的鑰匙:只能從資料庫裡(pg_net)拿來打 lj-api,
-- 而且只能扮成 LJTEST- 開頭的假帳號,碰不到真的使用者
create table if not exists public.lj_test_auth (
  id     smallint primary key default 1 check (id = 1),
  token  text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into public.lj_test_auth (id) values (1) on conflict (id) do nothing;

alter table public.lj_members   enable row level security;
alter table public.lj_profiles  enable row level security;
alter table public.lj_gifts     enable row level security;
alter table public.lj_stops     enable row level security;
alter table public.lj_ai_log    enable row level security;
alter table public.lj_test_auth enable row level security;

-- 照片:私有 bucket,單張上限 5MB(前端會先壓到長邊 1600px,通常 300KB 上下)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lj-photos', 'lj-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
