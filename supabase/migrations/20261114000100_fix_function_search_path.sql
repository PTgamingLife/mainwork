-- Lint 0011:固定函式 search_path,防止被同名物件劫持。
-- match_plantoflife_memories 用到 pgvector(在 extensions schema),所以一併列入。
alter function public.purge_expired_rooms() set search_path = public;
alter function public.merge_game_state(text, jsonb) set search_path = public;
alter function public.match_plantoflife_memories(extensions.vector, double precision, integer) set search_path = public, extensions;
alter function public.enforce_single_bot_state() set search_path = public;
alter function public.lj_new_code() set search_path = public;
