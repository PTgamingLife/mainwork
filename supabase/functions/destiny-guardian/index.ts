import {
  authenticate,
  BASE_SYSTEM,
  corsHeaders,
  json,
  openAIJson,
  requireUuid,
  todayInTimezone,
} from "../_shared/destiny.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2.57.4";

const SPEC_VERSION = "guardian-spec-1.0.0";
const specSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    essence: { type: "string" },
    appearance: { type: "string" },
    colors: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    symbols: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
    voice: { type: "string" },
    immutable_traits: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 },
    realistic_prompt: { type: "string" },
    chibi_prompt: { type: "string" },
  },
  required: ["name", "essence", "appearance", "colors", "symbols", "voice", "immutable_traits", "realistic_prompt", "chibi_prompt"],
};

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function generateImage(prompt: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
    }),
  });
  if (!response.ok) throw new Error(`OPENAI_IMAGE_${response.status}:${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) throw new Error("OPENAI_IMAGE_EMPTY");
  return decodeBase64(b64);
}

async function signedAssets(service: SupabaseClient, guardian: Record<string, unknown>) {
  const paths = [guardian.realistic_path, guardian.chibi_path].filter(Boolean) as string[];
  if (paths.length !== 2) return { realistic_url: null, chibi_url: null };
  const { data, error } = await service.storage.from("destiny-guardians").createSignedUrls(paths, 3600);
  if (error) throw error;
  return { realistic_url: data[0]?.signedUrl ?? null, chibi_url: data[1]?.signedUrl ?? null };
}

async function getGuardian(req: Request) {
  const { userId, serviceClient } = await authenticate(req);
  const { data } = await serviceClient.from("destiny_guardians").select("*")
    .eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (!data) return json(req, { guardian: null });
  const assets = data.status === "ready" ? await signedAssets(serviceClient, data) : {};
  return json(req, { guardian: data, ...assets });
}

async function createGuardian(req: Request, body: Record<string, unknown>) {
  const { userId, serviceClient } = await authenticate(req);
  const requestId = requireUuid(body.request_id);
  const [{ data: profile }, { data: answers }, { data: current }] = await Promise.all([
    serviceClient.from("destiny_profiles").select("*").eq("user_id", userId).maybeSingle(),
    serviceClient.from("destiny_journey_answers").select("day_index,question_id,answer")
      .eq("user_id", userId).order("day_index").limit(5),
    serviceClient.from("destiny_guardians").select("*").eq("user_id", userId).eq("is_active", true).maybeSingle(),
  ]);
  if (!profile?.day_stem) return json(req, { error: "請先完成出生資料" }, 409);
  if (current?.status === "ready") {
    return json(req, { guardian: current, ...(await signedAssets(serviceClient, current)), idempotent: true });
  }
  const date = todayInTimezone(profile.timezone);
  let { data: usage, error: usageError } = await serviceClient.from("destiny_ai_usage").insert({
    user_id: userId,
    action_type: "guardian_generation",
    usage_date: date,
    request_id: requestId,
    status: "started",
  }).select().single();
  if (usageError?.code === "23505") {
    const { data: existing } = await serviceClient.from("destiny_ai_usage").select("*")
      .eq("user_id", userId).eq("action_type", "guardian_generation").eq("usage_date", date).maybeSingle();
    if (existing?.status === "refunded") {
      const retry = await serviceClient.from("destiny_ai_usage").update({
        request_id: requestId,
        status: "started",
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).eq("status", "refunded").select().maybeSingle();
      if (retry.error) throw retry.error;
      usage = retry.data;
      usageError = null;
    } else {
      return json(req, { error: "守護天使正在生成或今日已生成" }, 409);
    }
  }
  if (usageError) throw usageError;
  if (!usage) throw new Error("USAGE_RESERVATION_FAILED");

  const { data: last } = await serviceClient.from("destiny_guardians").select("version")
    .eq("user_id", userId).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const { data: guardian, error: insertError } = await serviceClient.from("destiny_guardians").insert({
    user_id: userId,
    version,
    character_spec: { spec_version: SPEC_VERSION, pending: true },
    status: "processing",
    is_active: false,
  }).select().single();
  if (insertError) throw insertError;
  await serviceClient.from("destiny_profiles").update({ guardian_status: "processing" }).eq("user_id", userId);

  try {
    const spec = await openAIJson(
      "destiny_guardian_spec",
      specSchema,
      `${BASE_SYSTEM}\n你是角色設計師。依天干呈現想法傾向，再用回答呈現偏好。角色必須可同時轉成電影級擬真人像與療癒 Q 版人偶，兩版保持同一張臉、髮型、配色、服裝輪廓與象徵物。不可使用宗教神祇或恐怖元素。`,
      { day_stem: profile.day_stem, element: profile.day_element, answers: answers ?? [] },
    );
    const shared = `同一位原創守護角色，身份設定：${spec.appearance}。固定辨識特徵：${spec.immutable_traits.join("、")}。主色：${spec.colors.join("、")}。象徵物：${spec.symbols.join("、")}。無文字、無浮水印、單一角色、正方形構圖。`;
    const [realistic, chibi] = await Promise.all([
      generateImage(`${shared}\n擬真版本：${spec.realistic_prompt}。電影級柔光，真實材質，溫暖而有力量，全身至三分之二身。`),
      generateImage(`${shared}\nQ版人偶版本：${spec.chibi_prompt}。精緻 3D 收藏公仔，柔軟圓潤比例，表情友善，乾淨米白背景。`),
    ]);
    const base = `${userId}/v${version}`;
    const realisticPath = `${base}/realistic.png`;
    const chibiPath = `${base}/chibi.png`;
    const [realUpload, chibiUpload] = await Promise.all([
      serviceClient.storage.from("destiny-guardians").upload(realisticPath, realistic, { contentType: "image/png", upsert: true }),
      serviceClient.storage.from("destiny-guardians").upload(chibiPath, chibi, { contentType: "image/png", upsert: true }),
    ]);
    if (realUpload.error || chibiUpload.error) throw realUpload.error || chibiUpload.error;
    await serviceClient.from("destiny_guardians").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
    const { data: ready, error: updateError } = await serviceClient.from("destiny_guardians").update({
      character_spec: { ...spec, spec_version: SPEC_VERSION },
      realistic_path: realisticPath,
      chibi_path: chibiPath,
      status: "ready",
      is_active: true,
    }).eq("id", guardian.id).select().single();
    if (updateError) throw updateError;
    await Promise.all([
      serviceClient.from("destiny_profiles").update({ guardian_status: "ready" }).eq("user_id", userId),
      serviceClient.from("destiny_ai_usage").update({ status: "succeeded" }).eq("id", usage.id),
    ]);
    return json(req, { guardian: ready, ...(await signedAssets(serviceClient, ready)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all([
      serviceClient.from("destiny_guardians").update({ status: "failed", error_message: message.slice(0, 300) }).eq("id", guardian.id),
      serviceClient.from("destiny_profiles").update({ guardian_status: "failed" }).eq("user_id", userId),
      serviceClient.from("destiny_ai_usage").update({ status: "refunded" }).eq("id", usage.id),
    ]);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const body = await req.json() as Record<string, unknown>;
    if (body.action === "get") return await getGuardian(req);
    if (body.action === "create") return await createGuardian(req, body);
    return json(req, { error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "UNAUTHORIZED" ? 401 : message.startsWith("INVALID_") ? 400 : 500;
    console.error("destiny-guardian", message);
    return json(req, { error: status === 500 ? "守護天使生成暫時失敗，額度已退還" : message }, status);
  }
});
