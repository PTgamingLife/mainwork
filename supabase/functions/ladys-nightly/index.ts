// LadyS — 晚間整理(pg_cron → ladys_tick() → 這裡)
//   supabase functions deploy ladys-nightly --no-verify-jwt
// 整理邏輯在 _shared/ladys-extract.ts;這裡只負責「一天一次」與推播到群組。
// secrets:見 _shared/ladys.ts,另加 ANTHROPIC_API_KEY

import {
  ladysCheckCronKey, ladysClaimRun, ladysDayLabel, ladysFinishRun, ladysJson, ladysPush, ladysSettings, ladysTodayTaipei,
} from "../_shared/ladys.ts";
import { ladysProcessPending } from "../_shared/ladys-extract.ts";
import { ladysWorkProcess } from "../_shared/ladys-work.ts";

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
    // 工作群的待確認卡附在同一次推送(最多 5 則);工作群失敗不影響家庭整理
    let work: any = null;
    try {
      const w = await ladysWorkProcess(settings);
      work = w.detail;
      r.cards.push(...w.cards);
    } catch (e) { work = { error: String(e instanceof Error ? e.message : e).slice(0, 160) }; }
    r.cards = r.cards.slice(0, 5);
    r.detail = { ...r.detail, work };
    const pushed = !!(r.cards.length && settings.ladys_group_id);
    if (pushed) {
      // 整理卡 + 刪除確認卡同一次推送,只算 1 則;若格式被拒,退回只推整理卡
      try { await ladysPush(settings.ladys_group_id, r.cards); } catch (e) {
        if (r.cards.length < 2) throw e;
        console.error("ladys nightly multi push failed, fallback", e instanceof Error ? e.message : e);
        await ladysPush(settings.ladys_group_id, r.cards.slice(0, 1));
      }
    }
    await ladysFinishRun(runId, r.status, { ...r.detail, pushed });
    return ladysJson({ ok: true, status: r.status, detail: r.detail, pushed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys nightly error", msg);
    await ladysFinishRun(runId, "error", { error: msg.slice(0, 300) });
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
