// LadyS — LIFF 前端唯一的後端入口
//   supabase functions deploy ladys-api --no-verify-jwt
// 每次請求帶 LIFF ID token → 向 LINE 驗證 → 只放行帳號擁有者與 ladys_members(你、老婆)
// secrets:見 _shared/ladys.ts

import {
  ladysAddDays, ladysDayStartIso, ladysInsert, ladysSelect, ladysSettings, ladysTodayTaipei, ladysUpdate,
} from "../_shared/ladys.ts";

// LIFF 所在的 LINE Login 頻道(LadyS)。頻道 ID 是公開資訊,寫死避免 audience 設錯。
const LADYS_LIFF_CHANNEL_ID = "2012319360";
const LADYS_OWNER_UID = "U55b426b2cefa9787c9c23c97b45963fe";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class LadysBad extends Error {}
const bad = (m: string): never => { throw new LadysBad(m); };

const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isHm = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const str = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
const owner = (o: unknown) => (o === "husband" || o === "wife" ? o : "both");
const now = () => new Date().toISOString();

async function ladysVerify(idToken: string): Promise<string> {
  if (!idToken) bad("NO_ID_TOKEN");
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LADYS_LIFF_CHANNEL_ID }),
  });
  if (!res.ok) throw new Error(`LINE_VERIFY_${res.status}`);
  const p = await res.json();
  if (!p?.sub || p.aud !== LADYS_LIFF_CHANNEL_ID) throw new Error("AUD_MISMATCH");
  return p.sub;
}

async function ladysLoad(uid: string) {
  const today = ladysTodayTaipei();
  const [settings, members, events, expenses, notes] = await Promise.all([
    ladysSettings(),
    ladysSelect("ladys_members", "select=ladys_line_uid,ladys_name,ladys_emoji,ladys_role&order=ladys_created_at.asc"),
    ladysSelect("ladys_events", `ladys_deleted=eq.false&ladys_start_at=gte.${encodeURIComponent(ladysDayStartIso(ladysAddDays(today, -62)))}` +
      `&ladys_start_at=lt.${encodeURIComponent(ladysDayStartIso(ladysAddDays(today, 400)))}&order=ladys_start_at.asc` +
      "&select=id,ladys_title,ladys_start_at,ladys_end_at,ladys_all_day,ladys_location,ladys_owner,ladys_source"),
    ladysSelect("ladys_expenses", `ladys_deleted=eq.false&ladys_date=gte.${ladysAddDays(today, -400)}&order=ladys_date.desc,ladys_created_at.desc` +
      "&select=id,ladys_date,ladys_amount,ladys_category,ladys_payer,ladys_note"),
    ladysSelect("ladys_notes", "ladys_deleted=eq.false&order=ladys_done.asc,ladys_created_at.desc&select=id,ladys_content,ladys_kind,ladys_owner,ladys_done"),
  ]);
  delete settings.ladys_group_id;
  delete settings.ladys_gcal_calendar_id;
  return { me: uid, today, settings, members, events, expenses, notes };
}

function ladysEventRow(b: any) {
  const title = str(b.title, 80) || bad("BAD_TITLE");
  if (!isYmd(b.date)) bad("BAD_DATE");
  const allDay = !isHm(b.time);
  const start = new Date(`${b.date}T${allDay ? "00:00" : b.time}:00+08:00`).toISOString();
  const end = !allDay && isHm(b.end_time) && b.end_time > b.time ? new Date(`${b.date}T${b.end_time}:00+08:00`).toISOString() : null;
  return { ladys_title: title, ladys_start_at: start, ladys_end_at: end, ladys_all_day: allDay, ladys_location: str(b.location, 60), ladys_owner: owner(b.owner) };
}

function ladysExpenseRow(b: any) {
  if (!isYmd(b.date)) bad("BAD_DATE");
  const amount = Math.round(Number(b.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10_000_000) bad("BAD_AMOUNT");
  return { ladys_date: b.date, ladys_amount: amount, ladys_category: str(b.category, 10) || "其他", ladys_payer: owner(b.payer), ladys_note: str(b.note, 60) };
}

function ladysNoteRow(b: any) {
  return {
    ladys_content: str(b.content, 120) || bad("BAD_CONTENT"),
    ladys_kind: b.kind === "goal" ? "goal" : "todo",
    ladys_owner: owner(b.owner),
    ladys_done: b.done === true,
  };
}

const TABLES: Record<string, [string, (b: any) => Record<string, unknown>]> = {
  event: ["ladys_events", ladysEventRow],
  expense: ["ladys_expenses", ladysExpenseRow],
  note: ["ladys_notes", ladysNoteRow],
};

async function ladysSave(kind: string, b: any) {
  const [table, toRow] = TABLES[kind] ?? bad("BAD_KIND");
  const row = { ...toRow(b), ladys_updated_at: now() };
  if (b.id) {
    if (!isUuid(b.id)) bad("BAD_ID");
    const [r] = await ladysUpdate(table, `id=eq.${b.id}&ladys_deleted=eq.false`, row);
    return r ?? bad("NOT_FOUND");
  }
  const [r] = await ladysInsert(table, { ...row, ladys_source: "manual" });
  return r;
}

async function ladysDelete(kind: string, id: unknown) {
  const [table] = TABLES[kind] ?? bad("BAD_KIND");
  if (!isUuid(id)) bad("BAD_ID");
  await ladysUpdate(table, `id=eq.${id}`, { ladys_deleted: true, ladys_updated_at: now() });
}

async function ladysSaveSettings(b: any) {
  const patch: Record<string, unknown> = { ladys_updated_at: now() };
  if (["butler", "secretary", "buddy", "custom"].includes(b.persona)) patch.ladys_persona = b.persona;
  if (b.persona_custom !== undefined) patch.ladys_persona_custom = str(b.persona_custom, 200);
  if (isHm(b.morning_time)) patch.ladys_morning_time = b.morning_time;
  if (isHm(b.nightly_time)) patch.ladys_nightly_time = b.nightly_time;
  for (const k of ["push_empty", "extract_events", "extract_expenses", "extract_notes"]) {
    if (typeof b[k] === "boolean") patch[`ladys_${k}`] = b[k];
  }
  await ladysUpdate("ladys_settings", "id=eq.1", patch);
}

async function ladysSaveMember(b: any) {
  if (typeof b.uid !== "string" || !/^U[0-9a-f]{32}$/.test(b.uid)) bad("BAD_ID");
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.ladys_name = str(b.name, 20) || "成員";
  if (b.role === "husband" || b.role === "wife") patch.ladys_role = b.role;
  if (b.emoji !== undefined) patch.ladys_emoji = str(b.emoji, 4) || "🙂";
  const [r] = await ladysUpdate("ladys_members", `ladys_line_uid=eq.${b.uid}`, patch);
  return r ?? bad("NOT_FOUND");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "BAD_JSON" }, 400); }

  let uid: string;
  try { uid = await ladysVerify(String(body?.idToken ?? "")); } catch (e) {
    console.error("ladys-api auth", e instanceof Error ? e.message : e);
    return json({ error: "UNAUTHORIZED" }, 401);
  }
  try {
    const [m] = await ladysSelect("ladys_members", `ladys_line_uid=eq.${encodeURIComponent(uid)}&select=ladys_line_uid`);
    if (!m && uid !== LADYS_OWNER_UID) return json({ error: "NOT_MEMBER" }, 403);

    const a = String(body.action ?? "");
    if (a === "load") return json(await ladysLoad(uid));
    if (a === "save") return json({ ok: true, row: await ladysSave(body.kind, body.data ?? {}) });
    if (a === "delete") { await ladysDelete(body.kind, body.id); return json({ ok: true }); }
    if (a === "settings") { await ladysSaveSettings(body.data ?? {}); return json({ ok: true }); }
    if (a === "member") return json({ ok: true, row: await ladysSaveMember(body.data ?? {}) });
    return json({ error: "BAD_ACTION" }, 400);
  } catch (e) {
    if (e instanceof LadysBad) return json({ error: e.message }, 400);
    console.error("ladys-api", e instanceof Error ? e.message : e);
    return json({ error: "SERVER" }, 500);
  }
});
