import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2.57.4";

const ALLOWED_ORIGINS = new Set([
  "https://ptgaminglife.github.io",
  "http://localhost:5173",
  "http://localhost:8000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8000",
]);

export type AppClients = {
  userId: string;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
};

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://ptgaminglife.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export async function authenticate(req: Request): Promise<AppClients> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) throw new Error("SERVER_CONFIG");

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHORIZED");

  return {
    userId: data.user.id,
    userClient,
    serviceClient: createClient(url, serviceKey, { auth: { persistSession: false } }),
  };
}

export function todayInTimezone(timezone = "Asia/Taipei") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}

export function requireUuid(value: unknown, field = "request_id") {
  const text = String(value ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return text;
}

export function safeText(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

export function hasHighRiskContent(text: string) {
  return /(自殺|不想活|傷害自己|傷害別人|殺人|胸痛|呼吸困難|大量出血|保證獲利|借錢投資|法律定罪|停藥|藥物劑量)/i.test(text);
}

function responseText(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new Error("OPENAI_EMPTY_RESPONSE");
}

export async function openAIJson(
  name: string,
  schema: Record<string, unknown>,
  system: string,
  input: unknown,
) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  const model = Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] },
      ],
      text: {
        format: { type: "json_schema", name, strict: true, schema },
      },
    }),
  });
  if (!response.ok) throw new Error(`OPENAI_${response.status}:${(await response.text()).slice(0, 400)}`);
  return JSON.parse(responseText(await response.json()));
}

export const BASE_SYSTEM = `你是「命運校準」App 的守護天使教練。你運用命理作為自我反思語言，但不把命理說成科學預測，不宣稱命定結果。所有建議必須連結使用者親自設定的目標、近期行為證據與現實限制。一次只推動一個可完成行動。不得替使用者做醫療、法律、投資或重大關係決定；遇到高風險內容時建議尋求合格專業協助。請使用繁體中文，語氣溫暖、清楚、不依賴恐懼或迷信。`;
