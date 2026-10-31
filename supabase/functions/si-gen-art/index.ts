// 十神試煉場 — 遊戲美術生成(一次性工具,由開發者呼叫)
//   supabase functions deploy si-gen-art --no-verify-jwt
//   POST { prompt, size?, background? } + header x-sg-key(= sg_push_auth.token) → { b64 }(webp)
//   size:1024x1024 | 1536x1024 | 1024x1536;background:transparent | opaque
// secrets:OPENAI_API_KEY(與 sg-gen-angel 共用)

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SI_SIZES = ["1024x1024", "1536x1024", "1024x1536"];
const SI_BACKGROUNDS = ["transparent", "opaque"];

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

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* */ }
  const prompt = String(body.prompt ?? "").slice(0, 3000);
  if (!prompt) return json({ error: "NO_PROMPT" }, 400);
  const size = SI_SIZES.includes(String(body.size)) ? String(body.size) : "1024x1024";
  const background = SI_BACKGROUNDS.includes(String(body.background)) ? String(body.background) : "transparent";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2", prompt, n: 1, size, quality: "medium", background,
      output_format: "webp", output_compression: 90,
    }),
  });
  if (!res.ok) return json({ error: `OPENAI_IMAGE_${res.status}`, detail: (await res.text()).slice(0, 300) }, 502);
  const b64 = (await res.json())?.data?.[0]?.b64_json;
  return b64 ? json({ b64 }) : json({ error: "OPENAI_IMAGE_EMPTY" }, 502);
});
