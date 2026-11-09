-- AI 個人秘書工作坊（2026/11/29）選位：7 個座位、8 種動物，先選先贏
-- 公開頁只能透過 RPC 讀寫；電話與密碼雜湊不對外。

create table if not exists public.aisec_seats (
  aisec_seat_no    smallint primary key check (aisec_seat_no between 1 and 7),
  aisec_animal     text not null unique
                   check (aisec_animal in ('cat','dog','rabbit','bear','panda','penguin','fox','owl')),
  aisec_name       text not null check (char_length(aisec_name) between 1 and 20),
  aisec_phone      text not null unique check (aisec_phone ~ '^09[0-9]{8}$'),
  aisec_pin_hash   text not null,
  aisec_fail_count smallint not null default 0,
  aisec_created_at timestamptz not null default now()
);

alter table public.aisec_seats enable row level security;
revoke all on public.aisec_seats from anon, authenticated;

-- 公開座位圖：只回傳座位、動物、姓名
create or replace function public.aisec_get_seats()
returns table (seat_no smallint, animal text, name text)
language sql security definer set search_path = public
as $$
  select aisec_seat_no, aisec_animal, aisec_name from public.aisec_seats order by aisec_seat_no;
$$;

-- 選位
create or replace function public.aisec_book(p_seat int, p_animal text, p_name text, p_phone text, p_pin text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  if p_seat is null or p_seat not between 1 and 7 then return 'bad_seat'; end if;
  if p_animal is null or p_animal not in ('cat','dog','rabbit','bear','panda','penguin','fox','owl') then return 'bad_animal'; end if;
  if char_length(v_name) not between 1 and 20 then return 'bad_name'; end if;
  if p_phone is null or p_phone !~ '^09[0-9]{8}$' then return 'bad_phone'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then return 'bad_pin'; end if;
  if exists (select 1 from public.aisec_seats where aisec_seat_no = p_seat) then return 'seat_taken'; end if;
  if exists (select 1 from public.aisec_seats where aisec_animal = p_animal) then return 'animal_taken'; end if;
  if exists (select 1 from public.aisec_seats where aisec_phone = p_phone) then return 'phone_used'; end if;
  insert into public.aisec_seats (aisec_seat_no, aisec_animal, aisec_name, aisec_phone, aisec_pin_hash)
  values (p_seat, p_animal, v_name, p_phone, crypt(p_pin, gen_salt('bf')));
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;

-- 取消：輸入 4 位數密碼，錯 5 次鎖定
create or replace function public.aisec_cancel(p_seat int, p_pin text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare r public.aisec_seats%rowtype;
begin
  select * into r from public.aisec_seats where aisec_seat_no = p_seat for update;
  if not found then return 'empty'; end if;
  if r.aisec_fail_count >= 5 then return 'locked'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' or crypt(p_pin, r.aisec_pin_hash) <> r.aisec_pin_hash then
    update public.aisec_seats set aisec_fail_count = aisec_fail_count + 1 where aisec_seat_no = p_seat;
    return case when r.aisec_fail_count + 1 >= 5 then 'locked' else 'wrong_pin' end;
  end if;
  delete from public.aisec_seats where aisec_seat_no = p_seat;
  return 'ok';
end;
$$;

revoke all on function public.aisec_get_seats() from public;
revoke all on function public.aisec_book(int, text, text, text, text) from public;
revoke all on function public.aisec_cancel(int, text) from public;
grant execute on function public.aisec_get_seats() to anon, authenticated;
grant execute on function public.aisec_book(int, text, text, text, text) to anon, authenticated;
grant execute on function public.aisec_cancel(int, text) to anon, authenticated;
