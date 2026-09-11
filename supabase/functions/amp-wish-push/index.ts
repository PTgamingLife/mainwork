// 安麗蛋白素挑戰 — 限時任務卡的一次性推播。
//
// 中午 12:00 全員收到一張卡片:hero 是飛吻動畫,按鈕開半頁 App 的 ?view=wish。
// 用 broadcast(一次打給所有好友)而不是逐一 push —— 只算一則訊息額度。
//
// 誰可以呼叫:
//   x-amp-key == AMP_DIGEST_KEY      → GitHub Actions 手動補發用
//   x-amp-key == amp_push_auth.token → pg_cron 用(Edge Secret 資料庫讀不到,另給一把)
//
// 部署:supabase functions deploy amp-wish-push --no-verify-jwt
//
// 額外 secrets:
//   AMP_DIGEST_KEY        跟戳彙總共用的手動觸發金鑰
//   AMP_LIFF_URL_COMPACT  半頁 LIFF 網址
//   AMP_WISH_VIDEO_URL    動畫 mp4(留空則卡片退成靜態圖)
//   AMP_WISH_IMAGE_URL    靜態圖(舊版 LINE 與 previewUrl 用,一定要有)
// 後兩個是公開網址不是機密,沒設就用 GitHub Pages 上那份,少兩個要手動設定的東西。

import { lineBroadcast, sbSelect, wishCard } from "../_shared/amp.ts";

const DIGEST_KEY = Deno.env.get("AMP_DIGEST_KEY") ?? "";
const LIFF_COMPACT = Deno.env.get("AMP_LIFF_URL_COMPACT") ?? "";
const PAGES = "https://ptgaminglife.github.io/mainwork/amway-protein";
const VIDEO_URL = Deno.env.get("AMP_WISH_VIDEO_URL") ?? "";
const IMAGE_URL = Deno.env.get("AMP_WISH_IMAGE_URL") || `${PAGES}/media/wish.png`;

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

async function authorized(key: string): Promise<boolean> {
  if (DIGEST_KEY && sameKey(key, DIGEST_KEY)) return true;
  try {
    const rows = await sbSelect("amp_push_auth", "id=eq.1&select=token&limit=1");
    const token = rows[0]?.token ?? "";
    return !!token && sameKey(key, token);
  } catch (e) {
    console.error("authorized", (e as Error).message);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);

  if (!(await authorized(req.headers.get("x-amp-key") ?? ""))) {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch { /* 空 body 當成正式發送 */ }

  if (!IMAGE_URL) return json({ ok: false, error: "NO_IMAGE_URL" }, 503);

  const base = LIFF_COMPACT;
  const appUrl = `${base}${base.includes("?") ? "&" : "?"}view=wish`;
  const card = wishCard({ videoUrl: VIDEO_URL, altImageUrl: IMAGE_URL, appUrl });

  if (body.dryRun) return json({ ok: true, dryRun: true, card });

  const sent = await lineBroadcast([card]);
  if (!sent) return json({ ok: false, error: "BROADCAST_FAILED" }, 502);
  return json({ ok: true, sent: true });
});
