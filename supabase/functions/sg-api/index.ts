// 十神修行錄 — LIFF 前端唯一的後端入口
//   supabase functions deploy sg-api --no-verify-jwt
// 每次請求都帶 LIFF ID token,先向 LINE 驗證,再用 service role 讀寫 sg_users。
// v2:整份遊戲狀態存在 sg_users.sg_state(jsonb);立誓時(notify=vows)推一則 LINE 確認訊息。
//
// secrets:
//   SG_LIFF_CHANNEL_ID            LINE Login channel ID(驗 ID token 的 aud)
//   SG_LINE_CHANNEL_ACCESS_TOKEN  推立誓確認訊息
//   SG_LIFF_URL                   確認訊息上的按鈕連結
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動注入

const LIFF_CHANNEL_ID = Deno.env.get("SG_LIFF_CHANNEL_ID") ?? "";
const LINE_TOKEN = Deno.env.get("SG_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const LIFF_URL = Deno.env.get("SG_LIFF_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_STATE_BYTES = 200_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const C = { plum: "#E3BE2B", plumDeep: "#B8951A", ink: "#1E1E1E", mist: "#F4F4F2", gray: "#7A7A78" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// 失敗原因寫進 log(不含 token 本身),方便查是哪一段沒設好
async function verifyIdToken(idToken: string): Promise<string> {
  if (!LIFF_CHANNEL_ID) throw new Error("NO_CHANNEL_ID");
  if (!idToken) throw new Error("NO_ID_TOKEN");
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LIFF_CHANNEL_ID }),
  });
  if (!res.ok) throw new Error(`LINE_VERIFY_${res.status}:${(await res.text()).slice(0, 120)}`);
  const p = await res.json();
  if (!p?.sub || p.aud !== LIFF_CHANNEL_ID) throw new Error("AUD_MISMATCH");
  return p.sub;
}

const sbHeaders = (prefer = "") => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {}),
});

const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

async function loadState(uid: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sg_users?sg_line_uid=eq.${encodeURIComponent(uid)}&select=sg_state`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`SB_SELECT_${res.status}`);
  const [row] = await res.json();
  return row?.sg_state ?? null;
}

async function saveState(uid: string, s: any) {
  const prof = s?.sg_profile;
  if (!prof || !isDate(prof.sg_birth_date) || !prof.sg_consent_at || !s?.sg_chart) throw new Error("BAD_PROFILE");
  if (JSON.stringify(s).length > MAX_STATE_BYTES) throw new Error("BAD_PROFILE");
  const time = typeof prof.sg_birth_time === "string" && /^\d{2}:\d{2}$/.test(prof.sg_birth_time) ? prof.sg_birth_time : null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sg_users?on_conflict=sg_line_uid`, {
    method: "POST",
    headers: sbHeaders("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({
      sg_line_uid: uid,
      sg_nickname: str(prof.sg_nickname, 12) || "修行者",
      sg_birth_date: prof.sg_birth_date,
      sg_birth_time: time,
      sg_consent_at: new Date(prof.sg_consent_at).toISOString(),
      sg_state: s,
      sg_updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`SB_UPSERT_${res.status}:${(await res.text()).slice(0, 160)}`);
}

// 立誓確認卡
function vowCard(s: any) {
  const wk = s.sg_week;
  const line = (tag: string, text: unknown) => ({
    type: "box", layout: "vertical", spacing: "xs",
    contents: [
      { type: "text", text: tag, size: "xs", color: C.plumDeep, weight: "bold" },
      { type: "text", text: str(text, 120) || "—", size: "sm", color: C.ink, wrap: true },
    ],
  });
  return {
    type: "flex",
    altText: `立誓完成|${str(wk?.sg_oath?.sg_text, 60)}`,
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: C.mist }, footer: { backgroundColor: C.mist } },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "十神修行錄・落款立誓", size: "xs", color: C.gray, weight: "bold" },
          { type: "text", text: `${str(s.sg_profile?.sg_nickname, 12)},第一週修行開始`, size: "lg", color: C.ink, weight: "bold", wrap: true },
          { type: "separator", color: C.plum },
          line("戒律・每日", wk?.sg_precept?.sg_text),
          line("約束・7 天", wk?.sg_bond?.sg_text),
          line("誓言", wk?.sg_oath?.sg_text),
          { type: "text", text: `${str(wk?.sg_start, 10)} – ${str(wk?.sg_end, 10)}・每天 07:30 提醒、21:00 打卡`, size: "xxs", color: C.gray, wrap: true },
        ],
      },
      footer: LIFF_URL ? {
        type: "box", layout: "vertical",
        contents: [{ type: "button", style: "primary", color: C.ink, action: { type: "uri", label: "開始今日修行", uri: LIFF_URL } }],
      } : undefined,
    },
  };
}

async function pushVowCard(uid: string, s: any) {
  if (!LINE_TOKEN || !s?.sg_week) return false;
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to: uid, messages: [vowCard(s)] }),
  });
  if (!res.ok) console.error("sg-api push", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "BAD_JSON" }, 400); }
  let uid: string;
  try { uid = await verifyIdToken(String(body?.idToken ?? "")); } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("sg-api auth", reason);
    return json({ error: "UNAUTHORIZED", reason: reason.split(":")[0] }, 401);
  }
  try {
    if (body.action === "load") return json({ state: await loadState(uid) });
    if (body.action === "save") {
      await saveState(uid, body.state);
      const pushed = body.notify === "vows" ? await pushVowCard(uid, body.state) : false;
      return json({ ok: true, pushed });
    }
    if (body.action === "delete") {
      await fetch(`${SUPABASE_URL}/rest/v1/sg_users?sg_line_uid=eq.${encodeURIComponent(uid)}`, { method: "DELETE", headers: sbHeaders() });
      return json({ ok: true });
    }
    return json({ error: "BAD_ACTION" }, 400);
  } catch (e) {
    console.error("sg-api", e);
    const bad = e instanceof Error && e.message === "BAD_PROFILE";
    return json({ error: bad ? "BAD_PROFILE" : "SERVER" }, bad ? 400 : 500);
  }
});
