// 生命之旅 — 腦筋急轉彎推播(由 pg_cron 在早上 8:00 呼叫)
//
// 對象:做完自我探索問答的人(確定開過 LIFF,lj_profiles 有資料)。
// 冪等:sent_at 有值就不再送。dry_run 只回名單人數,不送也不寫。
// 驗證:header x-lj-test-key 必須等於 lj_test_auth.token(只有資料庫裡的排程拿得到)。

import {
  json, lineMulticast, sameKey, sbInsert, sbSelect, sbSelectRetry, sbUpdate,
} from "../_shared/lj.ts";
import { ljRiddleCard, ljTaipeiDate } from "../_shared/lj-riddle.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  try {
    const key = req.headers.get("x-lj-test-key") ?? "";
    const auth = await sbSelectRetry("lj_test_auth", "id=eq.1&select=token&limit=1");
    if (!sameKey(key, auth[0]?.token ?? "")) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

    const b = await req.json().catch(() => ({}));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.date ?? "")) ? String(b.date) : ljTaipeiDate();
    const dry = b?.dry_run === true;

    const riddle = (await sbSelect("lj_riddles", `riddle_date=eq.${date}&select=*&limit=1`))[0];
    if (!riddle) return json({ ok: false, error: "NO_RIDDLE", date }, 404);
    if (riddle.sent_at) return json({ ok: true, skipped: "ALREADY_SENT", sent_at: riddle.sent_at });

    const profiles = await sbSelect("lj_profiles", "select=member_id&limit=5000");
    const ids = new Set(profiles.map((p: any) => p.member_id));
    const members = (await sbSelect("lj_members", "select=id,line_user_id&limit=5000"))
      .filter((m: any) => ids.has(m.id) && m.line_user_id.startsWith("U"));   // 排除 LJTEST- 測試帳號
    if (dry) return json({ ok: true, dry_run: true, date, question: riddle.question, recipients: members.length });

    // 先標記已送,避免排程重試時重複推播;推播全失敗再還原
    const marked = await sbUpdate("lj_riddles", `id=eq.${riddle.id}&sent_at=is.null`, { sent_at: new Date().toISOString() });
    if (!marked.length) return json({ ok: true, skipped: "ALREADY_SENT" });   // 同時有另一次呼叫先送了

    const had = new Set((await sbSelect("lj_riddle_tries", `riddle_id=eq.${riddle.id}&select=member_id&limit=5000`))
      .map((t: any) => t.member_id));
    const fresh = members.filter((m: any) => !had.has(m.id)).map((m: any) => ({ riddle_id: riddle.id, member_id: m.id }));
    if (fresh.length) await sbInsert("lj_riddle_tries", fresh);

    let sent = 0;
    const card = ljRiddleCard(riddle.question);
    for (let i = 0; i < members.length; i += 500) {
      const chunk = members.slice(i, i + 500).map((m: any) => m.line_user_id);
      if (await lineMulticast(chunk, [card])) sent += chunk.length;
    }
    await sbUpdate("lj_riddles", `id=eq.${riddle.id}`, sent ? { sent_count: sent } : { sent_at: null });
    return json({ ok: sent > 0, date, recipients: members.length, sent });
  } catch (e) {
    console.error("lj-riddle-push", (e as Error).message);
    return json({ ok: false, error: "SERVER" }, 500);
  }
});
