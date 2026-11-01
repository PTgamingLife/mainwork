// LadyS — LINE webhook(OA 陳柏廷 Po-Ting)
//   supabase functions deploy ladys-webhook --no-verify-jwt
// 流程:驗簽 → 群組白名單 → 文字訊息存 ladys_messages(晚上整理)→ 關鍵字指令用 reply 回(不吃推播額度)
// 群組平常完全不插話。綁定:在群組輸入「LadyS 綁定 <LADYS_BIND_CODE>」。
// secrets:見 _shared/ladys.ts,另加 LADYS_BIND_CODE

import {
  LADYS_LINE_SECRET, ladysAddDays, ladysCard, ladysDayLabel, ladysEventLine, ladysEventsBetween,
  ladysGroupByDay, ladysInsert, ladysJson, ladysLine, ladysLiffButton, ladysReply, ladysSelect,
  ladysSettings, ladysTodayTaipei, ladysUpdate, LADYS_OWNER_LABEL,
} from "../_shared/ladys.ts";

const LADYS_BIND_CODE = Deno.env.get("LADYS_BIND_CODE") ?? "";
// 帳號擁有者(陳柏廷)的 LINE userId,沿用既有每日推播的 LINE_USER_ID;還沒綁定群組前也能用一對一指令
const LADYS_OWNER_UID = "U55b426b2cefa9787c9c23c97b45963fe";
const enc = new TextEncoder();
const LADYS_COMMANDS = ["行程", "帳", "目標", "待辦", "瑣事", "選單"];

async function ladysVerifySignature(raw: string, sig: string): Promise<boolean> {
  if (!LADYS_LINE_SECRET || !sig) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(LADYS_LINE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// 綁定群組裡第一次說話的人自動成為成員;綁定者 = 老公,第二位 = 老婆(LIFF 設定頁可改)
async function ladysEnsureMember(groupId: string, uid: string, isBinder = false) {
  const [m] = await ladysSelect("ladys_members", `ladys_line_uid=eq.${encodeURIComponent(uid)}&select=ladys_line_uid`);
  if (m) return;
  const all = await ladysSelect("ladys_members", "select=ladys_role");
  if (all.length >= 2) return; // 只服務兩個人
  let name = "成員";
  try {
    const p = await ladysLine(`group/${groupId}/member/${uid}`, undefined, "GET");
    name = String(p.displayName ?? name).slice(0, 20);
  } catch { /* 拿不到暱稱就用預設 */ }
  const role = isBinder || !all.some((x) => x.ladys_role === "husband") ? "husband" : "wife";
  await ladysInsert("ladys_members?on_conflict=ladys_line_uid", {
    ladys_line_uid: uid, ladys_name: name, ladys_role: role, ladys_emoji: LADYS_OWNER_LABEL[role],
  }, "resolution=ignore-duplicates,return=minimal");
}

async function ladysIsMember(uid: string): Promise<boolean> {
  const [m] = await ladysSelect("ladys_members", `ladys_line_uid=eq.${encodeURIComponent(uid)}&select=ladys_line_uid`);
  return !!m;
}

// ---------- 指令 ----------
async function ladysCmdSchedule() {
  const today = ladysTodayTaipei();
  const events = await ladysEventsBetween(today, ladysAddDays(today, 8));
  const byDay = ladysGroupByDay(events);
  const lines: string[] = [];
  for (const [day, list] of byDay) {
    lines.push(`【${ladysDayLabel(day)}${day === today ? " 今天" : ""}】`);
    for (const e of list) lines.push(ladysEventLine(e));
  }
  return ladysCard("未來 7 天行程", lines.length ? lines : ["這 7 天沒有安排 🌿"], [ladysLiffButton("打開行事曆", "calendar")]);
}

async function ladysCmdExpenses() {
  const today = ladysTodayTaipei();
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await ladysSelect("ladys_expenses",
    `ladys_deleted=eq.false&ladys_date=gte.${monthStart}&order=ladys_date.desc&select=*`);
  const total = rows.reduce((s, r) => s + Number(r.ladys_amount), 0);
  const byPayer: Record<string, number> = {};
  for (const r of rows) byPayer[r.ladys_payer] = (byPayer[r.ladys_payer] ?? 0) + Number(r.ladys_amount);
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
  const lines = [
    `本月合計 ${fmt(total)}(${rows.length} 筆)`,
    ...Object.entries(byPayer).map(([p, n]) => `${LADYS_OWNER_LABEL[p as "husband"]} ${fmt(n)}`),
    "【最近 5 筆】",
    ...rows.slice(0, 5).map((r) => `${r.ladys_date.slice(5)} ${r.ladys_category} ${fmt(Number(r.ladys_amount))} ${r.ladys_note}`.trim()),
  ];
  return ladysCard(`${Number(today.slice(5, 7))} 月支出`, lines, [ladysLiffButton("打開記帳", "money")]);
}

async function ladysCmdNotes(goal: boolean) {
  const rows = await ladysSelect("ladys_notes",
    `ladys_deleted=eq.false&ladys_done=eq.false&ladys_kind=${goal ? "eq.goal" : "neq.goal"}&order=ladys_created_at.desc&limit=20&select=*`);
  const lines = rows.map((r) => `${goal ? "🎯" : "☐"} ${LADYS_OWNER_LABEL[r.ladys_owner as "both"] ?? ""} ${r.ladys_content}`);
  return goal
    ? ladysCard("進行中的目標", lines.length ? lines : ["還沒有目標 🌱"], [ladysLiffButton("打開目標", "goals")])
    : ladysCard("未完成待辦", lines.length ? lines : ["全部完成了 ✨"], [ladysLiffButton("打開待辦", "todos")]);
}

function ladysCmdMenu() {
  return ladysCard("LadyS 選單", ["想看什麼?"], [
    ladysLiffButton("📅 行事曆", "calendar"),
    ladysLiffButton("💰 記帳", "money"),
    ladysLiffButton("🎯 目標", "goals"),
    ladysLiffButton("☑️ 待辦", "todos"),
    ladysLiffButton("⚙️ 設定", "settings"),
  ]);
}

async function ladysRunCommand(text: string) {
  switch (text) {
    case "行程": return await ladysCmdSchedule();
    case "帳": return await ladysCmdExpenses();
    case "目標": return await ladysCmdNotes(true);
    case "待辦": case "瑣事": return await ladysCmdNotes(false);
    default: return ladysCmdMenu();
  }
}

// ---------- 事件 ----------
async function ladysHandle(ev: any, settings: any) {
  const src = ev.source ?? {};
  const boundGroup: string | null = settings.ladys_group_id ?? null;

  // 被拉進群組:已綁定別的群組 → 直接退出;還沒綁定 → 等綁定碼
  if (ev.type === "join" && src.type === "group") {
    if (boundGroup && boundGroup !== src.groupId) {
      await ladysLine(`group/${src.groupId}/leave`);
    } else if (!boundGroup) {
      await ladysReply(ev.replyToken, [{ type: "text", text: "我是 LadyS 👋 請輸入「LadyS 綁定 <綁定碼>」啟用。" }]);
    }
    return;
  }
  if (src.type === "room") { await ladysLine(`room/${src.roomId}/leave`); return; }
  if (ev.type !== "message" || ev.message?.type !== "text") return; // 照片/貼圖/語音暫不處理

  const text = String(ev.message.text ?? "").trim();
  const uid: string = src.userId ?? "";

  if (src.type === "group") {
    const gid: string = src.groupId;
    if (!boundGroup) {
      const m = text.match(/^LadyS\s*綁定\s*(\S+)$/i);
      if (m && LADYS_BIND_CODE && m[1] === LADYS_BIND_CODE && uid) {
        await ladysUpdate("ladys_settings", "id=eq.1", { ladys_group_id: gid, ladys_updated_at: new Date().toISOString() });
        await ladysEnsureMember(gid, uid, true);
        await ladysReply(ev.replyToken, [{ type: "text", text: "✅ 綁定完成!之後我會安靜記錄,每晚整理、每早推播。輸入「選單」看功能。" }]);
      }
      return;
    }
    if (gid !== boundGroup) { await ladysLine(`group/${gid}/leave`); return; }

    if (uid) await ladysEnsureMember(gid, uid);
    if (LADYS_COMMANDS.includes(text)) {
      await ladysReply(ev.replyToken, [await ladysRunCommand(text)]);
      return;
    }
    await ladysInsert("ladys_messages?on_conflict=ladys_line_msg_id", {
      ladys_line_msg_id: String(ev.message.id),
      ladys_group_id: gid,
      ladys_user_uid: uid || null,
      ladys_text: text.slice(0, 2000),
      ladys_sent_at: new Date(Number(ev.timestamp)).toISOString(),
    }, "resolution=ignore-duplicates,return=minimal");
    return;
  }

  // 一對一聊天室:只回應帳號擁有者與成員(你、老婆)的指令,其他人一律不理
  if (src.type === "user" && uid && LADYS_COMMANDS.includes(text) && (uid === LADYS_OWNER_UID || await ladysIsMember(uid))) {
    await ladysReply(ev.replyToken, [await ladysRunCommand(text)]);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  const raw = await req.text();
  if (!(await ladysVerifySignature(raw, req.headers.get("x-line-signature") ?? ""))) {
    return ladysJson({ error: "BAD_SIGNATURE" }, 401);
  }
  let events: any[] = [];
  try { events = JSON.parse(raw)?.events ?? []; } catch { return ladysJson({ error: "BAD_JSON" }, 400); }
  if (!events.length) return ladysJson({ ok: true }); // LINE 後台「Verify」按鈕

  const settings = await ladysSettings();
  for (const ev of events) {
    try { await ladysHandle(ev, settings); } catch (e) { console.error("ladys event error", e instanceof Error ? e.message : e); }
  }
  return ladysJson({ ok: true });
});
