// 十神修行錄 — LIFF 前端唯一的後端入口
//   supabase functions deploy sg-api --no-verify-jwt
// 每次請求都帶 LIFF ID token,先向 LINE 驗證,再用 service role 讀寫 sg_ 表。
//
// secrets:
//   SG_LIFF_CHANNEL_ID   LINE Login channel ID(驗 ID token 的 aud)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動注入

const LIFF_CHANNEL_ID = Deno.env.get("SG_LIFF_CHANNEL_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SG_GODS = ["bi_jian", "jie_cai", "shi_shen", "shang_guan", "zheng_cai", "pian_cai", "zheng_guan", "qi_sha", "zheng_yin", "pian_yin"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function verifyIdToken(idToken: string): Promise<string> {
  if (!idToken || !LIFF_CHANNEL_ID) throw new Error("UNAUTHORIZED");
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LIFF_CHANNEL_ID }),
  });
  if (!res.ok) throw new Error("UNAUTHORIZED");
  const p = await res.json();
  if (!p?.sub || p.aud !== LIFF_CHANNEL_ID) throw new Error("UNAUTHORIZED");
  return p.sub;
}

// ---- Supabase REST(service role)----
const sbHeaders = (prefer = "") => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {}),
});

async function sbSelect(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`SB_SELECT_${res.status}`);
  return await res.json();
}

async function sbUpsert(table: string, rows: unknown, onConflict: string, ret = false): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: sbHeaders(`resolution=merge-duplicates,return=${ret ? "representation" : "minimal"}`),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`SB_UPSERT_${table}_${res.status}:${(await res.text()).slice(0, 160)}`);
  return ret ? await res.json() : [];
}

async function sbPatch(table: string, query: string, patch: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH", headers: sbHeaders("return=minimal"), body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`SB_PATCH_${table}_${res.status}`);
}

// ---- 驗證工具 ----
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);
const pct = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const godOrNull = (g: unknown) => (SG_GODS.includes(String(g)) ? String(g) : null);

function cleanScores(s: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of SG_GODS) out[k] = Math.max(0, Math.min(100, Number(s?.[k]) || 0));
  return out;
}

function cleanAnswers(a: any): Record<string, number> | null {
  if (!a) return null;
  const out: Record<string, number> = {};
  for (const k of SG_GODS) {
    const v = Number(a[k]);
    if (!(v >= 1 && v <= 5)) return null;
    out[k] = Math.round(v);
  }
  return out;
}

// ---- load:組回前端的 state 格式 ----
async function loadState(uid: string) {
  const [u] = await sbSelect("sg_users", `sg_line_uid=eq.${encodeURIComponent(uid)}&select=*`);
  if (!u) return null;
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const [charts, assess, vows, checkins] = await Promise.all([
    sbSelect("sg_charts", `sg_user_id=eq.${u.sg_id}&select=*`),
    sbSelect("sg_assess", `sg_user_id=eq.${u.sg_id}&select=sg_answers`),
    sbSelect("sg_vows", `sg_user_id=eq.${u.sg_id}&sg_status=eq.active&select=*`),
    sbSelect("sg_checkins", `sg_user_id=eq.${u.sg_id}&sg_date=gte.${since}&select=*`),
  ]);
  const c = charts[0];
  const vowOf = (k: string) => vows.find((v) => v.sg_kind === k);
  const p = vowOf("precept"), b = vowOf("bond"), o = vowOf("oath");
  const checkinMap: Record<string, unknown> = {};
  const amuletUsed: string[] = [];
  for (const r of checkins) {
    if (r.sg_amulet) { amuletUsed.push(r.sg_date); continue; }
    checkinMap[r.sg_date] = {
      sg_precept_ok: r.sg_precept_ok, sg_bond_ok: r.sg_bond_ok, sg_oath_pct: r.sg_oath_pct, sg_note: r.sg_note ?? "", sg_at: r.sg_at,
    };
  }
  return {
    sg_profile: {
      sg_nickname: u.sg_nickname, sg_birth_date: u.sg_birth_date,
      sg_birth_time: u.sg_birth_time ? String(u.sg_birth_time).slice(0, 5) : null, sg_consent_at: u.sg_consent_at,
    },
    sg_chart: c ? {
      sg_pillars: c.sg_pillars, sg_scores: c.sg_scores, sg_yima: c.sg_yima,
      sg_hour_known: c.sg_hour_known, sg_near_jie: c.sg_near_jie, sg_day_master: c.sg_pillars?.day?.stem,
    } : null,
    sg_assess: assess[0]?.sg_answers ?? null,
    sg_vows: p && b && o ? {
      sg_precept: { sg_god: p.sg_god, sg_mode: p.sg_mode, sg_text: p.sg_text, sg_start: p.sg_start },
      sg_bond: { sg_god: b.sg_god, sg_text: b.sg_text, sg_start: b.sg_start, sg_end: b.sg_end },
      sg_oath: { sg_text: o.sg_text, sg_start: o.sg_start, sg_end: o.sg_end, sg_pct: o.sg_pct },
    } : null,
    sg_checkins: checkinMap,
    sg_amulets: u.sg_amulets,
    sg_amulet_used: amuletUsed,
  };
}

// ---- save:前端整包 state 寫回(只接受驗證過的欄位)----
async function saveState(uid: string, s: any) {
  const prof = s?.sg_profile;
  if (!prof || !isDate(prof.sg_birth_date) || !prof.sg_consent_at) throw new Error("BAD_PROFILE");
  const time = prof.sg_birth_time && /^\d{2}:\d{2}$/.test(prof.sg_birth_time) ? prof.sg_birth_time : null;
  const [u] = await sbUpsert("sg_users", {
    sg_line_uid: uid,
    sg_nickname: str(prof.sg_nickname, 12) || "修行者",
    sg_birth_date: prof.sg_birth_date,
    sg_birth_time: time,
    sg_consent_at: new Date(prof.sg_consent_at).toISOString(),
    sg_amulets: Math.max(0, Math.min(99, Math.round(Number(s.sg_amulets) || 0))),
    sg_updated_at: new Date().toISOString(),
  }, "sg_line_uid", true);
  const id = u.sg_id;

  const c = s.sg_chart;
  if (c?.sg_pillars) {
    await sbUpsert("sg_charts", {
      sg_user_id: id, sg_pillars: c.sg_pillars, sg_scores: cleanScores(c.sg_scores),
      sg_yima: Array.isArray(c.sg_yima) ? c.sg_yima.slice(0, 4).map((x: unknown) => str(x, 1)) : [],
      sg_hour_known: !!c.sg_hour_known, sg_near_jie: !!c.sg_near_jie, sg_updated_at: new Date().toISOString(),
    }, "sg_user_id");
  }

  const ans = cleanAnswers(s.sg_assess);
  if (ans) await sbUpsert("sg_assess", { sg_user_id: id, sg_answers: ans, sg_taken_at: new Date().toISOString() }, "sg_user_id");

  const v = s.sg_vows;
  if (v?.sg_precept && v?.sg_bond && v?.sg_oath && isDate(v.sg_oath.sg_start)) {
    const rows = [
      { sg_kind: "precept", sg_god: godOrNull(v.sg_precept.sg_god), sg_mode: str(v.sg_precept.sg_mode, 12), sg_text: str(v.sg_precept.sg_text, 120), sg_start: v.sg_precept.sg_start, sg_end: null, sg_pct: 0 },
      { sg_kind: "bond", sg_god: godOrNull(v.sg_bond.sg_god), sg_mode: null, sg_text: str(v.sg_bond.sg_text, 120), sg_start: v.sg_bond.sg_start, sg_end: isDate(v.sg_bond.sg_end) ? v.sg_bond.sg_end : null, sg_pct: 0 },
      { sg_kind: "oath", sg_god: null, sg_mode: null, sg_text: str(v.sg_oath.sg_text, 80), sg_start: v.sg_oath.sg_start, sg_end: isDate(v.sg_oath.sg_end) ? v.sg_oath.sg_end : null, sg_pct: pct(v.sg_oath.sg_pct) },
    ].filter((r) => isDate(r.sg_start) && r.sg_text);
    // 舊的誓言標成 renewed,再寫入目前這組
    await sbPatch("sg_vows", `sg_user_id=eq.${id}&sg_status=eq.active&sg_start=neq.${v.sg_oath.sg_start}`, { sg_status: "renewed" });
    await sbUpsert("sg_vows", rows.map((r) => ({ ...r, sg_user_id: id, sg_status: "active" })), "sg_user_id,sg_kind,sg_start");
  }

  const rows = [];
  for (const [d, e] of Object.entries<any>(s.sg_checkins ?? {}).slice(-120)) {
    if (!isDate(d)) continue;
    rows.push({ sg_user_id: id, sg_date: d, sg_precept_ok: !!e?.sg_precept_ok, sg_bond_ok: !!e?.sg_bond_ok, sg_oath_pct: pct(e?.sg_oath_pct), sg_note: str(e?.sg_note, 60) || null, sg_amulet: false });
  }
  for (const d of (s.sg_amulet_used ?? []).slice(-60)) {
    if (isDate(d) && !s.sg_checkins?.[d]) rows.push({ sg_user_id: id, sg_date: d, sg_precept_ok: false, sg_bond_ok: false, sg_oath_pct: 0, sg_note: null, sg_amulet: true });
  }
  if (rows.length) await sbUpsert("sg_checkins", rows, "sg_user_id,sg_date");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "BAD_JSON" }, 400); }
  let uid: string;
  try { uid = await verifyIdToken(String(body?.idToken ?? "")); } catch { return json({ error: "UNAUTHORIZED" }, 401); }
  try {
    if (body.action === "load") return json({ state: await loadState(uid) });
    if (body.action === "save") { await saveState(uid, body.state); return json({ ok: true }); }
    if (body.action === "delete") {
      await fetch(`${SUPABASE_URL}/rest/v1/sg_users?sg_line_uid=eq.${encodeURIComponent(uid)}`, { method: "DELETE", headers: sbHeaders() });
      return json({ ok: true });
    }
    return json({ error: "BAD_ACTION" }, 400);
  } catch (e) {
    console.error("sg-api", e);
    return json({ error: e instanceof Error && e.message === "BAD_PROFILE" ? "BAD_PROFILE" : "SERVER" }, e instanceof Error && e.message === "BAD_PROFILE" ? 400 : 500);
  }
});
