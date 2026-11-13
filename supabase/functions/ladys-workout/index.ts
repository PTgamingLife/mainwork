// LadyS — 傍晚運動提醒(pg_cron → ladys_tick() → 這裡)
//   supabase functions deploy ladys-workout --no-verify-jwt
// 每天固定時間推「兩招雙人運動」動畫卡片到家庭群組(兩張卡同一次 push,只算 1 次額度)。不呼叫 AI。
// 動畫:ladys/anim/workout-*.png(APNG,≤300KB,放在 GitHub Pages)。secrets:見 _shared/ladys.ts

import {
  LADYS_C, ladysCheckCronKey, ladysClaimRun, ladysFinishRun, ladysJson, ladysPush, ladysSettings, ladysTodayTaipei,
} from "../_shared/ladys.ts";

const ANIM_BASE = "https://ptgaminglife.github.io/mainwork/ladys/anim/";
const CREAM = "#FFF8F0"; // 與動畫底色一致
const HER = "#FF6B6B", HIM = "#2E9E97";

const MOVES = [
  { img: "workout-situp.png", title: "第一招 愛的親親", tip: "腳互相固定做仰臥起坐,坐起來親一下。練核心與默契。", alt: "雙人仰臥起坐" },
  { img: "workout-squat.png", title: "第二招 背對背擁抱", tip: "背貼背深蹲到大腿與地面平行。練下半身與平衡。", alt: "背對背深蹲" },
];

const REMIND: Record<string, string[]> = {
  butler: ["忙了一天,一起動一動吧 💪", "今天辛苦了,運動 10 分鐘再休息 🌿", "牽著手一起動,比一個人更有力氣 ❤️"],
  secretary: ["提醒:今天的雙人運動時間到了。", "傍晚運動時間,每招 10 下。", "今日運動尚未完成,建議現在開始。"],
  buddy: ["喂喂~運動時間到啦,不准偷懶 😎", "沙發先放下!今天兩招練起來 🔥", "一起流汗才叫夫妻檔 💦"],
  custom: ["運動時間到了,一起動一動吧 💪"],
};

function dayIndex(ymd: string, n: number) {
  return Math.floor(new Date(`${ymd}T00:00:00+08:00`).getTime() / 864e5) % n;
}

function ladysWorkoutCard(m: typeof MOVES[number], headline: string, step: string) {
  return {
    type: "flex",
    altText: `${headline}|${m.title}`.slice(0, 380),
    contents: {
      type: "bubble",
      styles: { hero: { backgroundColor: CREAM }, body: { backgroundColor: CREAM } },
      hero: { type: "image", url: ANIM_BASE + m.img, size: "full", aspectRatio: "1:1", aspectMode: "cover", animated: true },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "LadyS 運動提醒", size: "xs", color: LADYS_C.wife, weight: "bold", flex: 1 },
            { type: "text", text: step, size: "xs", color: LADYS_C.muted, align: "end" },
          ] },
          { type: "text", text: headline, size: "md", weight: "bold", color: LADYS_C.ink, wrap: true },
          { type: "separator", color: "#F2E2D6", margin: "md" },
          { type: "text", text: m.title, size: "lg", weight: "bold", color: HER, wrap: true, margin: "md" },
          { type: "text", text: m.tip, size: "sm", color: LADYS_C.ink, wrap: true },
          { type: "text", text: "👩 紅 · 👨 綠 — 每招 10 下,不舒服就停", size: "xs", color: HIM, wrap: true, margin: "md" },
        ],
      },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  let runDate = ladysTodayTaipei();
  try { const b = await req.json(); if (/^\d{4}-\d{2}-\d{2}$/.test(b?.run_date ?? "")) runDate = b.run_date; } catch { /* 用今天 */ }

  const runId = await ladysClaimRun("workout", runDate);
  if (!runId) return ladysJson({ ok: true, skipped: "already_ran" });
  try {
    const settings = await ladysSettings();
    if (!settings.ladys_group_id) throw new Error("NO_GROUP");
    if (settings.ladys_workout_enabled === false) {
      await ladysFinishRun(runId, "skipped", { reason: "disabled" });
      return ladysJson({ ok: true, skipped: "disabled" });
    }
    const lines = REMIND[settings.ladys_persona] ?? REMIND.butler;
    const headline = lines[dayIndex(runDate, lines.length)];
    await ladysPush(settings.ladys_group_id, MOVES.map((m, i) => ladysWorkoutCard(m, i === 0 ? headline : "再來一招!", `${i + 1} / ${MOVES.length}`)));
    await ladysFinishRun(runId, "done", { moves: MOVES.length });
    return ladysJson({ ok: true, moves: MOVES.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys workout error", msg);
    await ladysFinishRun(runId, "error", { error: msg.slice(0, 300) });
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
