-- Lint 0028/0029:收回 anon / authenticated 對 SECURITY DEFINER 函式的 RPC 執行權。
-- 呼叫者盤點(2026-10-20):
--   ipapp_add_credits / ipapp_use_credit  → 只有 Edge Function ipapp-generate / ipapp-admin(service_role)
--   brain_ingest_knowledge / brain_match_knowledge → 只有 Edge Function brain(service_role)
--   brain_nodes / brain_similarity_edges → 無呼叫者(前端已停用)
--   amp_*_push_once → 只由 pg_cron(postgres)排程呼叫
--   broll_bump_usage → broll_usages 的 trigger 函式,不該被 RPC 呼叫
--   ipapp_leaderboard → ip-studio/leaderboard.html,登入後呼叫(authenticated)
--   vp_spend_points   → IGagent/index.html,登入後呼叫(authenticated)

-- ── 1. 僅限後端:全部收回,只留 service_role ──
revoke execute on function public.ipapp_add_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.ipapp_use_credit(uuid) from public, anon, authenticated;
grant execute on function public.ipapp_add_credits(uuid, integer) to service_role;
grant execute on function public.ipapp_use_credit(uuid) to service_role;

revoke execute on function public.brain_ingest_knowledge(text, text, text[], double precision[], uuid, text, text) from public, anon, authenticated;
revoke execute on function public.brain_match_knowledge(double precision[], integer, text[]) from public, anon, authenticated;
grant execute on function public.brain_ingest_knowledge(text, text, text[], double precision[], uuid, text, text) to service_role;
grant execute on function public.brain_match_knowledge(double precision[], integer, text[]) to service_role;
-- 知識圖譜前端已停用
revoke execute on function public.brain_nodes() from public, anon, authenticated;
revoke execute on function public.brain_similarity_edges(double precision) from public, anon, authenticated;

revoke execute on function public.amp_wish_push_once() from public, anon, authenticated;
revoke execute on function public.amp_luck_push_once() from public, anon, authenticated;
revoke execute on function public.amp_ladder_push_once() from public, anon, authenticated;

revoke execute on function public.broll_bump_usage() from public, anon, authenticated;

-- ── 2. 前端登入後才用:只收回 anon ──
revoke execute on function public.ipapp_leaderboard() from public, anon;
grant execute on function public.ipapp_leaderboard() to authenticated;

revoke execute on function public.vp_spend_points(integer) from public, anon;
grant execute on function public.vp_spend_points(integer) to authenticated;

-- vp_spend_points 原本沒擋負數:cost = -1000 會「加」1000 點。補上輸入驗證。
create or replace function public.vp_spend_points(cost integer default 10)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare remaining int;
begin
  if cost is null or cost <= 0 or cost > 1000 then
    raise exception 'INVALID_COST';
  end if;
  update public.vp_accounts set points = points - cost
   where user_id = auth.uid() and is_active and points >= cost
   returning points into remaining;
  if remaining is null then
    raise exception 'INSUFFICIENT_POINTS';
  end if;
  return remaining;
end $function$;
