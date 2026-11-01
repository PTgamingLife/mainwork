// LadyS — 早上推播(pg_cron → ladys_tick() → 這裡)
//   supabase functions deploy ladys-morning --no-verify-jwt
// 推「今天 + 明天」行程到綁定群組;今天沒行程時依設定推「今天沒有安排」。不呼叫 AI。

import {
  ladysAddDays, ladysCard, ladysCheckCronKey, ladysClaimRun, ladysDayLabel, ladysEventLine,
  ladysEventsBetween, ladysFinishRun, ladysGroupByDay, ladysJson, ladysLiffButton, ladysPush,
  ladysSettings, ladysTodayTaipei,
} from "../_shared/ladys.ts";

const LADYS_GREETING: Record<string, string> = {
  butler: "早安 ☀️ 今天也要好好照顧自己喔",
  secretary: "早安,今日行程如下",
  buddy: "早安啊兩位 😎 今天的任務來囉",
  custom: "早安 ☀️",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  let runDate = ladysTodayTaipei();
  try { const b = await req.json(); if (/^\d{4}-\d{2}-\d{2}$/.test(b?.run_date ?? "")) runDate = b.run_date; } catch { /* 用今天 */ }

  const runId = await ladysClaimRun("morning", runDate);
  if (!runId) return ladysJson({ ok: true, skipped: "already_ran" });
  try {
    const settings = await ladysSettings();
    if (!settings.ladys_group_id) throw new Error("NO_GROUP");
    const tomorrow = ladysAddDays(runDate, 1);
    const byDay = ladysGroupByDay(await ladysEventsBetween(runDate, ladysAddDays(runDate, 2)));
    const todayList = byDay.get(runDate) ?? [];
    const tomorrowList = byDay.get(tomorrow) ?? [];

    if (!todayList.length && !settings.ladys_push_empty) {
      await ladysFinishRun(runId, "skipped", { reason: "empty" });
      return ladysJson({ ok: true, skipped: "empty" });
    }
    const lines = [
      LADYS_GREETING[settings.ladys_persona] ?? LADYS_GREETING.butler,
      `【今天 ${ladysDayLabel(runDate)}】`,
      ...(todayList.length ? todayList.map(ladysEventLine) : ["今天沒有安排 🌿"]),
      ...(tomorrowList.length ? [`【明天 ${ladysDayLabel(tomorrow)}】`, ...tomorrowList.map(ladysEventLine)] : []),
    ];
    await ladysPush(settings.ladys_group_id, [ladysCard("今日行程", lines, [ladysLiffButton("打開行事曆", "calendar")])]);
    await ladysFinishRun(runId, "done", { today: todayList.length, tomorrow: tomorrowList.length });
    return ladysJson({ ok: true, today: todayList.length, tomorrow: tomorrowList.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys morning error", msg);
    await ladysFinishRun(runId, "error", { error: msg.slice(0, 300) });
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
