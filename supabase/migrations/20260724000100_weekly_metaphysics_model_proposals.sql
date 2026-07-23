create table if not exists public.destiny_metaphysics_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  input_type text not null check (input_type in ('text','image','mixed')),
  text_content text,
  storage_path text,
  mime_type text,
  original_name text,
  status text not null default 'analyzing' check (status in ('analyzing','proposed','not_suitable','accepted','rejected','failed')),
  ai_assessment jsonb,
  proposal jsonb,
  model_version_before integer,
  model_version_after integer,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint destiny_metaphysics_content_present check (
    nullif(btrim(coalesce(text_content, '')), '') is not null or storage_path is not null
  ),
  constraint destiny_metaphysics_text_length check (
    text_content is null or char_length(text_content) between 2 and 6000
  ),
  unique (user_id, week_start),
  unique (user_id, request_id)
);

create index if not exists destiny_metaphysics_user_created_idx
  on public.destiny_metaphysics_submissions (user_id, created_at desc);

alter table public.destiny_metaphysics_submissions enable row level security;

drop policy if exists destiny_metaphysics_select_own on public.destiny_metaphysics_submissions;
create policy destiny_metaphysics_select_own
on public.destiny_metaphysics_submissions
for select to authenticated
using ((select auth.uid()) = user_id);

grant select on public.destiny_metaphysics_submissions to authenticated;
revoke insert, update, delete on public.destiny_metaphysics_submissions from authenticated, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('destiny-metaphysics', 'destiny-metaphysics', false, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists destiny_metaphysics_assets_insert_own on storage.objects;
create policy destiny_metaphysics_assets_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'destiny-metaphysics'
  and (storage.foldername(name))[1] = ((select auth.uid()))::text
);

drop policy if exists destiny_metaphysics_assets_select_own on storage.objects;
create policy destiny_metaphysics_assets_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'destiny-metaphysics'
  and (storage.foldername(name))[1] = ((select auth.uid()))::text
);

drop policy if exists destiny_metaphysics_assets_delete_own on storage.objects;
create policy destiny_metaphysics_assets_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'destiny-metaphysics'
  and (storage.foldername(name))[1] = ((select auth.uid()))::text
);

create or replace function public.destiny_apply_metaphysics_proposal(
  p_user_id uuid,
  p_submission_id uuid,
  p_content jsonb,
  p_confidence numeric,
  p_change_note text,
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.destiny_metaphysics_submissions%rowtype;
  v_current public.destiny_self_models%rowtype;
  v_new public.destiny_self_models%rowtype;
begin
  select * into v_submission
  from public.destiny_metaphysics_submissions
  where id = p_submission_id and user_id = p_user_id
  for update;
  if not found then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if v_submission.status <> 'proposed' then raise exception 'SUBMISSION_NOT_PENDING'; end if;

  select * into v_current
  from public.destiny_self_models
  where user_id = p_user_id and status = 'active'
  order by version desc limit 1 for update;
  if not found then raise exception 'ACTIVE_MODEL_NOT_FOUND'; end if;

  update public.destiny_self_models set status = 'archived' where id = v_current.id;
  insert into public.destiny_self_models (
    user_id, version, content, confidence, change_note, evidence_summary, status
  ) values (
    p_user_id, v_current.version + 1, p_content,
    greatest(0, least(1, p_confidence)), left(p_change_note, 500),
    coalesce(p_evidence, '[]'::jsonb), 'active'
  ) returning * into v_new;

  update public.destiny_metaphysics_submissions
  set status = 'accepted', model_version_after = v_new.version,
      decided_at = now(), updated_at = now()
  where id = p_submission_id;

  return to_jsonb(v_new);
end;
$$;

revoke all on function public.destiny_apply_metaphysics_proposal(uuid, uuid, jsonb, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.destiny_apply_metaphysics_proposal(uuid, uuid, jsonb, numeric, text, jsonb)
  to service_role;
