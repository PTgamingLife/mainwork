import crypto from "node:crypto";

export const db = { members: [], messages: [], daily: [], revenue: [], state: [] };
export const calls = { anthropic: [], lineReply: [], linePush: [], quotaOk: true };
export let anthropicQueue = [];
export const setAnthropicQueue = (q) => { anthropicQueue = q; };

const SECRET = "test-secret";
const SB = "https://sb.example.co";

globalThis.Deno = {
  env: {
    get: (k) => ({
      COFOUNDER_LINE_CHANNEL_SECRET: SECRET,
      COFOUNDER_LINE_CHANNEL_ACCESS_TOKEN: "line-token",
      COFOUNDER_BIND_CODE: "GO123",
      ANTHROPIC_API_KEY: "ak",
      SUPABASE_URL: SB,
      SUPABASE_SERVICE_ROLE_KEY: "svc",
    }[k]),
  },
  serve: (h) => { globalThis.__handler = h; },
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : null;

  if (u.startsWith("https://api.anthropic.com")) {
    calls.anthropic.push({ model: body.model, system: body.system, messages: body.messages });
    const next = anthropicQueue.shift();
    if (!next) throw new Error("anthropic queue empty");
    return json(next);
  }
  if (u.includes("/message/reply")) { calls.lineReply.push(body.messages[0].text); return json({}); }
  if (u.includes("/message/push")) { calls.linePush.push(body.messages[0].text); return json({}); }

  if (u.includes("/rpc/cofounder_consume_quota")) return json(calls.quotaOk);

  const table = u.slice(`${SB}/rest/v1/`.length).split("?")[0];
  const qs = new URLSearchParams(u.split("?")[1] ?? "");

  if (init.method === "POST") {
    if (table === "cofounder_members") {
      const row = { id: "m-new", line_user_id: body.line_user_id, display_name: "" };
      db.members.push(row);
      return json([row], 201);
    }
    if (table === "cofounder_messages") {
      const eid = body.line_event_id;
      if (eid && db.messages.some((m) => m.line_event_id === eid)) {
        return new Response('{"code":"23505","message":"duplicate key"}', { status: 409 });
      }
      db.messages.push(body);
      return json([], 201);
    }
    if (table === "cofounder_daily") { db.daily.push(body); return json([], 201); }
    if (table === "cofounder_revenue") { db.revenue.push(body); return json([], 201); }
    if (table === "cofounder_state") { db.state.push(body); return json([], 201); }
    return json([], 201);
  }

  // GET
  if (table === "cofounder_members") {
    const want = decodeURIComponent((qs.get("line_user_id") ?? "").replace("eq.", ""));
    return json(db.members.filter((m) => m.line_user_id === want));
  }
  if (table === "cofounder_state") return json([{ data: { system_prompt: "你是合夥人", meta: { phase: "M1" } } }]);
  if (table === "cofounder_daily") return json(db.daily);
  if (table === "cofounder_messages") return json([]);
  return json([]);
};

export function sign(body) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}

export function reset() {
  db.members = []; db.messages = []; db.daily = []; db.revenue = []; db.state = [];
  calls.anthropic = []; calls.lineReply = []; calls.linePush = []; calls.quotaOk = true;
}

export async function post(payload, { badSig = false } = {}) {
  const raw = JSON.stringify(payload);
  const req = new Request("https://fn.example/cofounder-line", {
    method: "POST",
    headers: { "x-line-signature": badSig ? "bad" : sign(raw), "content-type": "application/json" },
    body: raw,
  });
  return await globalThis.__handler(req);
}
