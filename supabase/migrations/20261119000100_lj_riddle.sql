-- 生命之旅 — 每日腦筋急轉彎
-- lj_riddles:一天一題;sent_at 有值才開放作答(推播送出之後)
-- lj_riddle_tries:收到推播的人才有一列;錯 5 次公布答案,答對記名次
-- 名次與錯誤次數由 lj_riddle_answer() 在一個交易裡算,同時答對不會重號。

create table if not exists public.lj_riddles (
  id uuid primary key default gen_random_uuid(),
  riddle_date date not null unique,
  question text not null check (char_length(question) between 1 and 200),
  answers text[] not null check (cardinality(answers) between 1 and 10),   -- 回答裡包含任一個就算對
  answer_label text not null,                                              -- 公布用的答案
  reveal text not null default '',                                         -- 公布時的補充說明
  solved_count int not null default 0,
  sent_at timestamptz,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lj_riddle_tries (
  riddle_id uuid not null references public.lj_riddles(id) on delete cascade,
  member_id uuid not null references public.lj_members(id) on delete cascade,
  wrong smallint not null default 0,
  status text not null default 'playing' check (status in ('playing', 'solved', 'revealed')),
  rank int,
  done_at timestamptz,
  primary key (riddle_id, member_id)
);

alter table public.lj_riddles enable row level security;
alter table public.lj_riddle_tries enable row level security;

-- 作答:p_correct 由 webhook 比對後傳入。回傳 {state, wrong, rank}
--   state = none(沒收到這題) / done(已完成) / solved / wrong / revealed
create or replace function public.lj_riddle_answer(p_riddle uuid, p_member uuid, p_correct boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.lj_riddle_tries; n int;
begin
  select * into t from public.lj_riddle_tries
   where riddle_id = p_riddle and member_id = p_member for update;
  if not found then return jsonb_build_object('state', 'none'); end if;
  if t.status <> 'playing' then
    return jsonb_build_object('state', 'done', 'status', t.status, 'rank', t.rank);
  end if;

  if p_correct then
    update public.lj_riddles set solved_count = solved_count + 1 where id = p_riddle returning solved_count into n;
    update public.lj_riddle_tries set status = 'solved', rank = n, done_at = now()
     where riddle_id = p_riddle and member_id = p_member;
    return jsonb_build_object('state', 'solved', 'rank', n, 'wrong', t.wrong);
  end if;

  if t.wrong + 1 >= 5 then
    update public.lj_riddle_tries set wrong = t.wrong + 1, status = 'revealed', done_at = now()
     where riddle_id = p_riddle and member_id = p_member;
    return jsonb_build_object('state', 'revealed', 'wrong', t.wrong + 1);
  end if;

  update public.lj_riddle_tries set wrong = t.wrong + 1
   where riddle_id = p_riddle and member_id = p_member;
  return jsonb_build_object('state', 'wrong', 'wrong', t.wrong + 1);
end $$;

revoke all on function public.lj_riddle_answer(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.lj_riddle_answer(uuid, uuid, boolean) to service_role;

-- 第一題:2026-11-20 早上 8:00
insert into public.lj_riddles (riddle_date, question, answers, answer_label, reveal)
values ('2026-11-20', '你打死了牠，流的卻是你的血，是什麼動物？', array['蚊'], '蚊子', '因為牠剛吸完你的血 🦟')
on conflict (riddle_date) do nothing;
