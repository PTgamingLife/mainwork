// 安麗蛋白素挑戰 — 掌聲結算推播(台北 21:00,一次性)。
//
// 規則(使用者確認):一鍵送給全部五位、整輪一次,所以每位前五名收到的數字都一樣,
// 就是 amp_claps 的總列數。這是 per-user push(五則額度),不是 broadcast ——
// 每個人的名次與分數不同,訊息內容也不同。
//
// 誰可以呼叫:跟其他推播函式同一套金鑰。
// 部署:supabase functions deploy amp-clap-digest --no-verify-jwt

import {
  activeRound, clapResultCard, linePush, sbInsert, sbSelect, sbSelectRetry,
} from "../_shared/amp.ts";

const DIGEST_KEY = Deno.env.get("AMP_DIGEST_KEY") ?? "";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authorized(key: string): Promise<boolean> {
  if (DIGEST_KEY && sameKey(key, DIGEST_KEY)) return true;
  const rows = await sbSelectRetry("amp_push_auth", "id=eq.1&select=token&limit=1");
  const token = rows[0]?.token ?? "";
  return !!token && sameKey(key, token);
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
  const dryRun = Boolean(body.dryRun);

  const round = await activeRound();
  if (!round) return json({ ok: false, error: "NO_ROUND" }, 409);

  const claps = await sbSelect("amp_claps", `round_id=eq.${round.id}&select=id&limit=5000`);
  const count = claps.length;

  const top = await sbSelect(
    "amp_leaderboard",
    `round_id=eq.${round.id}&select=member_id,rank,total_points&order=rank.asc&limit=5`,
  );
  if (top.length === 0) return json({ ok: true, count, targets: 0, sent: 0, skipped: 0, dryRun });

  const ids = top.map((r: any) => r.member_id).join(",");
  const members = await sbSelect(
    "amp_members",
    `id=in.(${ids})&select=id,line_user_id,display_name&limit=10`,
  );
  const byId = new Map(members.map((m: any) => [m.id, m]));

  let sent = 0, skipped = 0;
  for (const row of top as any[]) {
    const target = byId.get(row.member_id);
    if (!target?.line_user_id) { skipped++; continue; }
    if (dryRun) { sent++; continue; }

    // 先寫 log 再推:primary key (round_id, member_id) 撞到就代表已經送過。
    // 補發或重跑都不會洗版。
    try {
      await sbInsert("amp_clap_digest_log", {
        round_id: round.id, member_id: row.member_id, clap_count: count,
      }, "return=minimal");
    } catch (e) {
      if ((e as Error).message === "DUPLICATE") { skipped++; continue; }
      throw e;
    }

    const ok = await linePush(target.line_user_id, [
      clapResultCard({
        rank: Number(row.rank ?? 0),
        count,
        points: Number(row.total_points ?? 0),
      }),
    ]);
    if (ok) sent++; else skipped++;
  }

  return json({ ok: true, count, targets: top.length, sent, skipped, dryRun });
});
