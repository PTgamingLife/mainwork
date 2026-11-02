// LadyS — 晚間整理(pg_cron → ladys_tick() → 這裡)
//   supabase functions deploy ladys-nightly --no-verify-jwt
// 整理邏輯在 _shared/ladys-extract.ts;這裡只負責「一天一次」與推播到群組。
// secrets:見 _shared/ladys.ts,另加 ANTHROPIC_API_KEY

import {
  ladysCheckCronKey, ladysClaimRun, ladysDayLabel, ladysFinishRun, ladysJson, ladysPush, ladysSettings, ladysTodayTaipei,
} from "../_shared/ladys.ts";
import { ladysProcessPending } from "../_shared/ladys-extract.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  let runDate = ladysTodayTaipei();
  try { const b = await req.json(); if (/^\d{4}-\d{2}-\d{2}$/.test(b?.run_date ?? "")) runDate = b.run_date; } catch { /* 用今天 */ }

  const runId = await ladysClaimRun("nightly", runDate);
  if (!runId) return ladysJson({ ok: true, skipped: "already_ran" });
  try {
    const r = await ladysProcessPending(`${ladysDayLabel(runDate)} 今日整理`);
    const settings = await ladysSettings();
    const pushed = !!(r.card && settings.ladys_group_id);
    if (pushed) await ladysPush(settings.ladys_group_id, [r.card]);
    await ladysFinishRun(runId, r.status, { ...r.detail, pushed });
    return ladysJson({ ok: true, status: r.status, detail: r.detail, pushed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys nightly error", msg);
    await ladysFinishRun(runId, "error", { error: msg.slice(0, 300) });
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
