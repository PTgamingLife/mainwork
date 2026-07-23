create extension if not exists pgcrypto;

create table public.destiny_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.destiny_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Taipei',
  birth_date date,
  birth_time time,
  birth_city text,
  birth_country text,
  birth_lat numeric(9,6),
  birth_lng numeric(9,6),
  birth_time_confidence text check (birth_time_confidence in ('exact','approximate','unknown')),
  day_stem text,
  day_element text,
  journey_started_on date,
  journey_completed_count integer not null default 0 check (journey_completed_count between 0 and 30),
  model_confidence numeric(4,3) not null default 0 check (model_confidence between 0 and 1),
  guardian_status text not null default 'not_started'
    check (guardian_status in ('not_started','queued','processing','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.destiny_birth_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  calculator_version text not null,
  input_hash text not null,
  chart jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

create table public.destiny_journey_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_index integer not null check (day_index between 1 and 30),
  question_id text not null,
  answer jsonb not null,
  answered_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_index),
  unique (user_id, question_id),
  unique (user_id, answered_on)
);

create table public.destiny_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  target_date date not null,
  metric_name text not null,
  target_value numeric,
  current_value numeric,
  why_text text not null,
  constraints jsonb not null default '[]'::jsonb,
  weekly_minutes integer not null check (weekly_minutes between 15 and 10080),
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index destiny_one_active_goal
  on public.destiny_goals(user_id) where status = 'active';

create table public.destiny_self_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  change_note text,
  evidence_summary jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

create unique index destiny_one_active_model
  on public.destiny_self_models(user_id) where status = 'active';

create table public.destiny_guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  character_spec jsonb not null,
  realistic_path text,
  chibi_path text,
  status text not null default 'queued'
    check (status in ('queued','processing','ready','failed')),
  error_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, version)
);

create unique index destiny_one_active_guardian
  on public.destiny_guardians(user_id) where is_active;

create table public.destiny_daily_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.destiny_goals(id) on delete cascade,
  action_date date not null,
  action_text text not null,
  minutes integer not null check (minutes between 1 and 240),
  goal_link text not null,
  done_definition text not null,
  lite_version text not null,
  rationale text not null,
  status text not null default 'pending'
    check (status in ('pending','completed','partial','not_completed','not_suitable')),
  completion_note text,
  failure_reason text,
  model_version integer,
  prompt_version text not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, action_date),
  unique (user_id, request_id)
);

create table public.destiny_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_index integer not null check (week_index between 1 and 52),
  answers jsonb not null,
  proposal jsonb,
  proposal_status text not null default 'pending'
    check (proposal_status in ('pending','accepted','rejected','observing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_index)
);

create table public.destiny_ai_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_date date not null,
  question text not null check (char_length(question) between 2 and 2000),
  answer text not null,
  category text not null,
  model_version integer,
  prompt_version text not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, chat_date),
  unique (user_id, request_id)
);

create table public.destiny_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  usage_date date not null,
  request_id uuid not null,
  status text not null check (status in ('started','succeeded','failed','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, action_type, usage_date),
  unique (user_id, request_id)
);

create table public.destiny_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.destiny_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.destiny_accept_model_proposal(
  p_user_id uuid,
  p_review_id uuid
)
returns public.destiny_self_models
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.destiny_weekly_reviews;
  v_current public.destiny_self_models;
  v_next public.destiny_self_models;
begin
  select * into v_review
  from public.destiny_weekly_reviews
  where id = p_review_id and user_id = p_user_id
  for update;

  if v_review.id is null or v_review.proposal is null then
    raise exception 'Model proposal not found';
  end if;

  if v_review.proposal_status = 'accepted' then
    select * into v_next
    from public.destiny_self_models
    where user_id = p_user_id and status = 'active';
    return v_next;
  end if;

  select * into v_current
  from public.destiny_self_models
  where user_id = p_user_id and status = 'active'
  for update;

  if v_current.id is not null then
    update public.destiny_self_models
    set status = 'archived'
    where id = v_current.id;
  end if;

  insert into public.destiny_self_models (
    user_id, version, content, confidence, change_note, evidence_summary, status
  ) values (
    p_user_id,
    coalesce(v_current.version, 0) + 1,
    coalesce(v_current.content, '{}'::jsonb) || coalesce(v_review.proposal->'patch', '{}'::jsonb),
    least(1, greatest(0, coalesce((v_review.proposal->>'confidence')::numeric, coalesce(v_current.confidence, 0.1)))),
    coalesce(v_review.proposal->>'change_note', '每週回顧更新'),
    coalesce(v_review.proposal->'evidence', '[]'::jsonb),
    'active'
  ) returning * into v_next;

  update public.destiny_weekly_reviews
  set proposal_status = 'accepted'
  where id = p_review_id;

  return v_next;
end;
$$;

revoke all on function public.destiny_accept_model_proposal(uuid, uuid) from public;
revoke all on function public.destiny_accept_model_proposal(uuid, uuid) from anon;
revoke all on function public.destiny_accept_model_proposal(uuid, uuid) from authenticated;
grant execute on function public.destiny_accept_model_proposal(uuid, uuid) to service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'destiny_profiles','destiny_journey_answers','destiny_goals',
    'destiny_guardians','destiny_daily_actions','destiny_weekly_reviews',
    'destiny_ai_usage'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.destiny_set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'destiny_admins','destiny_profiles','destiny_birth_charts','destiny_journey_answers',
    'destiny_goals','destiny_self_models','destiny_guardians','destiny_daily_actions',
    'destiny_weekly_reviews','destiny_ai_chats','destiny_ai_usage','destiny_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy destiny_admins_read_self on public.destiny_admins
  for select to authenticated using ((select auth.uid()) = user_id);

do $$
declare t text;
begin
  foreach t in array array[
    'destiny_profiles','destiny_birth_charts','destiny_journey_answers','destiny_goals',
    'destiny_self_models','destiny_guardians','destiny_daily_actions',
    'destiny_weekly_reviews','destiny_ai_chats','destiny_ai_usage'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id or exists (select 1 from public.destiny_admins a where a.user_id = (select auth.uid())))',
      t || '_select', t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'destiny_profiles','destiny_journey_answers','destiny_goals','destiny_weekly_reviews'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update', t
    );
  end loop;
end $$;

create policy destiny_audit_admin_select on public.destiny_audit_logs
  for select to authenticated
  using (exists (select 1 from public.destiny_admins a where a.user_id = (select auth.uid())));

do $$
declare t text;
begin
  foreach t in array array[
    'destiny_admins','destiny_profiles','destiny_birth_charts','destiny_journey_answers',
    'destiny_goals','destiny_self_models','destiny_guardians','destiny_daily_actions',
    'destiny_weekly_reviews','destiny_ai_chats','destiny_ai_usage','destiny_audit_logs'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
  end loop;
  foreach t in array array[
    'destiny_profiles','destiny_journey_answers','destiny_goals','destiny_weekly_reviews'
  ] loop
    execute format('grant insert, update on public.%I to authenticated', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('destiny-guardians', 'destiny-guardians', false)
on conflict (id) do update set public = false;

create policy destiny_guardian_assets_read_own
on storage.objects for select to authenticated
using (
  bucket_id = 'destiny-guardians'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
