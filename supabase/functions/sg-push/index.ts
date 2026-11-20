// 十神修行錄 — 每日推播(由 pg_cron → public.sg_push_call(mode) 呼叫)
//   supabase functions deploy sg-push --no-verify-jwt
//   morning(台北 07:30):角色與今天最容易的分心、專注目標(誓言)、要守住的戒律
//   evening(台北 21:00):今天還沒打卡的人才推,附今日專注分鐘;一週結束後改推「一週專注結算」
//
// secrets:
//   SG_LINE_CHANNEL_ACCESS_TOKEN  Messaging API channel access token
//   SG_LIFF_URL                   https://liff.line.me/<LIFF ID>
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動注入

const LINE_TOKEN = Deno.env.get("SG_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const LIFF_URL = Deno.env.get("SG_LIFF_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 配色 A 煙雨水墨
const C = { gold: "#E3BE2B", goldDeep: "#B8951A", ink: "#1E1E1E", paper: "#F4F4F2", muted: "#7A7A78" };

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

// 八字角色(與前端 SG_ROLES / sgRole 相同):命盤十神分數加總成五種能量,最強者決定角色
const SG_ENERGY_OF: Record<string, number> = {
  shi_shen: 0, shang_guan: 0, zheng_cai: 1, pian_cai: 1, zheng_guan: 2, qi_sha: 2, zheng_yin: 3, pian_yin: 3, bi_jian: 4, jie_cai: 4,
};
const SG_ROLES = [["匠師", "點子跳躍"], ["行商", "機會追逐"], ["將帥", "完美控制"], ["謀士", "過度研究"], ["俠客", "社交分心"]];

function sgRoleOf(state: any): { name: string; distract: string } | null {
  const scores = state?.sg_chart?.sg_scores;
  if (!scores) return null;
  const e = [0, 0, 0, 0, 0];
  for (const [k, v] of Object.entries(scores)) if (k in SG_ENERGY_OF) e[SG_ENERGY_OF[k]] += Number(v) || 0;
  const s = [0, 1, 2, 3, 4].sort((a, b) => e[a] - e[b])[4];
  return { name: SG_ROLES[s][0], distract: SG_ROLES[s][1] };
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
        contents: [{ type: "button", style: "primary", color: C.ink, action: { type: "uri", label: button, uri: LIFF_URL } }],
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
  // v2:遊戲狀態整份存在 sg_users.sg_state
  const users = await sbSelect("sg_users", "sg_push_on=eq.true&select=sg_line_uid,sg_nickname,sg_state");
  let sent = 0, failed = 0;
  for (const u of users) {
    const wk = u.sg_state?.sg_week;
    if (!wk?.sg_precept || !wk?.sg_oath) continue;
    if (mode === "evening" && u.sg_state?.sg_checkins?.[today]) continue;
    const ended = today > wk.sg_end;
    let msg;
    if (ended) {
      // 一週到了:兩個時段都只提醒填回顧(結算能量)
      msg = card(`${u.sg_nickname},一週專注結算`, [{ tag: "結算", text: "看這週專注了幾分鐘、完成率多少,填回顧讓能量進化。" }], "填寫修行回顧");
    } else if (mode === "morning") {
      const role = sgRoleOf(u.sg_state);
      msg = card(`${u.sg_nickname},今天的專注目標`, [
        ...(role ? [{ tag: "你的角色", text: `${role.name}・今天最容易「${role.distract}」` }] : []),
        { tag: "專注目標", text: wk.sg_oath.sg_text },
        { tag: "守住", text: wk.sg_precept.sg_text },
      ], "開始專注");
    } else {
      const min = Math.round(Number(u.sg_state?.sg_idle?.si_focus?.[today]?.m) || 0);
      msg = card(`${u.sg_nickname},今天專注了嗎?`, [
        { tag: "提醒", text: "花 30 秒回報今天的專注,再進試煉場專注 20 分鐘。" },
        { tag: "今日專注", text: min ? `${min} 分鐘` : "還沒開始,現在專注 20 分鐘也來得及" },
      ], "回報今天的專注");
    }
    (await push(u.sg_line_uid, [msg])) ? sent++ : failed++;
  }
  return json({ ok: true, mode, sent, failed });
});
