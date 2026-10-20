// 十神修行錄 — 每日推播(由 pg_cron → public.sg_push_call(mode) 呼叫)
//   supabase functions deploy sg-push --no-verify-jwt
//   morning(台北 07:30):今日戒律 + 約束提醒
//   evening(台北 21:00):今天還沒打卡的人才推
//
// secrets:
//   SG_LINE_CHANNEL_ACCESS_TOKEN  Messaging API channel access token
//   SG_LIFF_URL                   https://liff.line.me/<LIFF ID>
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動注入

const LINE_TOKEN = Deno.env.get("SG_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const LIFF_URL = Deno.env.get("SG_LIFF_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SG_NAMES: Record<string, string> = {
  bi_jian: "同好", jie_cai: "同盟", shi_shen: "匠心", shang_guan: "鋒芒", zheng_cai: "積累",
  pian_cai: "獵機", zheng_guan: "自律", qi_sha: "掌局", zheng_yin: "學識", pian_yin: "閱歷",
};
const C = { gold: "#C9A227", goldDeep: "#9C7A14", ink: "#1B2440", paper: "#F5F0E6", muted: "#6B6458" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function sbSelect(table: string, query: string, tries = 3): Promise<any[]> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders });
    if (res.ok) return await res.json();
    last = res.status;
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw new Error(`SB_SELECT_${last}`);
}

function todayTaipei(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function card(title: string, lines: { tag: string; text: string }[], button: string) {
  return {
    type: "flex",
    altText: `${title}|${lines[0]?.text ?? ""}`.slice(0, 380),
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: C.paper }, footer: { backgroundColor: C.paper } },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "十神修行錄", size: "xs", color: C.goldDeep, weight: "bold" },
          { type: "text", text: title, size: "lg", color: C.ink, weight: "bold", wrap: true },
          { type: "separator", color: C.gold },
          ...lines.map((l) => ({
            type: "box", layout: "vertical", spacing: "xs",
            contents: [
              { type: "text", text: l.tag, size: "xs", color: C.goldDeep, weight: "bold" },
              { type: "text", text: l.text, size: "sm", color: C.ink, wrap: true },
            ],
          })),
        ],
      },
      footer: LIFF_URL ? {
        type: "box", layout: "vertical",
        contents: [{ type: "button", style: "primary", color: C.gold, action: { type: "uri", label: button, uri: LIFF_URL } }],
      } : undefined,
    },
  };
}

async function push(to: string, messages: unknown[]): Promise<boolean> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) console.error("sg-push LINE", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const key = req.headers.get("x-sg-key") ?? "";
  try {
    const [auth] = await sbSelect("sg_push_auth", "id=eq.1&select=token");
    if (!key || !auth?.token || key !== auth.token) return json({ error: "UNAUTHORIZED" }, 401);
  } catch {
    return json({ error: "AUTH_LOOKUP" }, 503);
  }
  if (!LINE_TOKEN) return json({ error: "NO_LINE_TOKEN" }, 500);

  let mode = "";
  try { mode = (await req.json())?.mode ?? ""; } catch { /* empty body */ }
  if (mode !== "morning" && mode !== "evening") return json({ error: "BAD_MODE" }, 400);

  const today = todayTaipei();
  const users = await sbSelect("sg_users", "sg_push_on=eq.true&select=sg_id,sg_line_uid,sg_nickname");
  if (!users.length) return json({ ok: true, sent: 0 });
  const ids = users.map((u) => u.sg_id).join(",");
  const vows = await sbSelect("sg_vows", `sg_user_id=in.(${ids})&sg_status=eq.active&select=sg_user_id,sg_kind,sg_god,sg_text,sg_end`);
  const done = mode === "evening"
    ? new Set((await sbSelect("sg_checkins", `sg_user_id=in.(${ids})&sg_date=eq.${today}&select=sg_user_id`)).map((r) => r.sg_user_id))
    : new Set<string>();

  let sent = 0, failed = 0;
  for (const u of users) {
    const mine = vows.filter((v) => v.sg_user_id === u.sg_id);
    const precept = mine.find((v) => v.sg_kind === "precept");
    const bond = mine.find((v) => v.sg_kind === "bond");
    const oath = mine.find((v) => v.sg_kind === "oath");
    if (!precept || !oath) continue;
    if (mode === "evening" && done.has(u.sg_id)) continue;
    const lines = [{ tag: `戒律・${SG_NAMES[precept.sg_god] ?? ""}`, text: precept.sg_text }];
    if (bond && (!bond.sg_end || bond.sg_end >= today)) lines.push({ tag: `約束・${SG_NAMES[bond.sg_god] ?? ""}`, text: bond.sg_text });
    lines.push({ tag: "誓言", text: oath.sg_text });
    const msg = mode === "morning"
      ? card(`${u.sg_nickname},今日的修行`, lines, "開始今日修行")
      : card(`${u.sg_nickname},今天還沒落印`, [{ tag: "提醒", text: "花 30 秒回報今天的戒律、約束與誓言進度,守住連續天數。" }, ...lines.slice(0, 1)], "落印打卡");
    (await push(u.sg_line_uid, [msg])) ? sent++ : failed++;
  }
  return json({ ok: true, mode, sent, failed });
});
