/**
 * course-poster — Supabase Edge Function
 *
 * Generates an AI course promotional poster (vertical PNG) with OpenAI
 * gpt-image-2. Deno counterpart of scripts/generate_course_poster.py.
 *
 * Deploy:
 *   supabase functions deploy course-poster --no-verify-jwt
 *
 * Invoke (returns raw PNG bytes by default):
 *   curl -X POST \
 *     https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/course-poster \
 *     -H "Content-Type: application/json" \
 *     -d '{"title":"AI 應用實戰班","subtitle":"8 週掌握生成式 AI"}' \
 *     -o poster.png
 *
 * Body fields (all optional):
 *   title       Course name shown as the poster headline.
 *   subtitle    Supporting tagline.
 *   highlights  string[] of selling points / curriculum bullets.
 *   audience    Who the course is for (e.g. "上班族 / 學生").
 *   style       Visual style hint (default: modern tech gradient).
 *   prompt      Full prompt override; when set, the fields above are ignored.
 *   size        OpenAI image size (default "1024x1536" portrait poster).
 *   quality     "low" | "medium" | "high" (default "high").
 *   format      "png" (default, raw bytes) | "json" (base64 + metadata).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PosterRequest {
  title?: string;
  subtitle?: string;
  highlights?: string[];
  audience?: string;
  style?: string;
  prompt?: string;
  size?: string;
  quality?: "low" | "medium" | "high";
  format?: "png" | "json";
}

function buildPrompt(body: PosterRequest): string {
  if (body.prompt && body.prompt.trim()) return body.prompt.trim();

  const title = body.title?.trim() || "AI 應用實戰班";
  const subtitle = body.subtitle?.trim() || "從零開始，8 週掌握生成式 AI";
  const audience = body.audience?.trim() || "適合上班族與學生";
  const style =
    body.style?.trim() ||
    "現代科技感、深藍與霓虹漸層、簡潔留白、專業排版";
  const highlights =
    body.highlights && body.highlights.length
      ? body.highlights
      : ["實戰專案導向", "業界講師親授", "結業作品集", "小班互動教學"];

  return [
    "設計一張直式的線上課程宣傳海報（poster），主題為人工智慧 / AI 課程。",
    `主標題文字：「${title}」，置於視覺中心、字體粗大醒目。`,
    `副標題文字：「${subtitle}」。`,
    `重點賣點（以條列或圖示呈現）：${highlights.join("、")}。`,
    `目標客群：${audience}。`,
    `視覺風格：${style}。`,
    "包含與 AI 相關的意象（神經網路、晶片、資料流、機器人或抽象幾何）。",
    "排版整潔、層次分明、留有可閱讀的文字空間，色彩對比清楚，適合社群媒體與印刷宣傳。",
    "中文文字需正確、清晰、無錯字。",
  ].join("\n");
}

async function generatePng(
  prompt: string,
  size: string,
  quality: string,
  openaiKey: string,
): Promise<Uint8Array> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      n: 1,
      size,
      quality,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI image API error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const item = result.data?.[0];

  // gpt-image models return base64 by default.
  if (item?.b64_json) {
    const binary = atob(item.b64_json);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // Fallback: some configurations return a URL.
  if (item?.url) {
    const imgResp = await fetch(item.url);
    if (!imgResp.ok) throw new Error(`Failed to fetch image URL: ${item.url}`);
    return new Uint8Array(await imgResp.arrayBuffer());
  }

  throw new Error("No image data returned from OpenAI");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    let body: PosterRequest = {};
    try {
      const raw = await req.text();
      if (raw) body = JSON.parse(raw) as PosterRequest;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY is not configured");

    const prompt = buildPrompt(body);
    const size = body.size?.trim() || "1024x1536";
    const quality = body.quality || "high";

    const pngBytes = await generatePng(prompt, size, quality, openaiKey);

    if (body.format === "json") {
      // Re-encode to base64 for JSON transport.
      let binary = "";
      for (let i = 0; i < pngBytes.length; i++) {
        binary += String.fromCharCode(pngBytes[i]);
      }
      return new Response(
        JSON.stringify({ image_base64: btoa(binary), size, prompt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(pngBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="course-poster.png"',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
