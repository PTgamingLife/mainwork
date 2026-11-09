// LadyS 共用:Supabase REST、LINE API、台北時間、成員稱呼、行程/支出/瑣事格式化
// secrets(各函式共用):
//   LADYS_LINE_CHANNEL_SECRET        webhook 驗簽(OA 陳柏廷 Po-Ting,Messaging API 頻道)
//   LADYS_LINE_CHANNEL_ACCESS_TOKEN  reply / push
//   LADYS_LIFF_URL                   https://liff.line.me/<LIFF ID>
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動注入

export const LADYS_LINE_SECRET = Deno.env.get("LADYS_LINE_CHANNEL_SECRET") ?? "";
export const LADYS_LINE_TOKEN = Deno.env.get("LADYS_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
export const LADYS_LIFF_URL = Deno.env.get("LADYS_LIFF_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 配色 B 莫蘭迪雙人
export const LADYS_C = {
  husband: "#6C8EBF", wife: "#D4A5A5", both: "#9A8FB0",
  bg: "#F5F5F7", ink: "#2E2E33", muted: "#8A8A93",
};

export type LadysOwner = "husband" | "wife" | "both";
export const LADYS_OWNER_LABEL: Record<LadysOwner, string> = { husband: "👨", wife: "👩", both: "👫" };

export const ladysJson = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

// ---------- Supabase REST ----------
const sbHeaders = (prefer = "") => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {}),
});

export async function ladysSelect(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`SB_SELECT_${table}_${res.status}:${(await res.text()).slice(0, 160)}`);
  return await res.json();
}

export async function ladysInsert(table: string, rows: unknown, prefer = "return=representation"): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: sbHeaders(prefer), body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`SB_INSERT_${table}_${res.status}:${(await res.text()).slice(0, 160)}`);
  const t = await res.text();
  return t ? JSON.parse(t) : [];
}

export async function ladysUpdate(table: string, query: string, patch: unknown): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH", headers: sbHeaders("return=representation"), body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`SB_UPDATE_${table}_${res.status}:${(await res.text()).slice(0, 160)}`);
  return await res.json();
}

export async function ladysSettings(): Promise<any> {
  const [s] = await ladysSelect("ladys_settings", "id=eq.1&select=*");
  return s ?? {};
}

// 排程金鑰(pg_cron → ladys-morning / ladys-nightly)
export async function ladysCheckCronKey(req: Request): Promise<boolean> {
  const key = req.headers.get("x-ladys-key") ?? "";
  if (!key) return false;
  const [row] = await ladysSelect("ladys_push_auth", "id=eq.1&select=ladys_token");
  return !!row?.ladys_token && row.ladys_token === key;
}

// 同一天同一種排程只跑一次:插得進去才繼續
export async function ladysClaimRun(kind: "morning" | "nightly", runDate: string): Promise<number | null> {
  const rows = await ladysInsert(
    "ladys_runs?on_conflict=ladys_kind,ladys_run_date",
    { ladys_kind: kind, ladys_run_date: runDate },
    "resolution=ignore-duplicates,return=representation",
  );
  return rows[0]?.id ?? null;
}

export async function ladysFinishRun(id: number, status: string, detail: unknown) {
  await ladysUpdate("ladys_runs", `id=eq.${id}`, { ladys_status: status, ladys_detail: detail });
}

// ---------- LINE ----------
export async function ladysLine(path: string, body?: unknown, method = "POST"): Promise<any> {
  const res = await fetch(`https://api.line.me/v2/bot/${path}`, {
    method,
    headers: { Authorization: `Bearer ${LADYS_LINE_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`LINE_${path}_${res.status}:${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : {};
}

export const ladysReply = (replyToken: string, messages: unknown[]) =>
  ladysLine("message/reply", { replyToken, messages: messages.slice(0, 5) });

export const ladysPush = (to: string, messages: unknown[]) =>
  ladysLine("message/push", { to, messages: messages.slice(0, 5) });

// ---------- 台北時間 ----------
export function ladysTodayTaipei(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function ladysAddDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return ladysTodayTaipei(d);
}

// 'YYYY-MM-DD' 台北當天 00:00 的 ISO(UTC)
export const ladysDayStartIso = (ymd: string) => new Date(`${ymd}T00:00:00+08:00`).toISOString();

export function ladysHm(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
export function ladysDayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+08:00`);
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}(${WEEK[d.getUTCDay()]})`;
}

// ---------- 格式化 ----------
export function ladysEventLine(e: any): string {
  const t = e.ladys_all_day ? "全天" : ladysHm(e.ladys_start_at);
  const loc = e.ladys_location ? ` @${e.ladys_location}` : "";
  return `${LADYS_OWNER_LABEL[e.ladys_owner as LadysOwner] ?? "👫"} ${t} ${e.ladys_title}${loc}`;
}

export async function ladysEventsBetween(fromYmd: string, toYmdExclusive: string): Promise<any[]> {
  return await ladysSelect(
    "ladys_events",
    `ladys_deleted=eq.false&ladys_start_at=gte.${encodeURIComponent(ladysDayStartIso(fromYmd))}` +
      `&ladys_start_at=lt.${encodeURIComponent(ladysDayStartIso(toYmdExclusive))}&order=ladys_start_at.asc&select=*`,
  );
}

// 依台北日期分組
export function ladysGroupByDay(events: any[]): Map<string, any[]> {
  const m = new Map<string, any[]>();
  for (const e of events) {
    const k = ladysTodayTaipei(new Date(e.ladys_start_at));
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(e);
  }
  return m;
}

export function ladysLiffButton(label: string, view: string) {
  const uri = LADYS_LIFF_URL ? `${LADYS_LIFF_URL}${LADYS_LIFF_URL.includes("?") ? "&" : "?"}view=${view}` : "https://line.me";
  return { type: "button", style: "primary", height: "sm", color: LADYS_C.husband, action: { type: "uri", label, uri } };
}

// 簡單卡片:標題 + 多行文字 + 選用按鈕
export function ladysCard(title: string, lines: string[], buttons: unknown[] = []) {
  return {
    type: "flex",
    altText: `${title}|${lines[0] ?? ""}`.slice(0, 380),
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: LADYS_C.bg }, footer: { backgroundColor: LADYS_C.bg } },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: "LadyS", size: "xs", color: LADYS_C.wife, weight: "bold" },
          { type: "text", text: title, size: "lg", color: LADYS_C.ink, weight: "bold", wrap: true },
          { type: "separator", color: LADYS_C.husband, margin: "md" },
          ...(lines.length ? lines : ["(沒有資料)"]).slice(0, 30).map((t) => ({
            type: "text", text: t || " ", size: "sm", color: t.startsWith("【") ? LADYS_C.husband : LADYS_C.ink,
            weight: t.startsWith("【") ? "bold" : "regular", wrap: true, margin: t.startsWith("【") ? "md" : "none",
          })),
        ],
      },
      ...(buttons.length ? { footer: { type: "box", layout: "vertical", spacing: "sm", contents: buttons } } : {}),
    },
  };
}
