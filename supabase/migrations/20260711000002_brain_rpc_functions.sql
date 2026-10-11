-- brain schema 未曝露 REST,一律透過 public 的 SECURITY DEFINER RPC 存取

create or replace function public.brain_match_knowledge(
  query_embedding  float8[],
  match_count      int default 8,
  filter_categories text[] default null
)
returns table (
  id uuid, work_id uuid, title text, content text,
  categories text[], type text, source_url text, similarity float
)
language sql stable security definer set search_path = brain, public, extensions as $$
  select k.id, k.work_id, k.title, k.content,
         k.categories::text[], k.type, k.source_url,
         1 - (k.embedding <=> (query_embedding::vector)) as similarity
  from brain.knowledge k
  where k.embedding is not null
    and (filter_categories is null
         or k.categories && filter_categories::brain.category[])
  order by k.embedding <=> (query_embedding::vector)
  limit match_count;
$$;

create or replace function public.brain_ingest_knowledge(
  p_title text, p_content text, p_categories text[], p_embedding float8[],
  p_work_id uuid default null, p_type text default 'note', p_source_url text default null
)
returns uuid
language plpgsql security definer set search_path = brain, public, extensions as $$
declare new_id uuid;
begin
  insert into brain.knowledge (work_id, categories, type, title, content, embedding, source_url)
  values (p_work_id, p_categories::brain.category[], p_type, p_title, p_content,
          p_embedding::vector, p_source_url)
  returning id into new_id;
  return new_id;
end;
$$;

-- 網狀圖: 節點
create or replace function public.brain_nodes()
returns table (id uuid, title text, categories text[], type text, work_id uuid)
language sql stable security definer set search_path = brain, public, extensions as $$
  select k.id, coalesce(nullif(k.title,''), left(k.content,40)) as title,
         k.categories::text[], k.type, k.work_id
  from brain.knowledge k where k.embedding is not null;
$$;

-- 網狀圖: RAG 相似度連線
create or replace function public.brain_similarity_edges(threshold float default 0.75)
returns table (source uuid, target uuid, similarity float)
language sql stable security definer set search_path = brain, public, extensions as $$
  select a.id as source, b.id as target,
         1 - (a.embedding <=> b.embedding) as similarity
  from brain.knowledge a
  join brain.knowledge b
    on a.id < b.id
   and a.embedding is not null and b.embedding is not null
  where 1 - (a.embedding <=> b.embedding) >= threshold;
$$;
