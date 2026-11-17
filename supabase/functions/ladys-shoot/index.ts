// LadyS — 每日拍片提醒(pg_cron → ladys_tick() → 這裡,預設 09:00,設定頁可改 / 關閉)
//   supabase functions deploy ladys-shoot --no-verify-jwt
// 未來 7 天有拍片 → 每支一張卡(狀態 / 主題 / 內文 / 需準備事項 / 下一步)。內文只由剪片 agent 與使用者討論定案:空白就顯示「內容待與剪片 agent 討論」,LadyS 不寫入任何內容欄位。
// 7 天內沒有排拍片 → 推「待拍主題」(未排日期,最舊的 2 則);連主題都沒有 → 提醒方向與「拍片主題」指令。已上片 / 暫停的不推。所有卡片同一次 push(≤5 則,算 1 次額度)。
// secrets:見 _shared/ladys.ts(不呼叫 AI)
import {
  LADYS_OWNER_LABEL, ladysAddDays, ladysCard, ladysCheckCronKey, ladysClaimRun, ladysDayLabel, ladysFinishRun, ladysJson,
  ladysPush, ladysSelect, ladysSettings, ladysTodayTaipei,
} from "../_shared/ladys.ts";

const MAX_CARDS = 4;

function shootCard(x: any, today: string, headline: string) {
  const left = x.ladys_date ? Math.round((new Date(`${x.ladys_date}T00:00:00+08:00`).getTime() - new Date(`${today}T00:00:00+08:00`).getTime()) / 864e5) : -1;
  const when = left < 0 ? "待拍主題" : left === 0 ? "今天" : left === 1 ? "明天" : `再 ${left} 天`;
  const lines = [
    headline,
    x.ladys_date ? `【${when} ${ladysDayLabel(x.ladys_date)}${x.ladys_time ? " " + x.ladys_time : ""}】` : "【還沒排日期,到拍片頁排一下 📅】",
    `${LADYS_OWNER_LABEL[x.ladys_owner as "both"]} ${x.ladys_topic}`,
    `📍 狀態:${x.ladys_status || "構想"}`,
    "【內文】",
    ...(String(x.ladys_content ?? "").trim()
      ? String(x.ladys_content).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12)
      : ["內容待與剪片 agent 討論 ✂️"]),
    ...(x.ladys_prep ? ["【需準備事項】", ...String(x.ladys_prep).split(/\n|、|,|,/).map((l) => l.trim()).filter(Boolean).slice(0, 8).map((l) => `☐ ${l}`)] : []),
    ...(x.ladys_next_step ? ["【下一步】", `👉 ${x.ladys_next_step}`] : []),
    ...(x.ladys_blocker ? [`⛔ 卡關:${x.ladys_blocker}`] : []),
  ];
  return ladysCard(`🎬 拍片提醒 · ${when}`, lines, undefined);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  let runDate = ladysTodayTaipei();
  try { const b = await req.json(); if (/^\d{4}-\d{2}-\d{2}$/.test(b?.run_date ?? "")) runDate = b.run_date; } catch { /* 用今天 */ }

  const runId = await ladysClaimRun("shoot", runDate);
  if (!runId) return ladysJson({ ok: true, skipped: "already_ran" });
  try {
    const s = await ladysSettings();
    if (!s.ladys_group_id) throw new Error("NO_GROUP");
    if (s.ladys_shoot_enabled === false) {
      await ladysFinishRun(runId, "skipped", { reason: "disabled" });
      return ladysJson({ ok: true, skipped: "disabled" });
    }
    let shoots = await ladysSelect("ladys_shoots",
      `ladys_deleted=eq.false&ladys_status=not.in.(已上片,暫停)&ladys_date=gte.${runDate}&ladys_date=lt.${ladysAddDays(runDate, 7)}&order=ladys_date.asc,ladys_time.asc&limit=${MAX_CARDS}&select=*`);
    if (!shoots.length) {
      shoots = await ladysSelect("ladys_shoots", "ladys_deleted=eq.false&ladys_status=not.in.(已上片,暫停)&ladys_date=is.null&order=ladys_created_at.asc&limit=2&select=*");
    }
    const cards: unknown[] = [];
    if (shoots.length) {
      shoots.forEach((x, i) => cards.push(shootCard(x, runDate, i === 0 ? "今天的拍片事宜整理好了 🎥" : "下一支 👇")));
    } else {
      // 7 天內沒排拍片、也沒有待拍主題 → 只提醒方向與怎麼加主題(不由 AI 產內容)
      cards.push(ladysCard("🎬 拍片提醒 · 還沒有拍片計畫", [
        `👨 方向:${s.ladys_shoot_dir_husband}`, `👩 方向:${s.ladys_shoot_dir_wife}`,
        "7 天內沒有排拍片,也沒有待拍主題。",
        "群組輸入「拍片主題 xxx」先記一個主題,內容再跟剪片 agent 討論 ✂️",
      ]));
    }
    if (!cards.length) throw new Error("NO_CARDS");
    await ladysPush(s.ladys_group_id, cards.slice(0, 5));
    await ladysFinishRun(runId, "done", { shoots: shoots.length, cards: cards.length });
    return ladysJson({ ok: true, shoots: shoots.length, cards: cards.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys shoot error", msg);
    await ladysFinishRun(runId, "error", { error: msg.slice(0, 300) });
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
