// 十神修行錄 — LIFF 前端唯一的後端入口
//   supabase functions deploy sg-api --no-verify-jwt
// 每次請求都帶 LIFF ID token,先向 LINE 驗證,再用 service role 讀寫 sg_users。
// v2:整份遊戲狀態存在 sg_users.sg_state(jsonb);立誓時(notify=vows)推一則 LINE 確認訊息。
//
// secrets:
//   SG_LINE_CHANNEL_ACCESS_TOKEN  推立誓確認訊息
//   SG_LIFF_URL                   確認訊息上的按鈕連結
//   OPENAI_API_KEY / OPENAI_TEXT_MODEL  AI 整理立誓選項、許願(合計每人每天 5 次)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動注入

// LIFF 所在的 LINE Login 頻道(AIbot_focus)。頻道 ID 是公開資訊,直接寫死,
// 避免 secret 填成 Messaging API 頻道而出現「Invalid IdToken Audience」。
const LIFF_CHANNEL_ID = "2011684838";
const LINE_TOKEN = Deno.env.get("SG_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const LIFF_URL = Deno.env.get("SG_LIFF_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_STATE_BYTES = 200_000;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-5-mini";
const AI_DAILY_LIMIT = 5;
const ENERGY_NAMES = ["創造力", "生產力", "制約力", "解析力", "群眾力"];

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

// ---- AI 整理立誓選項 ----
function todayTaipei(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function rank(E: number[]) {
  const idx = [0, 1, 2, 3, 4].sort((a, b) => E[a] - E[b]);
  return { s: idx[4], w: idx[0], w2: idx[1] };
}

const OPTION_TEXT = { type: "string" }; // 長度由 pick() 截斷(嚴格模式不一定支援 minLength/maxLength)
const SUGGEST_SCHEMA = {
  type: "object", additionalProperties: false, required: ["oaths", "precepts", "bonds"],
  properties: {
    oaths: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "energy"], properties: { text: OPTION_TEXT, energy: { type: "string", enum: ENERGY_NAMES } } } },
    precepts: { type: "array", items: { type: "object", additionalProperties: false, required: ["text"], properties: { text: OPTION_TEXT } } },
    bonds: { type: "array", items: { type: "object", additionalProperties: false, required: ["text"], properties: { text: OPTION_TEXT } } },
  },
};

async function takeAiQuota(uid: string): Promise<boolean> {
  const today = todayTaipei();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sg_users?sg_line_uid=eq.${encodeURIComponent(uid)}&select=sg_ai_date,sg_ai_count`, { headers: sbHeaders() });
  const [row] = res.ok ? await res.json() : [];
  if (!row) throw new Error("NO_USER");
  const count = row.sg_ai_date === today ? row.sg_ai_count : 0;
  if (count >= AI_DAILY_LIMIT) return false;
  await fetch(`${SUPABASE_URL}/rest/v1/sg_users?sg_line_uid=eq.${encodeURIComponent(uid)}`, {
    method: "PATCH", headers: sbHeaders("return=minimal"), body: JSON.stringify({ sg_ai_date: today, sg_ai_count: count + 1 }),
  });
  return true;
}

async function suggestVows(body: any) {
  const E = Array.isArray(body.energies) && body.energies.length === 5 ? body.energies.map((v: unknown) => Number(v) || 0) : null;
  if (!E) throw new Error("BAD_INPUT");
  const oathWish = str(body.oath_wish, 200);
  const preceptWish = str(body.precept_wish, 200);
  if (oathWish.length < 2) throw new Error("BAD_INPUT");
  const { s, w, w2 } = rank(E);
  const system = `你是「十神修行錄」的修行教練。使用者的五種能量:${ENERGY_NAMES.map((n, i) => `${n} ${E[i].toFixed(2)}`).join("、")}。
最旺:${ENERGY_NAMES[s]};最弱:${ENERGY_NAMES[w]};第二弱:${ENERGY_NAMES[w2]}。
請產生三類選項,各剛好 3 個,使用繁體中文,每個 15–60 字,具體、可在日常執行、可被檢核:
1. oaths(誓言):保留使用者誓言的原意,改寫成 30 天內可衡量的目標;energy 填這個誓言主要需要的能量。
2. precepts(戒律,每日):${preceptWish ? "使用者已寫下想遵守的戒律,三個選項都必須以它為主體改寫,保留其中的關鍵行為、對象與數字;再融入" : "寫法是"}「在${ENERGY_NAMES[s]}容易用過頭的情境,改用${ENERGY_NAMES[w]}的做法」,用最弱的能量節制最旺的能量。
3. bonds(約束,7 天挑戰):補足「${ENERGY_NAMES[w2]}」,寫成 7 天內每天或累計可完成的具體挑戰。
不要提八字、十神術語,不要醫療、投資或保證性承諾。`;
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL, store: false,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify({ 我想立下的誓言: oathWish, 我想遵守的戒律: preceptWish || "(未填)" }) }] },
      ],
      text: { format: { type: "json_schema", name: "sg_vow_options", strict: true, schema: SUGGEST_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`OPENAI_${res.status}:${(await res.text()).slice(0, 200)}`);
  const payload = await res.json();
  let text = "";
  for (const item of payload.output ?? []) for (const part of item.content ?? []) if (part.type === "output_text") text = part.text;
  const out = JSON.parse(text);
  console.log("sg-api suggest", JSON.stringify({ oaths: out.oaths?.length, precepts: out.precepts?.length, bonds: out.bonds?.length }));
  const pick = (arr: any[]) => (Array.isArray(arr) ? arr : []).slice(0, 3).map((o) => ({ ...o, text: str(o.text, 80) })).filter((o) => o.text);
  return {
    s, w, w2,
    oaths: pick(out.oaths).map((o: any) => ({ text: o.text, energy: Math.max(0, ENERGY_NAMES.indexOf(o.energy)) })),
    precepts: pick(out.precepts).map((o: any) => ({ text: o.text })),
    bonds: pick(out.bonds).map((o: any) => ({ text: o.text })),
  };
}

// ---- 許願:AI 依願望內容決定消耗哪些能量(每格不超過可用量、總和 2),並由天使回應 ----
const WISH_COST = 2;
const WISH_SCHEMA = {
  type: "object", additionalProperties: false, required: ["cost", "blessing", "action"],
  properties: {
    cost: { type: "object", additionalProperties: false, required: ENERGY_NAMES, properties: Object.fromEntries(ENERGY_NAMES.map((n) => [n, { type: "number" }])) },
    blessing: { type: "string" },
    action: { type: "string" },
  },
};

function fitCost(raw: number[], pool: number[]) {
  const cost = pool.map((p, i) => Math.min(p, Math.max(0, Number(raw[i]) || 0)));
  let sum = cost.reduce((a, b) => a + b, 0);
  if (sum > WISH_COST) cost.forEach((c, i) => { cost[i] = c * WISH_COST / sum; });
  sum = cost.reduce((a, b) => a + b, 0);
  [0, 1, 2, 3, 4].sort((a, b) => (pool[b] - cost[b]) - (pool[a] - cost[a])).forEach((i) => {
    const need = WISH_COST - sum;
    if (need <= 1e-9) return;
    const add = Math.min(need, pool[i] - cost[i]);
    cost[i] += add; sum += add;
  });
  return cost.map((v) => Math.round(v * 100) / 100);
}

async function makeWish(body: any) {
  const pool = Array.isArray(body.pool) && body.pool.length === 5 ? body.pool.map((v: unknown) => Math.max(0, Number(v) || 0)) : null;
  const wish = str(body.wish, 120);
  if (!pool || wish.length < 2) throw new Error("BAD_INPUT");
  if (pool.reduce((a: number, b: number) => a + b, 0) < WISH_COST - 1e-9) throw new Error("NOT_ENOUGH");
  const angel = str(body.angel_name, 8) || "守護天使";
  const trait = str(body.angel_trait, 60);
  const system = `你是守護天使「${angel}」,個性:${trait}。使用者用修行累積的能量向你許願。
可用的修行能量:${ENERGY_NAMES.map((n, i) => `${n} ${pool[i].toFixed(2)}`).join("、")}。
1. cost:依願望內容判斷實現它最需要哪些能量,分配消耗量,總和必須剛好 ${WISH_COST},每一項不得超過該能量的可用量,用不到的填 0。
2. blessing:用你的個性回應這個願望,40–80 字,溫暖具體,不保證結果。
3. action:給一個今天就能做、10–30 分鐘內完成的具體小行動,20–50 字。
使用繁體中文,不要提八字、十神術語,不給醫療、投資或法律建議。`;
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL, store: false,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: wish }] },
      ],
      text: { format: { type: "json_schema", name: "sg_wish", strict: true, schema: WISH_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`OPENAI_${res.status}:${(await res.text()).slice(0, 200)}`);
  const payload = await res.json();
  let text = "";
  for (const item of payload.output ?? []) for (const part of item.content ?? []) if (part.type === "output_text") text = part.text;
  const out = JSON.parse(text);
  return {
    cost: fitCost(ENERGY_NAMES.map((n) => out.cost?.[n]), pool),
    blessing: str(out.blessing, 160),
    action: str(out.action, 100),
  };
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
    if (body.action === "suggest") {
      if (!OPENAI_KEY) return json({ error: "AI_UNAVAILABLE" }, 503);
      if (!(await takeAiQuota(uid))) return json({ error: "AI_LIMIT" }, 429);
      return json({ ok: true, options: await suggestVows(body) });
    }
    if (body.action === "wish") {
      if (!OPENAI_KEY) return json({ error: "AI_UNAVAILABLE" }, 503);
      if (!(await takeAiQuota(uid))) return json({ error: "AI_LIMIT" }, 429);
      return json({ ok: true, wish: await makeWish(body) });
    }
    if (body.action === "delete") {
      await fetch(`${SUPABASE_URL}/rest/v1/sg_users?sg_line_uid=eq.${encodeURIComponent(uid)}`, { method: "DELETE", headers: sbHeaders() });
      return json({ ok: true });
    }
    return json({ error: "BAD_ACTION" }, 400);
  } catch (e) {
    console.error("sg-api", e);
    const msg = e instanceof Error ? e.message : "";
    const bad = ["BAD_PROFILE", "BAD_INPUT", "NO_USER", "NOT_ENOUGH"].includes(msg);
    return json({ error: bad ? msg : "SERVER" }, bad ? 400 : 500);
  }
});
