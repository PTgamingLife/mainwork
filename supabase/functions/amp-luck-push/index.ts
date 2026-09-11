// 安麗蛋白素挑戰 — 刮刮樂卡的一次性推播。
//
// 結構跟 amp-wish-push 一樣(同一組金鑰、同樣用 broadcast),差別只在送出的卡片。
// 刻意不共用一支函式:兩張卡的排程時間與生命週期各自獨立,
// 合在一起反而要多傳參數、多一個出錯的地方。
//
// 誰可以呼叫:
//   x-amp-key == AMP_DIGEST_KEY      → GitHub Actions 手動補發用
//   x-amp-key == amp_push_auth.token → pg_cron 用(Edge Secret 資料庫讀不到,另給一把)
//
// 部署:supabase functions deploy amp-luck-push --no-verify-jwt

import { lineBroadcast, luckCard, sbSelect } from "../_shared/amp.ts";

const DIGEST_KEY = Deno.env.get("AMP_DIGEST_KEY") ?? "";
const LIFF_COMPACT = Deno.env.get("AMP_LIFF_URL_COMPACT") ?? "";
const PAGES = "https://ptgaminglife.github.io/mainwork/amway-protein";
const IMAGE_URL = Deno.env.get("AMP_LUCK_IMAGE_URL") || `${PAGES}/media/luck.png`;

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

  const base = LIFF_COMPACT;
  const appUrl = `${base}${base.includes("?") ? "&" : "?"}view=luck`;
  const card = luckCard({ imageUrl: IMAGE_URL, appUrl });

  if (body.dryRun) return json({ ok: true, dryRun: true, card });

  const sent = await lineBroadcast([card]);
  if (!sent) return json({ ok: false, error: "BROADCAST_FAILED" }, 502);
  return json({ ok: true, sent: true });
});
