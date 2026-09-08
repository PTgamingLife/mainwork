// 安麗蛋白素比賽 — 三支 Edge Function(amp-line / amp-api / amp-poke-digest)共用的底層。
//
// 驗簽、Taipei 日期、Supabase REST 的寫法照抄 supabase/functions/cofounder-line/index.ts,
// 差別只在這裡抽成共用模組,因為有三支函式要用。
//
// 需要的 secrets:
//   AMP_LINE_CHANNEL_SECRET        Messaging API 驗簽
//   AMP_LINE_CHANNEL_ACCESS_TOKEN  回覆與推播
//   AMP_LIFF_CHANNEL_ID            LINE Login channel ID,驗 LIFF ID token 的 aud
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   由 Supabase 自動注入

export const LINE_SECRET = Deno.env.get("AMP_LINE_CHANNEL_SECRET") ?? "";
export const LINE_TOKEN = Deno.env.get("AMP_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
export const LIFF_CHANNEL_ID = Deno.env.get("AMP_LIFF_CHANNEL_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 紐崔萊綠(色系 A):主色 / 輔色 / 底色 / 徽章金 / 深字
export const C = {
  green: "#00703C",
  leaf: "#7AB800",
  cream: "#F7F5EE",
  gold: "#C8A24A",
  ink: "#1F3D2A",
  grey: "#6B7A70",
};

// 計分規則(使用者確認:不設每日上限,refer/share 必填對方名字)
export const POINTS: Record<string, number> = { eat: 1, share: 3, refer: 5, quiz: 1 };
export const NEEDS_TARGET = ["refer", "share"];
export const HONESTY = "自律且誠實,騙人胖十斤";

const enc = new TextEncoder();

// ---- LINE 簽章驗證 (HMAC-SHA256, base64;等長常數時間比較) ----
export async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  if (!LINE_SECRET || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(LINE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ---- 台北日期(絕不用 toISOString,那是 UTC)----
export function todayTaipei(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// ---- Supabase REST ----
function sbHeaders(prefer = ""): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

export async function sbSelect(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`SB_SELECT_${res.status}:${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

export async function sbInsert(table: string, row: unknown, prefer = "return=representation"): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: sbHeaders(prefer), body: JSON.stringify(row),
  });
  if (!res.ok) {
    const body = await res.text();
    // 23505 = unique violation。「今天已經答過了」「同日彙總已送出」都靠這個判斷。
    if (body.includes("23505")) throw new Error("DUPLICATE");
    throw new Error(`SB_INSERT_${res.status}:${body.slice(0, 300)}`);
  }
  return prefer.includes("representation") ? await res.json() : [];
}

export async function sbUpsert(table: string, row: unknown, onConflict: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: sbHeaders("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`SB_UPSERT_${res.status}:${(await res.text()).slice(0, 200)}`);
}

// ---- LINE 訊息 ----
export async function lineReply(replyToken: string, messages: unknown[]): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) console.error("lineReply", res.status, (await res.text()).slice(0, 300));
}

export async function linePush(to: string, messages: unknown[]): Promise<boolean> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    console.error("linePush", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}

export function textMsg(text: string) {
  return { type: "text", text: text.slice(0, 4900) };
}

// ---- 賽季與成員 ----
export async function activeRound(): Promise<any | null> {
  const rows = await sbSelect("amp_rounds", "is_active=eq.true&select=*&limit=1");
  return rows[0] ?? null;
}

export async function findMember(lineUserId: string): Promise<any | null> {
  const rows = await sbSelect(
    "amp_members",
    `line_user_id=eq.${encodeURIComponent(lineUserId)}&select=*&limit=1`,
  );
  return rows[0] ?? null;
}

// 第一次開 LIFF 或加好友都會走到這裡;名字與頭像每次都更新成 LINE 上的最新值。
export async function upsertMember(
  lineUserId: string, displayName: string, avatarUrl: string,
): Promise<any> {
  await sbUpsert("amp_members", {
    line_user_id: lineUserId,
    display_name: displayName.slice(0, 40),
    avatar_url: avatarUrl.slice(0, 500),
    updated_at: new Date().toISOString(),
  }, "line_user_id");
  const m = await findMember(lineUserId);
  if (!m) throw new Error("MEMBER_UPSERT_FAILED");
  return m;
}

// ---- Flex 卡片 ----
function row(label: string, value: string, color = C.ink) {
  return {
    type: "box", layout: "horizontal", contents: [
      { type: "text", text: label, size: "sm", color: C.grey, flex: 3 },
      { type: "text", text: value, size: "sm", color, flex: 4, align: "end", weight: "bold" },
    ],
  };
}

export function scoreCard(opts: {
  title: string; gained: number; total: number; rank: number; detail: string; appUrl: string;
}) {
  return {
    type: "flex",
    altText: `${opts.title} +${opts.gained} 分,目前 ${opts.total} 分`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: C.green, paddingAll: "16px",
        contents: [
          { type: "text", text: opts.title, color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: `+${opts.gained} 分`, color: "#FFFFFF", size: "xxl", weight: "bold" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", backgroundColor: C.cream, paddingAll: "16px",
        contents: [
          row("目前總分", `${opts.total} 分`, C.green),
          row("目前名次", `第 ${opts.rank} 名`, C.gold),
          { type: "separator", margin: "md" },
          { type: "text", text: opts.detail, size: "sm", color: C.grey, wrap: true, margin: "md" },
          { type: "text", text: HONESTY, size: "xs", color: C.leaf, align: "center", margin: "md" },
        ],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px",
        contents: [{
          type: "button", style: "primary", color: C.green, height: "sm",
          action: { type: "uri", label: "打開挑戰 App", uri: opts.appUrl },
        }],
      },
    },
  };
}

export function pokeDigestCard(opts: { names: string[]; count: number; appUrl: string }) {
  const who = opts.names.slice(0, 5).join("、") + (opts.names.length > 5 ? " 等夥伴" : "");
  return {
    type: "flex",
    altText: `你被戳了 ${opts.count} 下,他說一起加油!`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: C.leaf, paddingAll: "16px",
        contents: [
          { type: "text", text: "有人戳你 👉", color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: `過去 24 小時被戳 ${opts.count} 下`, color: "#FFFFFF", size: "sm" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md", backgroundColor: C.cream, paddingAll: "16px",
        contents: [
          { type: "text", text: who, weight: "bold", size: "md", color: C.ink, wrap: true },
          { type: "text", text: "他說一起加油", size: "lg", color: C.green, weight: "bold" },
          { type: "text", text: HONESTY, size: "xs", color: C.grey, align: "center" },
        ],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px",
        contents: [{
          type: "button", style: "primary", color: C.green, height: "sm",
          action: { type: "uri", label: "回敬一下 / 看排行榜", uri: opts.appUrl },
        }],
      },
    },
  };
}
