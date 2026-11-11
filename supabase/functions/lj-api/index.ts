// 生命之旅 — LIFF 前端的唯一入口(Supabase Edge Function / Deno)
//
// 前端(life-journey/)不碰資料庫:一律帶 LINE ID token 打這支,
// 由這裡驗 token → 換成 lj_members → 用 service role 讀寫。前端完全不持有任何金鑰。
//
// 部署:supabase functions deploy lj-api --no-verify-jwt(LIFF 不帶 Supabase JWT)
//
// 測試身分:header x-lj-test-key 等於 lj_test_auth.token 時,可用 body.testUser 扮成
// 「LJTEST-」開頭的假帳號 —— 只能從資料庫裡(pg_net)打,碰不到真的使用者。

import {
  CORS, deletePhotos, ensureMember, findByCode, getPhoto, json, putPhoto, sameKey,
  sbDelete, sbInsert, sbSelect, sbSelectRetry, sbUpdate, signPhotos, verifyIdToken,
} from "../_shared/lj.ts";
import { aiReady, type Answer, judgeFollowup, writeProfile, writeStop } from "../_shared/lj-ai.ts";

const REGEN_MAX = 3;   // 第一次生成不算,之後重生成 / 補充重寫合計 3 次(使用者確認)

// ---- 輸入整理:前端送什麼都先切長度、過濾型別 ----
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function cleanAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((a: any) => ({
    question: str(a?.question, 200),
    picked: (Array.isArray(a?.picked) ? a.picked : []).slice(0, 4).map((x: unknown) => str(x, 60)).filter(Boolean),
    other: str(a?.other, 200),
  })).filter((a) => a.question && (a.picked.length > 0 || a.other));
}

function bad(error: string, status = 400) {
  return json({ ok: false, error }, status);
}

async function profileOf(memberId: string) {
  const rows = await sbSelect("lj_profiles", `member_id=eq.${memberId}&select=*&limit=1`);
  return rows[0] ?? null;
}

const profileOut = (p: any) => p && ({
  status: p.status, tagline: p.tagline, story: p.story, highlights: p.highlights,
  future: p.future, note: p.note_to_self, regenLeft: Math.max(0, REGEN_MAX - p.regen_used),
});

async function stopsOut(rows: any[]) {
  const urls = await signPhotos(rows.map((s) => s.photo_path));
  return rows.map((s) => ({
    id: s.id, source: s.source, title: s.title, story: s.story, when: s.when_label,
    status: s.status, photo: urls[s.photo_path] ?? "", regenLeft: Math.max(0, REGEN_MAX - s.regen_used),
  }));
}

async function pendingCount(memberId: string) {
  const rows = await sbSelect("lj_gifts", `to_member_id=eq.${memberId}&status=eq.pending&select=id&limit=50`);
  return rows.length;
}

// ---- 動作 ----
async function handle(action: string, b: any, me: any): Promise<Response> {
  if (action === "me") {
    const p = await profileOf(me.id);
    const stops = await sbSelect("lj_stops", `member_id=eq.${me.id}&status=eq.final&select=id&limit=500`);
    return json({
      ok: true,
      member: { name: me.display_name, code: me.code, avatar: me.avatar_url },
      profile: p ? { status: p.status } : null,
      stopCount: stops.length,
      pendingGifts: await pendingCount(me.id),
      ai: aiReady(),
    });
  }

  // ── 先認識自己 ──
  if (action === "quiz-followup") {
    const answers = cleanAnswers(b.answers);
    if (answers.length < 6) return bad("ANSWERS_REQUIRED");
    const r = await judgeFollowup(me.id, answers);
    return json({ ok: true, questions: r.needs ? r.questions : [] });
  }

  if (action === "quiz-generate" || action === "quiz-rewrite") {
    const p = await profileOf(me.id);
    if (p?.status === "final") return bad("ALREADY_FINAL", 409);
    // 已經有草稿 = 這次算重生成(中途離開重答也算),先擋上限再花錢
    if (p && p.regen_used >= REGEN_MAX) return bad("REGEN_LIMIT", 429);

    let answers: Answer[];
    let extra = "";
    if (action === "quiz-rewrite") {
      if (!p) return bad("NO_DRAFT", 409);
      extra = str(b.extra, 300);
      if (!extra) return bad("EXTRA_REQUIRED");
      answers = cleanAnswers(p.answers);
    } else {
      answers = cleanAnswers(b.answers);
      if (answers.length < 6) return bad("ANSWERS_REQUIRED");
    }

    const out = await writeProfile(me.id, me.display_name, answers, extra);
    const row = {
      answers, tagline: out.tagline, story: out.story, highlights: out.highlights,
      future: out.future, note_to_self: out.note_to_self, evidence: out.evidence,
      updated_at: new Date().toISOString(),
    };
    // AI 成功才扣次數,失敗不吃額度
    const saved = p
      ? (await sbUpdate("lj_profiles", `member_id=eq.${me.id}`, { ...row, regen_used: p.regen_used + 1 }))[0]
      : (await sbInsert("lj_profiles", { member_id: me.id, ...row }))[0];
    return json({ ok: true, profile: profileOut(saved) });
  }

  if (action === "profile-save") {
    const p = await profileOf(me.id);
    if (!p) return bad("NO_DRAFT", 409);
    const patch = {
      tagline: str(b.tagline, 60), story: str(b.story, 600), future: str(b.future, 400), note_to_self: str(b.note, 80),
      highlights: (Array.isArray(b.highlights) ? b.highlights : []).slice(0, 5).map((x: unknown) => str(x, 80)).filter(Boolean),
    };
    if (!patch.tagline || !patch.story) return bad("TEXT_REQUIRED");
    const now = new Date().toISOString();
    const saved = await sbUpdate("lj_profiles", `member_id=eq.${me.id}`, {
      ...patch, status: "final", updated_at: now, finalized_at: p.finalized_at ?? now,
    });
    return json({ ok: true, profile: profileOut(saved[0]) });
  }

  // ── 看旅程(自己的,或用編號看別人的)──
  if (action === "journey" || action === "lookup") {
    const owner = b.code ? await findByCode(b.code) : me;
    if (!owner) return bad("NO_SUCH_CODE", 404);
    const isMine = owner.id === me.id;
    if (action === "lookup") return json({ ok: true, name: owner.display_name || "這位旅人", isMine });

    const p = await profileOf(owner.id);
    const stops = await sbSelect("lj_stops",
      `member_id=eq.${owner.id}&status=eq.final&select=*&order=created_at.asc&limit=200`);
    return json({
      ok: true, isMine,
      member: { name: owner.display_name || "這位旅人", code: owner.code },
      profile: p?.status === "final" ? profileOut(p) : null,
      stops: await stopsOut(stops),
      pendingGifts: isMine ? await pendingCount(me.id) : 0,
    });
  }

  // ── 再紀錄自己:一段旅程 ──
  if (action === "stop-create") {
    const p = await profileOf(me.id);
    if (p?.status !== "final") return bad("NO_PROFILE", 409);   // 先認識自己,再紀錄自己
    const answers = cleanAnswers(b.answers);
    if (answers.length < 3) return bad("ANSWERS_REQUIRED");
    const photo = await putPhoto(me.id, String(b.photo ?? ""), String(b.mime ?? ""));
    const whenLabel = str(b.when, 20);
    let out;
    try {
      out = await writeStop(me.id, {
        name: me.display_name, whenLabel, answers, profile: p,
        photo: { base64: String(b.photo), mime: String(b.mime) },
      });
    } catch (e) {
      await deletePhotos([photo.path]);   // AI 失敗就別留一張沒人用的照片
      throw e;
    }
    const row = await sbInsert("lj_stops", {
      member_id: me.id, photo_path: photo.path, when_label: whenLabel, answers,
      title: out.title, story: out.story,
    });
    return json({ ok: true, stop: (await stopsOut(row))[0] });
  }

  if (action === "stop-regen" || action === "stop-save" || action === "stop-delete") {
    const id = str(b.id, 40);
    const rows = await sbSelect("lj_stops", `id=eq.${id}&member_id=eq.${me.id}&select=*&limit=1`);
    const s = rows[0];
    if (!s) return bad("NO_SUCH_STOP", 404);

    if (action === "stop-delete") {
      await sbDelete("lj_stops", `id=eq.${s.id}`);
      if (s.source === "self") await deletePhotos([s.photo_path]);   // 回憶的照片對方那段還在用
      return json({ ok: true });
    }

    if (action === "stop-save") {
      const title = str(b.title, 80), story = str(b.story, 600);
      if (!title || !story) return bad("TEXT_REQUIRED");
      const now = new Date().toISOString();
      const saved = await sbUpdate("lj_stops", `id=eq.${s.id}`, {
        title, story, status: "final", finalized_at: s.finalized_at ?? now,
      });
      return json({ ok: true, stop: (await stopsOut(saved))[0] });
    }

    // stop-regen:只有還沒定稿的才能重生成
    if (s.status === "final") return bad("ALREADY_FINAL", 409);
    if (s.regen_used >= REGEN_MAX) return bad("REGEN_LIMIT", 429);
    const p = await profileOf(me.id);
    const out = await writeStop(me.id, {
      name: me.display_name, whenLabel: s.when_label, answers: cleanAnswers(s.answers), profile: p,
      photo: await getPhoto(s.photo_path),
    });
    const saved = await sbUpdate("lj_stops", `id=eq.${s.id}`, {
      title: out.title, story: out.story, regen_used: s.regen_used + 1,
    });
    return json({ ok: true, stop: (await stopsOut(saved))[0] });
  }

  // ── 送一段回憶給別人 ──
  if (action === "gift-send") {
    const to = await findByCode(b.code);
    if (!to) return bad("NO_SUCH_CODE", 404);
    if (to.id === me.id) return bad("SELF_GIFT");
    const memory = str(b.memory, 500);
    if (!memory) return bad("MEMORY_REQUIRED");
    // 擋洗版:同一個人對同一個人,還沒處理的最多 5 則
    const waiting = await sbSelect("lj_gifts",
      `from_member_id=eq.${me.id}&to_member_id=eq.${to.id}&status=eq.pending&select=id&limit=6`);
    if (waiting.length >= 5) return bad("TOO_MANY_PENDING", 429);
    const photo = await putPhoto(me.id, String(b.photo ?? ""), String(b.mime ?? ""));
    await sbInsert("lj_gifts", {
      from_member_id: me.id, to_member_id: to.id, photo_path: photo.path, memory, when_label: str(b.when, 20),
    });
    return json({ ok: true, to: to.display_name || "對方" });
  }

  if (action === "gifts") {
    const rows = await sbSelect("lj_gifts",
      `to_member_id=eq.${me.id}&status=eq.pending&select=*&order=created_at.desc&limit=50`);
    const ids = [...new Set(rows.map((g) => g.from_member_id))];
    const froms = ids.length
      ? await sbSelect("lj_members", `id=in.(${ids.join(",")})&select=id,display_name,code&limit=50`) : [];
    const byId = new Map(froms.map((m: any) => [m.id, m]));
    const urls = await signPhotos(rows.map((g) => g.photo_path));
    return json({
      ok: true,
      gifts: rows.map((g) => ({
        id: g.id, memory: g.memory, when: g.when_label, photo: urls[g.photo_path] ?? "",
        from: byId.get(g.from_member_id)?.display_name || "一位旅人",
        fromCode: byId.get(g.from_member_id)?.code ?? "",
      })),
    });
  }

  if (action === "gift-respond") {
    const id = str(b.id, 40);
    const rows = await sbSelect("lj_gifts", `id=eq.${id}&to_member_id=eq.${me.id}&status=eq.pending&select=*&limit=1`);
    const g = rows[0];
    if (!g) return bad("NO_SUCH_GIFT", 404);
    const now = new Date().toISOString();

    if (!b.accept) {
      await sbUpdate("lj_gifts", `id=eq.${g.id}`, { status: "declined", responded_at: now });
      await deletePhotos([g.photo_path]);
      return json({ ok: true, accepted: false });
    }

    // 同意:雙方的旅程各長出一段,共用同一張照片
    const from = (await sbSelect("lj_members", `id=eq.${g.from_member_id}&select=display_name&limit=1`))[0];
    const base = { source: "gift", gift_id: g.id, photo_path: g.photo_path, when_label: g.when_label,
                   story: g.memory, status: "final", finalized_at: now };
    await sbInsert("lj_stops", [
      { ...base, member_id: me.id, title: `來自 ${from?.display_name || "一位旅人"} 的回憶` },
      { ...base, member_id: g.from_member_id, title: `送給 ${me.display_name || "一位旅人"} 的回憶` },
    ]);
    await sbUpdate("lj_gifts", `id=eq.${g.id}`, { status: "accepted", responded_at: now });
    return json({ ok: true, accepted: true });
  }

  return bad("UNKNOWN_ACTION");
}

// ---- 身分:LIFF ID token,或資料庫裡的測試鑰匙 ----
async function whoIs(req: Request, b: any) {
  const testKey = req.headers.get("x-lj-test-key") ?? "";
  if (testKey) {
    const rows = await sbSelectRetry("lj_test_auth", "id=eq.1&select=token&limit=1");
    const user = String(b.testUser ?? "");
    if (!sameKey(testKey, rows[0]?.token ?? "") || !/^LJTEST-[A-Za-z0-9-]{1,40}$/.test(user)) {
      throw new Error("UNAUTHORIZED");
    }
    return ensureMember(user, str(b.testName, 40) || "測試旅人", "");
  }
  const p = await verifyIdToken(String(b.idToken ?? ""));
  return ensureMember(p.sub, p.name, p.picture);
}

const STATUS: Record<string, number> = {
  UNAUTHORIZED: 401, BAD_PHOTO: 400, BAD_PHOTO_TYPE: 400, PHOTO_TOO_LARGE: 413,
  AI_NOT_CONFIGURED: 503, AI_BUSY: 503, AI_REFUSED: 422, AI_BAD_OUTPUT: 502,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return bad("METHOD", 405);

  let b: any;
  try { b = await req.json(); } catch { return bad("BAD_JSON"); }
  const action = String(b?.action ?? "");

  // 不需要身分:讓前端與測試知道 AI 金鑰有沒有設好
  if (action === "health") return json({ ok: true, ai: aiReady() });

  try {
    const me = await whoIs(req, b);
    return await handle(action, b, me);
  } catch (e) {
    const code = String((e as Error)?.message ?? "SERVER");
    const known = STATUS[code] ?? (code.startsWith("AI_ERROR") ? 502 : 0);
    if (!known) console.error("lj-api", action, code);
    return bad(known ? code : "SERVER", known || 500);
  }
});
