// wob-media — 公車上的成長（wheels-bus/）預設素材的唯一入口(Supabase Edge Function / Deno)
//
// 素材放在私有 bucket wob_media，前端沒有任何 Supabase 金鑰：
// 帶家庭密碼打這支 → 密碼正確才回傳 manifest + 有時效的下載連結。
//
// 部署(前端不帶 Supabase JWT):
//   supabase functions deploy wob-media --no-verify-jwt
// 密碼(在 Supabase 後台 Edge Functions → Secrets 設定):
//   WOB_FAMILY_PASSWORD

const WOB_BUCKET = "wob_media";
const WOB_MANIFEST = "manifest.json";
const WOB_URL_TTL = 60 * 60 * 6; // 下載連結 6 小時有效

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WOB_PASSWORD = Deno.env.get("WOB_FAMILY_PASSWORD") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// 固定時間比較，避免用回應時間猜密碼
function wobSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

async function wobStorage(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SB_URL}/storage/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, ...(init.headers ?? {}) },
  });
}

type WobItem = { path: string; kind: "image" | "video"; v: string };

// ---- 管理端（上傳素材用）：header x-wob-admin 的 sha256 必須在 wob_admin_tokens 表裡 ----
//   POST ?op=put&path=items/001_x.jpg   body = 檔案內容，Content-Type = 檔案型別
//   POST ?op=list                        回傳 items/ 底下的檔名
//   POST ?op=delete  body = {"paths": [...]}
async function wobIsAdmin(token: string): Promise<boolean> {
  if (token.length < 32) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const r = await fetch(`${SB_URL}/rest/v1/wob_admin_tokens?token_hash=eq.${hex}&select=token_hash`, {
    headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY },
  });
  return r.ok && (await r.json() as unknown[]).length === 1;
}

const WOB_PATH_OK = /^(items\/[A-Za-z0-9_.-]{1,80}|manifest\.json)$/;

async function wobAdmin(req: Request, op: string, url: URL): Promise<Response> {
  if (op === "put") {
    const path = url.searchParams.get("path") ?? "";
    if (!WOB_PATH_OK.test(path)) return json({ error: "BAD_PATH" }, 400);
    const r = await wobStorage(`object/${WOB_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": req.headers.get("content-type") ?? "application/octet-stream",
        "x-upsert": "true",
        "cache-control": path === WOB_MANIFEST ? "0" : "31536000",
      },
      body: await req.arrayBuffer(),
    });
    return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502);
  }
  if (op === "list") {
    const r = await wobStorage(`object/list/${WOB_BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "items", limit: 1000 }),
    });
    const rows = r.ok ? await r.json() as { name: string; id: string | null }[] : [];
    return json({ paths: rows.filter((o) => o.id).map((o) => `items/${o.name}`) });
  }
  if (op === "delete") {
    const { paths } = await req.json() as { paths?: string[] };
    const ok = (paths ?? []).filter((p) => WOB_PATH_OK.test(p) && p !== WOB_MANIFEST);
    if (ok.length) {
      await wobStorage(`object/${WOB_BUCKET}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: ok }),
      });
    }
    return json({ deleted: ok.length });
  }
  return json({ error: "BAD_OP" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  const url = new URL(req.url);
  const op = url.searchParams.get("op");
  if (op) {
    if (!(await wobIsAdmin(req.headers.get("x-wob-admin") ?? ""))) {
      await new Promise((r) => setTimeout(r, 800));
      return json({ error: "UNAUTHORIZED" }, 401);
    }
    return wobAdmin(req, op, url);
  }
  if (!WOB_PASSWORD) return json({ error: "NOT_CONFIGURED" }, 500);

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  } catch {
    return json({ error: "BAD_REQUEST" }, 400);
  }
  if (!wobSafeEqual(password, WOB_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800)); // 拖慢暴力猜測
    return json({ error: "WRONG_PASSWORD" }, 401);
  }

  const mRes = await wobStorage(`object/${WOB_BUCKET}/${WOB_MANIFEST}`);
  if (mRes.status === 404 || mRes.status === 400) return json({ items: [] });
  if (!mRes.ok) return json({ error: "MANIFEST" }, 502);
  const manifest = await mRes.json() as { version?: string; items?: WobItem[] };
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  if (!items.length) return json({ version: manifest.version ?? "", items: [] });

  const sRes = await wobStorage(`object/sign/${WOB_BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: WOB_URL_TTL, paths: items.map((i) => i.path) }),
  });
  if (!sRes.ok) return json({ error: "SIGN" }, 502);
  const signed = await sRes.json() as { path: string; signedURL?: string; error?: string }[];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedURL ? `${SB_URL}/storage/v1${s.signedURL}` : ""]));

  return json({
    version: manifest.version ?? "",
    items: items
      .map((i) => ({ path: i.path, kind: i.kind, v: i.v, url: urlOf.get(i.path) ?? "" }))
      .filter((i) => i.url),
  });
});
