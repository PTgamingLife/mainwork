// Claude API 薄封裝(Edge Function 端)
// 需要 secret:ANTHROPIC_API_KEY;選填 ANTHROPIC_MODEL(預設 claude-sonnet-5)

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

export async function callClaude(
  system: string,
  content: ContentBlock[],
  maxTokens = 8000,
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("伺服器未設定 ANTHROPIC_API_KEY");
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API 錯誤 ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");
  if (!text) throw new Error("Claude 回傳空內容");
  return text;
}

// 從模型輸出中抽出 JSON 物件(容忍 ```json fence 或前後夾雜文字)
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 輸出中找不到 JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

export function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
