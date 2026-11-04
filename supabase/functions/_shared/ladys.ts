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

export async function ladysDeleteWhere(table: string, query: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers: sbHeaders("return=minimal") });
  if (!res.ok) throw new Error(`SB_DELETE_${table}_${res.status}:${(await res.text()).slice(0, 160)}`);
}

// 存進資料庫前遮蔽敏感資訊:身分證、手機、卡號、密碼 / 驗證碼、銀行帳號
export function ladysMask(text: string): string {
  return text
    .replace(/(密碼|password|pwd|PIN|驗證碼|OTP)\s*[:：是為]?\s*\S+/gi, "$1 [已遮蔽]")
    .replace(/(帳號|帳戶|戶頭)\s*[:：是為]?\s*[\d-]{8,}/g, "$1 [已遮蔽]")
    .replace(/\b[A-Z][12]\d{8}\b/gi, "[身分證已遮蔽]")
    .replace(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g, "[卡號已遮蔽]")
    .replace(/(?<!\d)09\d{2}[-\s]?\d{3}[-\s]?\d{3}(?!\d)/g, "[電話已遮蔽]");
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
  const yrs = Number(e.ladys_years) > 0 ? `(${e.ladys_years} 週年)` : e.ladys_recur === "yearly" ? "💝" : "";
  return `${LADYS_OWNER_LABEL[e.ladys_owner as LadysOwner] ?? "👫"} ${t} ${e.ladys_title}${yrs}${loc}`;
}

export async function ladysEventsBetween(fromYmd: string, toYmdExclusive: string): Promise<any[]> {
  return await ladysSelect(
    "ladys_events",
    `ladys_deleted=eq.false&ladys_recur=eq.none&ladys_start_at=gte.${encodeURIComponent(ladysDayStartIso(fromYmd))}` +
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

// ---------- 卡片(樣式 C:一個主要大圓 + 下方一排小圓捷徑,統一霧藍)----------
export type LadysView = "calendar" | "list" | "money" | "goals" | "todos" | "settings";
const LADYS_VIEWS: Record<LadysView, [string, string]> = {
  calendar: ["📅", "行事曆"], list: ["📋", "列表"], money: ["💰", "記帳"],
  goals: ["🎯", "目標"], todos: ["☑️", "待辦"], settings: ["⚙️", "設定"],
};
const LADYS_SHORTCUTS: LadysView[] = ["calendar", "money", "goals", "todos", "settings"];

// 動畫(APNG,scripts/ladys_anim.py 產生,放在 GitHub Pages)
const LADYS_ANIM_BASE = "https://ptgaminglife.github.io/mainwork/ladys/anim/";
export type LadysHero = "morning" | "night" | "update" | "menu";
export type LadysCardOpts = { hero?: LadysHero; anim?: boolean }; // anim 預設開(大圓動畫),傳 false 關閉

export function ladysLiffUri(view: LadysView): string {
  return LADYS_LIFF_URL ? `${LADYS_LIFF_URL}${LADYS_LIFF_URL.includes("?") ? "&" : "?"}view=${view}` : "https://line.me";
}

// 正圓:寬高相同、圓角為一半;整顆可點
function ladysCircle(px: number, view: LadysView, inner: unknown[]) {
  return {
    type: "box", layout: "vertical", width: `${px}px`, height: `${px}px`, cornerRadius: `${px / 2}px`,
    backgroundColor: LADYS_C.husband, justifyContent: "center", alignItems: "center", spacing: "none",
    action: { type: "uri", label: LADYS_VIEWS[view][1], uri: ladysLiffUri(view) },
    contents: inner,
  };
}

function ladysCircleFooter(primary: { view: LadysView; label?: string }, anim = false) {
  const [emoji, name] = LADYS_VIEWS[primary.view];
  const big = ladysCircle(176, primary.view, [
    anim
      ? { type: "image", url: `${LADYS_ANIM_BASE}icon-${primary.view}.png`, size: "96px", aspectRatio: "1:1", animated: true }
      : { type: "text", text: emoji, size: "3xl", align: "center" },
    { type: "text", text: primary.label ?? name, size: "md", color: "#FFFFFF", weight: "bold", align: "center" },
  ]);
  const smalls = LADYS_SHORTCUTS.filter((v) => v !== primary.view).slice(0, 4).map((v) => ({
    type: "box", layout: "vertical", flex: 1, alignItems: "center", spacing: "xs",
    action: { type: "uri", label: LADYS_VIEWS[v][1], uri: ladysLiffUri(v) },
    contents: [
      ladysCircle(60, v, [{ type: "text", text: LADYS_VIEWS[v][0], size: "xl", align: "center" }]),
      { type: "text", text: LADYS_VIEWS[v][1], size: "xs", color: LADYS_C.muted, align: "center" },
    ],
  }));
  return {
    type: "box", layout: "vertical", spacing: "lg", paddingTop: "md",
    contents: [
      { type: "box", layout: "horizontal", justifyContent: "center", contents: [big] },
      { type: "box", layout: "horizontal", contents: smalls },
    ],
  };
}

// 卡片:標題 + 多行文字 + 選用的圓形按鈕區(primary = 主要大圓要開的頁面)
export function ladysCard(title: string, lines: string[], primary?: { view: LadysView; label?: string }, opts: LadysCardOpts = {}) {
  return {
    type: "flex",
    altText: `${title}|${lines[0] ?? ""}`.slice(0, 380),
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: LADYS_C.bg }, footer: { backgroundColor: LADYS_C.bg } },
      ...(opts.hero ? {
        hero: { type: "image", url: `${LADYS_ANIM_BASE}hero-${opts.hero}.png`, size: "full", aspectRatio: "3:1", aspectMode: "cover", animated: true },
      } : {}),
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
      ...(primary ? { footer: ladysCircleFooter(primary, opts.anim !== false) } : {}),
    },
  };
}
