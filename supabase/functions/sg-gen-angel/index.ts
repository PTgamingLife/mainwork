// 十神修行錄 — 守護天使圖像生成(一次性工具,由開發者呼叫)
//   supabase functions deploy sg-gen-angel --no-verify-jwt
//   POST { prompt } + header x-sg-key(= sg_push_auth.token) → { b64 }(webp)
// 與 destiny-guardian 相同的模型設定;secrets:OPENAI_API_KEY

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const key = req.headers.get("x-sg-key") ?? "";
  const authRes = await fetch(`${SUPABASE_URL}/rest/v1/sg_push_auth?id=eq.1&select=token`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const [auth] = authRes.ok ? await authRes.json() : [];
  if (!key || !auth?.token || key !== auth.token) return json({ error: "UNAUTHORIZED" }, 401);
  if (!OPENAI_KEY) return json({ error: "OPENAI_API_KEY_MISSING" }, 500);

  let prompt = "";
  try { prompt = String((await req.json())?.prompt ?? "").slice(0, 3000); } catch { /* */ }
  if (!prompt) return json({ error: "NO_PROMPT" }, 400);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2", prompt, n: 1, size: "1024x1024", quality: "medium",
      output_format: "webp", output_compression: 85,
    }),
  });
  if (!res.ok) return json({ error: `OPENAI_IMAGE_${res.status}`, detail: (await res.text()).slice(0, 300) }, 502);
  const b64 = (await res.json())?.data?.[0]?.b64_json;
  return b64 ? json({ b64 }) : json({ error: "OPENAI_IMAGE_EMPTY" }, 502);
});
