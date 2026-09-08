// 安麗蛋白素比賽 — LIFF 前端的唯一入口(Supabase Edge Function / Deno)
//
// 前端(amway-protein/)不直接碰資料庫:一律帶 LINE ID token 打這支,
// 由這裡驗 token → 換成 amp_members → 用 service role 讀寫。
// 前端因此完全不需要任何 Supabase 金鑰。
//
// 部署(LIFF 不帶 Supabase JWT):
//   supabase functions deploy amp-api --no-verify-jwt
//
// 動作:me / add-action / leaderboard / quiz-today / quiz-answer / poke

import {
  LIFF_CHANNEL_ID, NEEDS_TARGET, POINTS,
  activeRound, findMember, sbInsert, sbSelect, todayTaipei, upsertMember,
} from "../_shared/amp.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ---- 驗 LIFF ID token ----
// 走 LINE 官方 verify endpoint,aud 必須等於我們自己的 LINE Login channel id。
async function verifyIdToken(idToken: string): Promise<{ sub: string; name: string; picture: string }> {
  if (!idToken || !LIFF_CHANNEL_ID) throw new Error("UNAUTHORIZED");
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LIFF_CHANNEL_ID }),
  });
  if (!res.ok) throw new Error("UNAUTHORIZED");
  const p = await res.json();
  if (!p?.sub || p.aud !== LIFF_CHANNEL_ID) throw new Error("UNAUTHORIZED");
  return { sub: p.sub, name: p.name ?? "", picture: p.picture ?? "" };
}

// ---- 連續天數:從今天往回數,有紀錄就 +1,斷了就停 ----
function streakFrom(dates: string[], today: string): number {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date(`${today}T00:00:00Z`);
  // 今天還沒行動不算斷:從今天算起,今天沒有就改從昨天起算。
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

async function myBoardRow(roundId: string, memberId: string) {
  const rows = await sbSelect(
    "amp_leaderboard",
    `round_id=eq.${roundId}&member_id=eq.${memberId}&select=*&limit=1`,
  );
  return rows[0] ?? { total_points: 0, rank: 0, active_days: 0 };
}

async function loadMe(round: any, member: any) {
  const today = todayTaipei();
  const actions = await sbSelect(
    "amp_actions",
    `round_id=eq.${round.id}&member_id=eq.${member.id}&select=action_date,action_type,points,target_name,created_at&order=created_at.desc&limit=200`,
  );
  const board = await myBoardRow(round.id, member.id);
  const answered = await sbSelect(
    "amp_quiz_answers",
    `member_id=eq.${member.id}&quiz_date=eq.${today}&select=id&limit=1`,
  );
  const todayActions = actions.filter((a: any) => a.action_date === today);
  return {
    member: { id: member.id, name: member.display_name, avatar: member.avatar_url },
    round: { id: round.id, name: round.name, start: round.start_date, end: round.end_date },
    today,
    totalPoints: Number(board.total_points ?? 0),
    rank: Number(board.rank ?? 0),
    activeDays: Number(board.active_days ?? 0),
    streak: streakFrom(actions.map((a: any) => a.action_date), today),
    todayCounts: {
      eat: todayActions.filter((a: any) => a.action_type === "eat").length,
      refer: todayActions.filter((a: any) => a.action_type === "refer").length,
      share: todayActions.filter((a: any) => a.action_type === "share").length,
      quiz: todayActions.filter((a: any) => a.action_type === "quiz").length,
    },
    quizAnsweredToday: answered.length > 0,
    recent: actions.slice(0, 20).map((a: any) => ({
      date: a.action_date, type: a.action_type, points: a.points, target: a.target_name,
    })),
  };
}

// 每天全隊同一題:用「賽季第幾天」對題庫取模,不需要另外排程出題。
async function questionOfToday(round: any, today: string) {
  const qs = await sbSelect("amp_quiz_questions", "is_active=eq.true&select=*&order=seq.asc");
  if (qs.length === 0) return null;
  const start = Date.parse(`${round.start_date}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  const dayIndex = Math.max(0, Math.floor((now - start) / 86400000));
  return qs[dayIndex % qs.length];
}

async function handle(action: string, body: any, member: any, round: any): Promise<Response> {
  const today = todayTaipei();

  if (action === "me") return json({ ok: true, ...(await loadMe(round, member)) });

  if (action === "leaderboard") {
    const rows = await sbSelect(
      "amp_leaderboard",
      `round_id=eq.${round.id}&select=member_id,display_name,avatar_url,total_points,active_days,rank&order=rank.asc&limit=100`,
    );
    return json({
      ok: true,
      me: member.id,
      rows: rows.map((r: any) => ({
        memberId: r.member_id,
        name: r.display_name || "夥伴",
        avatar: r.avatar_url,
        points: Number(r.total_points ?? 0),
        activeDays: Number(r.active_days ?? 0),
        rank: Number(r.rank ?? 0),
      })),
    });
  }

  if (action === "add-action") {
    const type = String(body.type ?? "");
    if (!["eat", "refer", "share"].includes(type)) return json({ ok: false, error: "BAD_TYPE" }, 400);
    const targetName = String(body.targetName ?? "").trim().slice(0, 40);
    // 規則:推薦與分享必填對方名字。資料庫也有 check,這裡先擋是為了回一句人話。
    if (NEEDS_TARGET.includes(type) && !targetName) {
      return json({ ok: false, error: "TARGET_REQUIRED" }, 400);
    }
    await sbInsert("amp_actions", {
      round_id: round.id, member_id: member.id, action_date: today,
      action_type: type, points: POINTS[type],
      target_name: targetName, note: String(body.note ?? "").trim().slice(0, 200),
    }, "return=minimal");
    const me = await loadMe(round, member);
    return json({ ok: true, gained: POINTS[type], ...me });
  }

  if (action === "quiz-today") {
    const q = await questionOfToday(round, today);
    if (!q) return json({ ok: false, error: "NO_QUESTION" }, 404);
    const done = await sbSelect(
      "amp_quiz_answers",
      `member_id=eq.${member.id}&quiz_date=eq.${today}&select=chosen_index,is_correct,question_id&limit=1`,
    );
    return json({
      ok: true,
      question: { id: q.id, seq: q.seq, text: q.question, options: q.options },
      answered: done.length > 0,
      // 答過才把正解與解說送到前端,沒答過送出去等於送答案。
      result: done.length > 0
        ? { chosen: done[0].chosen_index, correct: done[0].is_correct, answer: q.answer_index, explanation: q.explanation }
        : null,
    });
  }

  if (action === "quiz-answer") {
    const q = await questionOfToday(round, today);
    if (!q) return json({ ok: false, error: "NO_QUESTION" }, 404);
    const chosen = Number(body.chosenIndex);
    if (!Number.isInteger(chosen) || chosen < 0 || chosen > 3) {
      return json({ ok: false, error: "BAD_CHOICE" }, 400);
    }
    const isCorrect = chosen === q.answer_index;
    try {
      await sbInsert("amp_quiz_answers", {
        round_id: round.id, member_id: member.id, question_id: q.id,
        quiz_date: today, chosen_index: chosen, is_correct: isCorrect,
      }, "return=minimal");
    } catch (e) {
      // unique(member_id, quiz_date):今天已經答過,不再給分。
      if ((e as Error).message === "DUPLICATE") return json({ ok: false, error: "ALREADY_ANSWERED" }, 409);
      throw e;
    }
    if (isCorrect) {
      await sbInsert("amp_actions", {
        round_id: round.id, member_id: member.id, action_date: today,
        action_type: "quiz", points: POINTS.quiz, target_name: "", note: `Q${q.seq}`,
      }, "return=minimal");
    }
    const me = await loadMe(round, member);
    return json({
      ok: true, correct: isCorrect, answer: q.answer_index, explanation: q.explanation,
      gained: isCorrect ? POINTS.quiz : 0, ...me,
    });
  }

  if (action === "poke") {
    const to = String(body.toMemberId ?? "");
    if (!to || to === member.id) return json({ ok: false, error: "BAD_TARGET" }, 400);
    const target = await sbSelect("amp_members", `id=eq.${to}&select=id,display_name&limit=1`);
    if (target.length === 0) return json({ ok: false, error: "NO_MEMBER" }, 404);
    await sbInsert("amp_pokes", {
      round_id: round.id, from_member_id: member.id, to_member_id: to,
    }, "return=minimal");
    // 這裡不推播 —— 每天 17:00 由 amp-poke-digest 彙總一次(使用者確認的規則)。
    return json({ ok: true, target: target[0].display_name || "夥伴" });
  }

  return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "BAD_JSON" }, 400);
  }

  let profile: { sub: string; name: string; picture: string };
  try {
    profile = await verifyIdToken(String(body.idToken ?? ""));
  } catch {
    return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  try {
    const round = await activeRound();
    if (!round) return json({ ok: false, error: "NO_ACTIVE_ROUND" }, 503);
    const member = (await findMember(profile.sub)) ??
      await upsertMember(profile.sub, profile.name, profile.picture);
    return await handle(String(body.action ?? ""), body, member, round);
  } catch (e) {
    console.error("amp-api", (e as Error).message);
    return json({ ok: false, error: "SERVER" }, 500);
  }
});
