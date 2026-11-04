// LadyS — LINE webhook(OA 陳柏廷 Po-Ting)
//   supabase functions deploy ladys-webhook --no-verify-jwt
// 流程:驗簽 → 群組白名單 → 文字訊息存 ladys_messages(晚上整理)→ 關鍵字指令用 reply 回(不吃推播額度)
// 群組平常完全不插話。綁定:在群組輸入「LadyS 綁定 <LADYS_BIND_CODE>」。
// secrets:見 _shared/ladys.ts,另加 LADYS_BIND_CODE

import {
  LADYS_LINE_SECRET, ladysAddDays, ladysCard, ladysDayLabel, ladysEventLine, ladysEventsBetween,
  ladysGroupByDay, ladysInsert, ladysJson, ladysLine, ladysReply, ladysSelect,
  ladysMask, ladysSettings, ladysTodayTaipei, ladysUpdate, LADYS_OWNER_LABEL,
} from "../_shared/ladys.ts";
import { ladysProcessPending } from "../_shared/ladys-extract.ts";
import { ladysExpandYearly, ladysYearlyEvents } from "../_shared/ladys-life.ts";
import { ladysImageToText } from "../_shared/ladys-image.ts";

const LADYS_BIND_CODE = Deno.env.get("LADYS_BIND_CODE") ?? "";
// 帳號擁有者(陳柏廷)的 LINE userId,沿用既有每日推播的 LINE_USER_ID;還沒綁定群組前也能用一對一指令
const LADYS_OWNER_UID = "U55b426b2cefa9787c9c23c97b45963fe";
const enc = new TextEncoder();
const LADYS_COMMANDS = ["行程", "帳", "目標", "待辦", "瑣事", "選單", "更新行事曆", "記憶圖片"];

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
  // 新成員也套上 LadyS 圖文選單(若已設定)
  try {
    const { richmenus = [] } = await ladysLine("richmenu/list", undefined, "GET");
    const menu = richmenus.find((r: any) => r.name === "ladys-main");
    if (menu) await ladysLine(`user/${uid}/richmenu/${menu.richMenuId}`);
  } catch (e) { console.error("ladys link richmenu", e instanceof Error ? e.message : e); }
}

async function ladysIsMember(uid: string): Promise<boolean> {
  const [m] = await ladysSelect("ladys_members", `ladys_line_uid=eq.${encodeURIComponent(uid)}&select=ladys_line_uid`);
  return !!m;
}

// ---------- 指令 ----------
async function ladysCmdSchedule() {
  const today = ladysTodayTaipei();
  const events = [
    ...(await ladysEventsBetween(today, ladysAddDays(today, 8))),
    ...ladysExpandYearly(await ladysYearlyEvents(), today, ladysAddDays(today, 8)),
  ].sort((a, b) => a.ladys_start_at.localeCompare(b.ladys_start_at));
  const byDay = ladysGroupByDay(events);
  const lines: string[] = [];
  for (const [day, list] of byDay) {
    lines.push(`【${ladysDayLabel(day)}${day === today ? " 今天" : ""}】`);
    for (const e of list) lines.push(ladysEventLine(e));
  }
  return ladysCard("未來 7 天行程", lines.length ? lines : ["這 7 天沒有安排 🌿"], { view: "calendar" });
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
  return ladysCard(`${Number(today.slice(5, 7))} 月支出`, lines, { view: "money" });
}

async function ladysCmdNotes(goal: boolean) {
  const rows = await ladysSelect("ladys_notes",
    `ladys_deleted=eq.false&ladys_done=eq.false&ladys_kind=${goal ? "eq.goal" : "neq.goal"}&order=ladys_created_at.desc&limit=20&select=*`);
  const lines = rows.map((r) => `${goal ? "🎯" : "☐"} ${LADYS_OWNER_LABEL[r.ladys_owner as "both"] ?? ""} ${r.ladys_content}`);
  return goal
    ? ladysCard("進行中的目標", lines.length ? lines : ["還沒有目標 🌱"], { view: "goals" })
    : ladysCard("未完成待辦", lines.length ? lines : ["全部完成了 ✨"], { view: "todos" });
}

function ladysCmdMenu() {
  return ladysCard("LadyS 選單", ["想看什麼?點下面的圓圈 👇"], { view: "calendar" });
}

// 「更新行事曆」:立刻整理到目前為止還沒整理的對話(與晚間整理同一套邏輯),用 reply 回覆不吃推播額度
async function ladysCmdUpdateNow() {
  try {
    const r = await ladysProcessPending("剛剛的對話整理好了");
    if (r.card) return r.card;
    return { type: "text", text: r.status === "empty" ? "目前沒有新的對話需要整理 👌" : "看過新的對話了,沒有需要記錄的行程、支出、目標或待辦 👌" };
  } catch (e) {
    console.error("ladys update-now", e instanceof Error ? e.message : e);
    return { type: "text", text: "整理時出了點問題,晚上 23:00 會再自動整理一次 🙏" };
  }
}

// 「記憶圖片」:必須「回覆」一張圖片輸入。讀出文字 → 當成一則對話 → 立刻用一般整理流程分類(行程/支出/待辦/目標/生活紀錄)
const LADYS_IMG_ERR: Record<string, string> = {
  IMG_GONE: "這張圖片已經過期,LINE 不再提供下載了,請重新傳一次再回覆它 🙏",
  IMG_TOO_BIG: "圖片太大了,請截小一點再傳 🙏",
  IMG_NOT_IMAGE: "回覆的不是圖片喔,請長按圖片 →「回覆」→ 輸入「記憶圖片」",
};
async function ladysCmdMemoryImage(ev: any, groupId: string) {
  const quoted = String(ev.message?.quotedMessageId ?? "");
  if (!quoted) return { type: "text", text: "請長按要記的圖片 →「回覆」→ 輸入「記憶圖片」📸" };
  try {
    const text = await ladysImageToText(quoted);
    if (!text) return { type: "text", text: "這張圖片沒有讀到文字 🤔" };
    const inserted = await ladysInsert("ladys_messages?on_conflict=ladys_line_msg_id", {
      ladys_line_msg_id: `img-${quoted}`,
      ladys_group_id: groupId,
      ladys_user_uid: ev.source?.userId ?? null,
      ladys_text: ladysMask(`[圖片文字]\n${text}`).slice(0, 3000),
      ladys_sent_at: new Date(Number(ev.timestamp)).toISOString(),
    }, "resolution=ignore-duplicates,return=representation");
    if (!inserted.length) return { type: "text", text: "這張圖片之前已經記過了 👌" };
    const r = await ladysProcessPending("圖片記好了 📸");
    return r.card ?? { type: "text", text: "看完圖片了,沒有需要記錄的行程、支出、目標、待辦或生活紀錄 👌" };
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    console.error("ladys memory-image", code);
    return { type: "text", text: LADYS_IMG_ERR[code] ?? "讀圖片時出了點問題,請稍後再試一次 🙏" };
  }
}

async function ladysRunCommand(text: string, ev?: any, groupId = "") {
  switch (text) {
    case "記憶圖片": return await ladysCmdMemoryImage(ev, groupId);
    case "更新行事曆": return await ladysCmdUpdateNow();
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
      await ladysReply(ev.replyToken, [await ladysRunCommand(text, ev, gid)]);
      return;
    }
    await ladysInsert("ladys_messages?on_conflict=ladys_line_msg_id", {
      ladys_line_msg_id: String(ev.message.id),
      ladys_group_id: gid,
      ladys_user_uid: uid || null,
      ladys_text: ladysMask(text).slice(0, 2000), // 敏感資訊先遮蔽才落地
      ladys_sent_at: new Date(Number(ev.timestamp)).toISOString(),
    }, "resolution=ignore-duplicates,return=minimal");
    return;
  }

  // 一對一聊天室:只回應帳號擁有者與成員(你、老婆)的指令,其他人一律不理
  if (src.type === "user" && uid && LADYS_COMMANDS.includes(text) && (uid === LADYS_OWNER_UID || await ladysIsMember(uid))) {
    await ladysReply(ev.replyToken, [await ladysRunCommand(text, ev, boundGroup ?? "direct")]);
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
