// LadyS — 早上推播(pg_cron → ladys_tick() → 這裡)
//   supabase functions deploy ladys-morning --no-verify-jwt
// 推「今天 + 明天」行程(含每年重複的紀念日)與紀念日倒數到綁定群組;今天沒行程時依設定推「今天沒有安排」。
// 經期預測提醒不進群組,改用一對一私訊(依設定:老婆 / 兩人 / 關閉)。不呼叫 AI。

import {
  ladysAddDays, ladysCard, ladysCheckCronKey, ladysClaimRun, ladysDayLabel, ladysEventLine,
  ladysEventsBetween, ladysFinishRun, ladysGroupByDay, ladysJson, ladysPush,
  ladysSelect, ladysSettings, ladysTodayTaipei,
} from "../_shared/ladys.ts";
import {
  ladysAnniversaryReminders, ladysDaysBetween, ladysExpandYearly, ladysLoadPeriodStats, ladysYearlyEvents,
} from "../_shared/ladys-life.ts";

const LADYS_GREETING: Record<string, string> = {
  butler: "早安 ☀️ 今天也要好好照顧自己喔",
  secretary: "早安,今日行程如下",
  buddy: "早安啊兩位 😎 今天的任務來囉",
  custom: "早安 ☀️",
};

// 經期預測:預測日前 N 天,一對一私訊提醒(不進群組);回傳送出的人數
async function ladysPeriodRemind(settings: any, today: string): Promise<number> {
  const to = settings.ladys_period_remind_to ?? "both";
  if (to === "off") return 0;
  const stats = await ladysLoadPeriodStats();
  if (!stats.next || ladysDaysBetween(today, stats.next) !== Number(settings.ladys_period_remind_days ?? 2)) return 0;
  const members = await ladysSelect("ladys_members", "select=ladys_line_uid,ladys_role");
  const targets = members.filter((m: any) => to === "both" || m.ladys_role === "wife");
  const card = ladysCard("🌸 貼心提醒", [
    `預計 ${ladysDayLabel(stats.next)} 生理期報到`,
    `平均週期 ${stats.avg} 天(依最近紀錄推算)`,
    "記得準備好用品,這幾天多休息、多喝溫水 ☕",
  ], { view: "calendar" });
  for (const m of targets) await ladysPush(m.ladys_line_uid, [card]);
  return targets.length;
}

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
    const yearly = await ladysYearlyEvents();
    const byDay = ladysGroupByDay([
      ...(await ladysEventsBetween(runDate, ladysAddDays(runDate, 2))),
      ...ladysExpandYearly(yearly, runDate, ladysAddDays(runDate, 2)),
    ].sort((a, b) => a.ladys_start_at.localeCompare(b.ladys_start_at)));
    const remindDays: number[] = Array.isArray(settings.ladys_anniv_remind_days) ? settings.ladys_anniv_remind_days : [7, 0];
    const annivLines = ladysAnniversaryReminders(yearly, runDate, remindDays);
    const periodSent = await ladysPeriodRemind(settings, runDate);
    const todayList = byDay.get(runDate) ?? [];
    const tomorrowList = byDay.get(tomorrow) ?? [];

    if (!todayList.length && !annivLines.length && !settings.ladys_push_empty) {
      await ladysFinishRun(runId, "skipped", { reason: "empty", periodSent });
      return ladysJson({ ok: true, skipped: "empty" });
    }
    const lines = [
      LADYS_GREETING[settings.ladys_persona] ?? LADYS_GREETING.butler,
      `【今天 ${ladysDayLabel(runDate)}】`,
      ...(todayList.length ? todayList.map(ladysEventLine) : ["今天沒有安排 🌿"]),
      ...(tomorrowList.length ? [`【明天 ${ladysDayLabel(tomorrow)}】`, ...tomorrowList.map(ladysEventLine)] : []),
      ...(annivLines.length ? ["【紀念日倒數】", ...annivLines] : []),
    ];
    await ladysPush(settings.ladys_group_id, [ladysCard("今日行程", lines, { view: "calendar" })]);
    await ladysFinishRun(runId, "done", { today: todayList.length, tomorrow: tomorrowList.length, anniv: annivLines.length, periodSent });
    return ladysJson({ ok: true, today: todayList.length, tomorrow: tomorrowList.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys morning error", msg);
    await ladysFinishRun(runId, "error", { error: msg.slice(0, 300) });
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
