// 安麗蛋白素比賽 — 「戳一下」每日彙總推播(Supabase Edge Function / Deno)
//
// 規則(使用者確認):戳的當下不推播,每天台北 17:00 統一把前 24 小時的戳彙總成一張卡片,
// 顯示「你被誰戳了一下」「他說一起加油」。
//
// 由 .github/workflows/amp-poke-digest.yml 的 cron 呼叫(台北 17:00 = UTC 09:00),
// 需帶 header: x-amp-key: <AMP_DIGEST_KEY>
//
// 部署:supabase functions deploy amp-poke-digest --no-verify-jwt
//
// 額外 secrets:
//   AMP_DIGEST_KEY       呼叫這支的共享金鑰
//   AMP_LIFF_URL_FULL    卡片按鈕要開的全頁 LIFF

import {
  linePush, pokeDigestCard, sbInsert, sbSelect, todayTaipei,
} from "../_shared/amp.ts";

const DIGEST_KEY = Deno.env.get("AMP_DIGEST_KEY") ?? "";
const LIFF_FULL = Deno.env.get("AMP_LIFF_URL_FULL") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!DIGEST_KEY || req.headers.get("x-amp-key") !== DIGEST_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = todayTaipei();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  // dryRun=true 只算不推,給上線前驗收用。
  let dryRun = false;
  try {
    dryRun = Boolean((await req.json())?.dryRun);
  } catch { /* 沒有 body 就是正式跑 */ }

  const pokes = await sbSelect(
    "amp_pokes",
    `created_at=gte.${since}&select=from_member_id,to_member_id&limit=5000`,
  );
  if (pokes.length === 0) {
    return Response.json({ ok: true, today, pokes: 0, sent: 0, skipped: 0, dryRun });
  }

  const members = await sbSelect("amp_members", "select=id,line_user_id,display_name&limit=1000");
  const byId = new Map(members.map((m: any) => [m.id, m]));

  // to_member → 戳他的人名字(同一個人戳兩次,名字只列一次但次數照算)
  const inbox = new Map<string, { names: string[]; count: number }>();
  for (const p of pokes as any[]) {
    const cur = inbox.get(p.to_member_id) ?? { names: [], count: 0 };
    cur.count++;
    const name = byId.get(p.from_member_id)?.display_name || "一位夥伴";
    if (!cur.names.includes(name)) cur.names.push(name);
    inbox.set(p.to_member_id, cur);
  }

  let sent = 0, skipped = 0;
  for (const [memberId, info] of inbox) {
    const target = byId.get(memberId);
    if (!target?.line_user_id) { skipped++; continue; }

    if (dryRun) { sent++; continue; }

    // 先寫 log 再推:primary key (digest_date, member_id) 撞到就代表今天已經送過,
    // workflow 重跑或 LINE 重送都不會洗版。
    try {
      await sbInsert("amp_poke_digest_log", {
        digest_date: today, member_id: memberId, poke_count: info.count,
      }, "return=minimal");
    } catch (e) {
      if ((e as Error).message === "DUPLICATE") { skipped++; continue; }
      throw e;
    }

    const ok = await linePush(target.line_user_id, [
      pokeDigestCard({ names: info.names, count: info.count, appUrl: LIFF_FULL }),
    ]);
    if (ok) sent++; else skipped++;
  }

  return Response.json({ ok: true, today, pokes: pokes.length, targets: inbox.size, sent, skipped, dryRun });
});
