// LadyS — 傍晚運動提醒(pg_cron → ladys_tick() → 這裡)
//   supabase functions deploy ladys-workout --no-verify-jwt
// 每天固定時間推「兩招雙人運動」動畫卡片到家庭群組(兩張卡同一次 push,只算 1 次額度)。不呼叫 AI。
// 動作清單讀 ladys_workout_moves(運動教練 agent 用 /workout-sync 上架);表空或讀取失敗 → 退回下面內建的 MOVES。
// 動畫:ladys/anim/workout-*.png(APNG,≤300KB,放在 GitHub Pages)。secrets:見 _shared/ladys.ts

import {
  LADYS_C, ladysCheckCronKey, ladysClaimRun, ladysFinishRun, ladysJson, ladysPush, ladysSelect, ladysSettings, ladysTodayTaipei,
} from "../_shared/ladys.ts";

const ANIM_BASE = "https://ptgaminglife.github.io/mainwork/ladys/anim/";
const CREAM = "#FFF8F0"; // 與動畫底色一致
const HER = "#FF6B6B", HIM = "#2E9E97";

// 內建備援:表空或讀取失敗時用。每天依序輪 2 招;ratio / bg 依動畫尺寸與底色
type Move = { img: string; title: string; tip: string; reps: string; ratio: string; bg: string };
const MOVES: Move[] = [
  { img: "workout-situp.png", title: "愛的親親", tip: "腳互相固定做仰臥起坐,坐起來親一下。練核心與默契。", reps: "10 下", ratio: "1:1", bg: CREAM },
  { img: "workout-squat.png", title: "背對背擁抱", tip: "背貼背深蹲到大腿與地面平行。練下半身與平衡。", reps: "10 下", ratio: "1:1", bg: CREAM },
  { img: "workout-abs01.png", title: "坐姿抱頭交替收腿", tip: "雙手抱頭、上身後仰約 45°,一腳屈膝收到胸前、另一腳伸直懸空,左右交替。", reps: "每邊 15 下", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs02.png", title: "撐地屈膝快速收腹", tip: "雙手在身後撐地,雙腳併攏離地;快速把膝蓋收向胸口,再往前伸直,腳不落地。", reps: "20 下", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs03.png", title: "懸空剪刀腳踩點", tip: "雙手撐地、腿伸直離地,兩腳上下交替擺動,像在空中踩點。", reps: "30 秒", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs04.png", title: "坐姿左右擺腿", tip: "雙手撐地、雙腿併攏微彎離地,整雙腿像雨刷一樣左右擺動,上身保持穩定。", reps: "20 下", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs05.png", title: "坐姿開合伸腿", tip: "屈膝收腿併攏 → 雙腿向前伸直同時打開成 V,再收回。", reps: "20 下", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs06.png", title: "坐姿屈膝收腹", tip: "上身後仰撐地,雙膝收向胸口時上身微微往前,伸腿時上身再後仰,像折疊刀。", reps: "20 下", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs07.png", title: "坐姿剪刀腳", tip: "腿伸直離地,左右腿水平交叉、打開,像剪刀開合。", reps: "30 秒", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs08.png", title: "畫彩虹", tip: "雙腿併攏伸直,從左邊低處經過上方畫一道弧線到右邊,再畫回來。", reps: "×16(抱啞鈴或水瓶)", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs09.png", title: "腿部舉重", tip: "雙腿併攏,從貼近地面往上抬到約 60°,再慢慢放下但不碰地。", reps: "×16(抱啞鈴或水瓶)", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs10.png", title: "膝關節前推", tip: "屈膝讓小腿離地,膝蓋從胸前往前推出去、再收回,腳全程懸空。", reps: "×16(抱啞鈴或水瓶)", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs11.png", title: "左右側腹扭", tip: "屈膝雙腳離地,抱著啞鈴把上身左右轉,帶到身體兩側（俄羅斯轉體）。", reps: "×16(抱啞鈴或水瓶)", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs12.png", title: "觸摸腳掌", tip: "躺下、雙腿垂直朝天,捲起上背、雙手往上去碰腳掌,再慢慢躺回。", reps: "×16(抱啞鈴或水瓶)", ratio: "25:18", bg: "#ECE6DC" },
  { img: "workout-abs13.png", title: "奪命剪刀腳", tip: "最後衝刺:抱著啞鈴、腿伸直低空快速上下交替踢,撐滿 30 秒。", reps: "30 秒(抱啞鈴或水瓶)", ratio: "25:18", bg: "#ECE6DC" },
];

const REMIND: Record<string, string[]> = {
  butler: ["忙了一天,一起動一動吧 💪", "今天辛苦了,運動 10 分鐘再休息 🌿", "牽著手一起動,比一個人更有力氣 ❤️"],
  secretary: ["提醒:今天的雙人運動時間到了。", "傍晚運動時間,每招 10 下。", "今日運動尚未完成,建議現在開始。"],
  buddy: ["喂喂~運動時間到啦,不准偷懶 😎", "沙發先放下!今天兩招練起來 🔥", "一起流汗才叫夫妻檔 💦"],
  custom: ["運動時間到了,一起動一動吧 💪"],
};

// 從動作表讀(只取啟用的,依 ladys_sort, id);失敗或空 → 內建 MOVES
async function ladysLoadMoves(): Promise<{ moves: Move[]; source: string }> {
  try {
    const rows = await ladysSelect("ladys_workout_moves",
      "ladys_enabled=eq.true&order=ladys_sort.asc,id.asc&select=ladys_img,ladys_title,ladys_tip,ladys_reps,ladys_ratio,ladys_bg");
    const moves = rows
      .filter((r: any) => /^[\w.-]+\.png$/.test(r.ladys_img ?? "") && r.ladys_title)
      .map((r: any) => ({
        img: r.ladys_img, title: String(r.ladys_title).slice(0, 20), tip: String(r.ladys_tip ?? "").slice(0, 200),
        reps: String(r.ladys_reps ?? "").slice(0, 30), ratio: /^\d+:\d+$/.test(r.ladys_ratio) ? r.ladys_ratio : "1:1",
        bg: /^#[0-9A-Fa-f]{6}$/.test(r.ladys_bg) ? r.ladys_bg : CREAM,
      }));
    if (moves.length) return { moves, source: "table" };
  } catch (e) { console.error("ladys workout moves", e instanceof Error ? e.message : e); }
  return { moves: MOVES, source: "builtin" };
}

function dayIndex(ymd: string, n: number) {
  return Math.floor(new Date(`${ymd}T00:00:00+08:00`).getTime() / 864e5) % n;
}

function ladysWorkoutCard(m: Move, headline: string, step: string) {
  return {
    type: "flex",
    altText: `${headline}|${m.title}`.slice(0, 380),
    contents: {
      type: "bubble",
      styles: { hero: { backgroundColor: m.bg }, body: { backgroundColor: CREAM } },
      hero: { type: "image", url: ANIM_BASE + m.img, size: "full", aspectRatio: m.ratio, aspectMode: "fit", backgroundColor: m.bg, animated: true },
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
          { type: "text", text: `${m.reps} · 腰背不適就降低腿的高度或屈膝做`, size: "xs", color: HIM, wrap: true, margin: "md" },
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
    const { moves, source } = await ladysLoadMoves();
    const d = dayIndex(runDate, 1e9);
    const today = moves.length === 1 ? [moves[0]] : [moves[(d * 2) % moves.length], moves[(d * 2 + 1) % moves.length]];
    await ladysPush(settings.ladys_group_id, today.map((m, i) => ladysWorkoutCard(m, i === 0 ? headline : "再來一招!", `${i + 1} / ${today.length}`)));
    await ladysFinishRun(runId, "done", { moves: today.map((m) => m.img), source, pool: moves.length });
    return ladysJson({ ok: true, moves: today.map((m) => m.title) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys workout error", msg);
    await ladysFinishRun(runId, "error", { error: msg.slice(0, 300) });
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
