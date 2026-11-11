// 生命之旅 — lj-api / lj-line 共用的底層:資料庫、照片儲存、LINE、身分驗證。
//
// 跟同一個 OA,所以沿用舊專案已經設好的 LINE secrets(值相同,不另外再設一份):
//   AMP_LINE_CHANNEL_SECRET        Messaging API 驗簽
//   AMP_LINE_CHANNEL_ACCESS_TOKEN  回覆
//   AMP_LIFF_CHANNEL_ID            LINE Login channel ID,驗 LIFF ID token 的 aud
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   由 Supabase 自動注入

export const LINE_SECRET = Deno.env.get("AMP_LINE_CHANNEL_SECRET") ?? "";
export const LINE_TOKEN = Deno.env.get("AMP_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
export const LIFF_CHANNEL_ID = Deno.env.get("AMP_LIFF_CHANNEL_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const BUCKET = "lj-photos";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });
}

// 等長常數時間比較,避免用回應時間猜金鑰
export function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- Supabase REST ----
function sbHeaders(prefer = ""): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

export async function sbSelect(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`SB_SELECT_${res.status}:${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

// 整點多個排程一起跑時 PostgREST 會短暫回 504,查詢失敗就重試
export async function sbSelectRetry(table: string, query: string, tries = 3): Promise<any[]> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await sbSelect(table, query); } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw last;
}

export async function sbInsert(table: string, row: unknown): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: sbHeaders("return=representation"), body: JSON.stringify(row),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("23505")) throw new Error("DUPLICATE");   // unique violation
    throw new Error(`SB_INSERT_${res.status}:${body.slice(0, 300)}`);
  }
  return await res.json();
}

export async function sbUpdate(table: string, query: string, patch: unknown): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH", headers: sbHeaders("return=representation"), body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`SB_UPDATE_${res.status}:${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

export async function sbDelete(table: string, query: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE", headers: sbHeaders(),
  });
  if (!res.ok) throw new Error(`SB_DELETE_${res.status}:${(await res.text()).slice(0, 200)}`);
}

// ---- 照片(私有 bucket)----
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

// 前端送 base64(已在瀏覽器壓過),這裡檢查型別與大小後存進 storage
export async function putPhoto(
  memberId: string, base64: string, mime: string,
): Promise<{ path: string; bytes: Uint8Array }> {
  const ext = IMAGE_TYPES[mime];
  if (!ext) throw new Error("BAD_PHOTO_TYPE");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("BAD_PHOTO");
  }
  if (bytes.length === 0) throw new Error("BAD_PHOTO");
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error("PHOTO_TOO_LARGE");
  const path = `${memberId}/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": mime },
    body: bytes,
  });
  if (!res.ok) throw new Error(`STORAGE_PUT_${res.status}:${(await res.text()).slice(0, 200)}`);
  return { path, bytes };
}

export async function getPhoto(path: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`STORAGE_GET_${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return { base64: toBase64(buf), mime: res.headers.get("content-type") ?? "image/jpeg" };
}

export async function deletePhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
}

// 一次替多張照片簽網址;網址一小時後失效,外流也不會一直有效
export async function signPhotos(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const uniq = [...new Set(paths.filter(Boolean))];
  if (uniq.length === 0) return {};
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn, paths: uniq }),
  });
  if (!res.ok) throw new Error(`STORAGE_SIGN_${res.status}`);
  const out: Record<string, string> = {};
  for (const r of await res.json() as any[]) {
    if (r?.signedURL) out[r.path] = `${SUPABASE_URL}/storage/v1${r.signedURL}`;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---- 成員 ----
export async function findMember(lineUserId: string): Promise<any | null> {
  const rows = await sbSelect("lj_members", `line_user_id=eq.${encodeURIComponent(lineUserId)}&select=*&limit=1`);
  return rows[0] ?? null;
}

export async function findByCode(code: string): Promise<any | null> {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^[2-9A-HJKMNP-Z]{4}$/.test(c)) return null;
  const rows = await sbSelect("lj_members", `code=eq.${c}&select=*&limit=1`);
  return rows[0] ?? null;
}

// 找不到就建;名字與頭像有變就更新(空字串不覆蓋 —— webhook 有時拿不到 profile)
export async function ensureMember(lineUserId: string, name: string, picture: string): Promise<any> {
  const m = await findMember(lineUserId);
  if (!m) {
    try {
      const rows = await sbInsert("lj_members", {
        line_user_id: lineUserId, display_name: name.slice(0, 40), avatar_url: picture.slice(0, 500),
      });
      return rows[0];
    } catch (e) {
      if ((e as Error).message !== "DUPLICATE") throw e;
      return await findMember(lineUserId);   // 同時兩個請求都在建,另一個先建好了
    }
  }
  if ((name && name !== m.display_name) || (picture && picture !== m.avatar_url)) {
    const rows = await sbUpdate("lj_members", `id=eq.${m.id}`, {
      display_name: (name || m.display_name).slice(0, 40),
      avatar_url: (picture || m.avatar_url).slice(0, 500),
      updated_at: new Date().toISOString(),
    });
    return rows[0] ?? m;
  }
  return m;
}

// ---- LIFF ID token ----
export async function verifyIdToken(idToken: string): Promise<{ sub: string; name: string; picture: string }> {
  if (!idToken || !LIFF_CHANNEL_ID) throw new Error("UNAUTHORIZED");
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LIFF_CHANNEL_ID }),
  });
  if (!res.ok) throw new Error("UNAUTHORIZED");
  const p = await res.json();
  if (!p?.sub || p.aud !== LIFF_CHANNEL_ID) throw new Error("UNAUTHORIZED");
  return { sub: p.sub, name: p.name ?? "", picture: p.picture ?? "" };
}

// ---- LINE Messaging API ----
const enc = new TextEncoder();

export async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  if (!LINE_SECRET || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(LINE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return sameKey(btoa(String.fromCharCode(...new Uint8Array(mac))), signature);
}

export async function lineReply(replyToken: string, messages: unknown[]): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) console.error("lineReply", res.status, (await res.text()).slice(0, 300));
}

export async function lineProfile(userId: string): Promise<{ name: string; picture: string }> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${LINE_TOKEN}` },
    });
    if (!res.ok) return { name: "", picture: "" };
    const p = await res.json();
    return { name: p?.displayName ?? "", picture: p?.pictureUrl ?? "" };
  } catch {
    return { name: "", picture: "" };
  }
}
