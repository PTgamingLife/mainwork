// 安麗蛋白素挑戰 — 賽季結算卡的一次性推播。
//
// 結構跟 amp-ladder-push 一樣(同一組金鑰、同樣 broadcast),差別在卡片與摘要數字:
// 這張的內文要講「幾天、幾個人出手、總共幾分」,所以發送前先查一次資料庫。
//
// 誰可以呼叫:
//   x-amp-key == AMP_DIGEST_KEY      → GitHub Actions 手動補發用
//   x-amp-key == amp_push_auth.token → pg_cron 用(Edge Secret 資料庫讀不到,另給一把)
//
// 部署:supabase functions deploy amp-final-push --no-verify-jwt

import { activeRound, finalCard, lineBroadcast, sbSelect, sbSelectRetry } from "../_shared/amp.ts";

const DIGEST_KEY = Deno.env.get("AMP_DIGEST_KEY") ?? "";
const LIFF_COMPACT = Deno.env.get("AMP_LIFF_URL_COMPACT") ?? "";
const PAGES = "https://ptgaminglife.github.io/mainwork/amway-protein";
const IMAGE_URL = Deno.env.get("AMP_FINAL_IMAGE_URL") || `${PAGES}/media/final.png`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// 等長常數時間比較,避免用回應時間猜金鑰
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 回傳 true/false 是「金鑰對不對」;查不到金鑰是另一回事(伺服器問題),
// 用丟例外區分 —— 不然一次 504 會被誤判成「金鑰不對」而靜靜地不發送。
async function authorized(key: string): Promise<boolean> {
  if (DIGEST_KEY && sameKey(key, DIGEST_KEY)) return true;
  const rows = await sbSelectRetry("amp_push_auth", "id=eq.1&select=token&limit=1");
  const token = rows[0]?.token ?? "";
  return !!token && sameKey(key, token);
}

// 「21 天,23 位夥伴出手,一起累積了 759 分。」—— 數字不寫死,發送當下現算。
function dayCount(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);

  try {
    if (!(await authorized(req.headers.get("x-amp-key") ?? ""))) {
      return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
  } catch (e) {
    console.error("auth lookup failed", (e as Error).message);
    return json({ ok: false, error: "AUTH_LOOKUP_FAILED" }, 503);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch { /* 空 body 當成正式發送 */ }

  const round = await activeRound();
  if (!round) return json({ ok: false, error: "NO_ROUND" }, 409);

  const board = await sbSelect(
    "amp_leaderboard",
    `round_id=eq.${round.id}&select=member_id,total_points&limit=1000`,
  );
  const actives = board.filter((r: any) => Number(r.total_points ?? 0) > 0).length;
  const points = board.reduce((n: number, r: any) => n + Number(r.total_points ?? 0), 0);

  const base = LIFF_COMPACT;
  const appUrl = `${base}${base.includes("?") ? "&" : "?"}view=clap`;
  const card = finalCard({
    imageUrl: IMAGE_URL,
    appUrl,
    rangeText: `賽季結束 · ${round.start_date.replaceAll("-", ".")} – ${round.end_date.slice(5).replaceAll("-", ".")}`,
    summary: `${dayCount(round.start_date, round.end_date)} 天,${actives} 位夥伴出手,`
      + `一起累積了 ${points} 分。恭喜前三名,也謝謝每一位有行動的你。`,
  });

  if (body.dryRun) return json({ ok: true, dryRun: true, card });

  const sent = await lineBroadcast([card]);
  if (!sent) return json({ ok: false, error: "BROADCAST_FAILED" }, 502);
  return json({ ok: true, sent: true });
});
