// 十神修行錄 — 一次性設定 OA 圖文選單(會刪除該 OA 現有的所有圖文選單)
//   supabase functions deploy sg-setup-richmenu --no-verify-jwt
//   POST { image_b64 } + header x-sg-key(= sg_push_auth.token)
// 圖片:2500x843 PNG,四格按鈕 → SG_LIFF_URL?view=chart|today|angel|growth(各開對應頁面)

const LINE_TOKEN = Deno.env.get("SG_LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const LIFF_URL = Deno.env.get("SG_LIFF_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 四格:左到右
const SG_MENU: [string, string][] = [["chart", "命盤"], ["today", "今日"], ["angel", "天使"], ["growth", "修行"]];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function line(path: string, init: RequestInit = {}, host = "api.line.me") {
  const res = await fetch(`https://${host}/v2/bot/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${LINE_TOKEN}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LINE ${path} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const key = req.headers.get("x-sg-key") ?? "";
  const authRes = await fetch(`${SUPABASE_URL}/rest/v1/sg_push_auth?id=eq.1&select=token`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const [auth] = authRes.ok ? await authRes.json() : [];
  if (!key || !auth?.token || key !== auth.token) return json({ error: "UNAUTHORIZED" }, 401);
  if (!LINE_TOKEN || !LIFF_URL) return json({ error: "MISSING_SECRETS" }, 500);

  let b64 = "";
  try { b64 = String((await req.json())?.image_b64 ?? ""); } catch { /* */ }
  if (!b64) return json({ error: "NO_IMAGE" }, 400);
  const png = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  try {
    const { richmenus = [] } = await line("richmenu/list");
    for (const m of richmenus) await line(`richmenu/${m.richMenuId}`, { method: "DELETE" });

    const { richMenuId } = await line("richmenu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size: { width: 2500, height: 843 },
        selected: true,
        name: "sg-main",
        chatBarText: "十神修行錄",
        areas: SG_MENU.map(([view, label], i) => ({
          bounds: { x: i * 625, y: 0, width: 625, height: 843 },
          action: { type: "uri", label, uri: `${LIFF_URL}${LIFF_URL.includes("?") ? "&" : "?"}view=${view}` },
        })),
      }),
    });
    await line(`richmenu/${richMenuId}/content`, { method: "POST", headers: { "Content-Type": "image/png" }, body: png }, "api-data.line.me");
    await line(`user/all/richmenu/${richMenuId}`, { method: "POST" });
    return json({ ok: true, deleted: richmenus.length, richMenuId, liffUrl: LIFF_URL });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }
});
