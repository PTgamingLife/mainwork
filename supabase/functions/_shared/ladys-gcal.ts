// LadyS → Google 日曆單向同步(LadyS 是唯一來源;在 Google 上改的不會回寫)
// secret:LADYS_GOOGLE_CREDENTIALS_JSON = {"client_id","client_secret","refresh_token"}(scope: calendar.events)
// 設定:ladys_settings.ladys_gcal_enabled + ladys_gcal_calendar_id(你建立並分享給老婆的「LadyS 家庭」日曆)
// 機制:sweep 找出「沒同步過 / 改過 / 已刪除但 Google 上還在」的行程,一次處理最多 50 筆。

import { LADYS_OWNER_LABEL, ladysSelect, ladysSettings, ladysUpdate } from "./ladys.ts";

const LADYS_GCAL_COLOR: Record<string, string> = { husband: "9", wife: "4", both: "3" }; // 藍莓 / 紅鶴 / 葡萄
let ladysToken: { value: string; exp: number } | null = null;

async function ladysGcalToken(): Promise<string> {
  if (ladysToken && ladysToken.exp > Date.now() + 60_000) return ladysToken.value;
  const raw = Deno.env.get("LADYS_GOOGLE_CREDENTIALS_JSON") ?? "";
  if (!raw) throw new Error("NO_GOOGLE_CREDENTIALS");
  const c = JSON.parse(raw);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token, grant_type: "refresh_token" }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(`GOOGLE_TOKEN_${res.status}:${String(j.error ?? "").slice(0, 60)}`);
  ladysToken = { value: j.access_token, exp: Date.now() + Number(j.expires_in ?? 3000) * 1000 };
  return ladysToken.value;
}

async function ladysGcal(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    method,
    headers: { Authorization: `Bearer ${await ladysGcalToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 404 || res.status === 410) return null; // 已被刪掉
  const t = await res.text();
  if (!res.ok) throw new Error(`GCAL_${method}_${res.status}:${t.slice(0, 160)}`);
  return t ? JSON.parse(t) : {};
}

const ymdTpe = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

function ladysGcalBody(e: any) {
  const base = {
    summary: `${LADYS_OWNER_LABEL[e.ladys_owner as "both"] ?? "👫"} ${e.ladys_title}`,
    location: e.ladys_location || undefined,
    description: "由 LadyS 生活秘書同步。要修改請到 LINE 的 LadyS「我的記錄」。",
    colorId: LADYS_GCAL_COLOR[e.ladys_owner] ?? "3",
    extendedProperties: { private: { ladys_id: e.id } },
  };
  if (e.ladys_all_day) {
    const d = ymdTpe(e.ladys_start_at);
    const next = ymdTpe(new Date(new Date(`${d}T12:00:00+08:00`).getTime() + 864e5).toISOString());
    return { ...base, start: { date: d }, end: { date: next } };
  }
  const end = e.ladys_end_at ?? new Date(new Date(e.ladys_start_at).getTime() + 3600_000).toISOString();
  return { ...base, start: { dateTime: e.ladys_start_at, timeZone: "Asia/Taipei" }, end: { dateTime: end, timeZone: "Asia/Taipei" } };
}

// 回傳 { synced, deleted, errors };沒開同步就什麼都不做
export async function ladysGcalSweep(): Promise<{ synced: number; deleted: number; errors: string[] }> {
  const out = { synced: 0, deleted: 0, errors: [] as string[] };
  const s = await ladysSettings();
  if (!s.ladys_gcal_enabled || !s.ladys_gcal_calendar_id) return out;
  const cal = encodeURIComponent(s.ladys_gcal_calendar_id);
  const since = new Date(Date.now() - 2 * 864e5).toISOString();

  const rows = await ladysSelect("ladys_events",
    `or=(and(ladys_deleted.eq.false,ladys_gcal_event_id.is.null,ladys_start_at.gte.${since}),` +
    `and(ladys_deleted.eq.true,ladys_gcal_event_id.not.is.null),` +
    `and(ladys_gcal_event_id.not.is.null,ladys_gcal_dirty.eq.true))&limit=50&select=*`);

  for (const e of rows) {
    try {
      if (e.ladys_deleted) {
        await ladysGcal("DELETE", `calendars/${cal}/events/${encodeURIComponent(e.ladys_gcal_event_id)}`);
        await ladysUpdate("ladys_events", `id=eq.${e.id}`, { ladys_gcal_event_id: null, ladys_gcal_dirty: false });
        out.deleted++;
        continue;
      }
      let gid = e.ladys_gcal_event_id;
      if (gid) {
        const r = await ladysGcal("PUT", `calendars/${cal}/events/${encodeURIComponent(gid)}`, ladysGcalBody(e));
        if (!r) gid = null; // Google 上被手動刪了 → 重建
      }
      if (!gid) gid = (await ladysGcal("POST", `calendars/${cal}/events`, ladysGcalBody(e)))?.id ?? null;
      await ladysUpdate("ladys_events", `id=eq.${e.id}`, { ladys_gcal_event_id: gid, ladys_gcal_dirty: false });
      out.synced++;
    } catch (err) {
      out.errors.push(String(err instanceof Error ? err.message : err).slice(0, 160));
      if (String(err).includes("GOOGLE_TOKEN") || String(err).includes("NO_GOOGLE")) break; // 憑證壞了就別再試
    }
  }
  if (out.errors.length) console.error("ladys gcal", out.errors);
  return out;
}
