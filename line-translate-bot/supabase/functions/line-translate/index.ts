// LINE 翻譯機器人 — Supabase Edge Function (Deno)
//
// 流程:LINE 群組訊息 → 本 webhook → Claude API 翻譯 → 回覆到群組
//
// 觸發規則:
//   1. 「翻譯ai <文字>」
//        - 若 <文字> 是中文 → 翻成「群組設定的目標語言」(預設:越南文、英文)
//        - 若 <文字> 非中文 → 翻成「繁體中文 + 英文」
//   2. 「設定-<語言>」(可多個,用 、 , / 空格 分隔)→ 更改整個群組的目標語言
//        例:設定-日文、韓文
//   3. 「群組id」→ 回覆目前群組的 groupId(設定 TARGET_GROUP_ID 時用得到)
//
// 需要的 secrets:
//   LINE_CHANNEL_SECRET        LINE channel 的 Channel secret(驗簽用)
//   LINE_CHANNEL_ACCESS_TOKEN  LINE channel 的 long-lived access token(回覆用)
//   ANTHROPIC_API_KEY          Claude API key(翻譯用)
//   TARGET_GROUP_ID            (選填)只服務這個群組;留空 = 服務所有群組
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  由 Supabase 自動注入,存群組設定用

const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const TARGET_GROUP_ID = Deno.env.get("TARGET_GROUP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 翻譯用模型。Opus 4.8 品質最好;若想更快/更省,可改成 "claude-haiku-4-5"。
const MODEL = "claude-opus-4-8";
const TRIGGER = "嘿嘿";
const SETTINGS_PREFIX = "設定-";
const DEFAULT_TARGET_LANGS = ["越南文", "英文"];
const SETTINGS_TABLE = "line_translate_settings";

const textEncoder = new TextEncoder();

// ---- LINE 簽章驗證 (HMAC-SHA256, base64) ----
async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  if (!LINE_CHANNEL_SECRET || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, textEncoder.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // 長度不同直接 false,避免 timing-unsafe 比對拋錯
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ---- 判斷一段文字主要是不是中文 ----
function isChineseText(s: string): boolean {
  const chinese = (s.match(/[一-鿿]/g) ?? []).length;
  const latin = (s.match(/[A-Za-z]/g) ?? []).length;
  return chinese > 0 && chinese >= latin;
}

// ---- 群組設定讀寫 (Supabase REST) ----
async function getTargetLangs(groupId: string): Promise<string[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return DEFAULT_TARGET_LANGS;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${SETTINGS_TABLE}?group_id=eq.${encodeURIComponent(groupId)}&select=target_langs`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) return DEFAULT_TARGET_LANGS;
    const rows = await res.json();
    const langs = rows?.[0]?.target_langs;
    return Array.isArray(langs) && langs.length > 0 ? langs : DEFAULT_TARGET_LANGS;
  } catch {
    return DEFAULT_TARGET_LANGS;
  }
}

async function setTargetLangs(groupId: string, langs: string[]): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SETTINGS_TABLE}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        group_id: groupId,
        target_langs: langs,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- 呼叫 Claude 翻譯 ----
async function translate(content: string, targetLangs: string[]): Promise<string> {
  const system =
    "You are a translation engine. Translate the user's text into EVERY requested target language. " +
    "Output ONLY the translations — one language per line, each line prefixed with the target language " +
    "name (in Traditional Chinese) then a colon and a space. Do NOT add explanations, notes, " +
    "romanization, pinyin, or any other text. Preserve meaning, tone, and any emoji.";
  const userMsg =
    `請把以下文字翻譯成這些語言:${targetLangs.join("、")}\n\n文字:\n${content}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic API error:", res.status, errText);
    throw new Error(`Anthropic ${res.status}`);
  }
  const data = await res.json();
  const block = (data.content ?? []).find((b: { type: string }) => b.type === "text");
  return (block?.text ?? "").trim() || "(翻譯失敗,請稍後再試)";
}

// ---- 回覆 LINE ----
async function replyMessage(replyToken: string, text: string): Promise<void> {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      // LINE 單則訊息上限 5000 字
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
  });
}

// ---- 處理單一訊息事件 ----
async function handleEvent(event: any): Promise<void> {
  if (event.type !== "message" || event.message?.type !== "text") return;

  const replyToken: string = event.replyToken;
  const groupId: string | undefined = event.source?.groupId;
  const raw: string = (event.message.text ?? "").trim();

  // 群組 ID 查詢(任何來源都可用,方便設定 TARGET_GROUP_ID)
  if (raw === "群組id" || raw.toLowerCase() === "groupid") {
    await replyMessage(replyToken, `groupId:\n${groupId ?? "(此訊息不是來自群組)"}`);
    return;
  }

  // 只服務指定群組(TARGET_GROUP_ID 留空 = 不限制)
  if (TARGET_GROUP_ID && groupId !== TARGET_GROUP_ID) return;

  // 設定目標語言:設定-日文、韓文
  if (raw.startsWith(SETTINGS_PREFIX)) {
    if (!groupId) {
      await replyMessage(replyToken, "設定只能在群組裡使用。");
      return;
    }
    const langs = raw.slice(SETTINGS_PREFIX.length).split(/[、,，\/\s]+/).map((s) => s.trim()).filter(Boolean);
    if (langs.length === 0) {
      await replyMessage(replyToken, "用法:設定-日文、韓文(可填多個語言,用、或逗號分隔)");
      return;
    }
    const ok = await setTargetLangs(groupId, langs);
    await replyMessage(
      replyToken,
      ok ? `✅ 已更新中文翻譯的目標語言為:${langs.join("、")}` : "⚠️ 設定儲存失敗,請稍後再試。",
    );
    return;
  }

  // 翻譯:翻譯ai <文字>
  if (raw.toLowerCase().startsWith(TRIGGER)) {
    const content = raw.slice(TRIGGER.length).trim();
    if (!content) {
      await replyMessage(replyToken, "用法:嘿嘿 你要翻譯的文字");
      return;
    }
    let targets: string[];
    if (isChineseText(content)) {
      targets = groupId ? await getTargetLangs(groupId) : DEFAULT_TARGET_LANGS;
    } else {
      targets = ["繁體中文", "英文"];
    }
    try {
      const result = await translate(content, targets);
      await replyMessage(replyToken, result);
    } catch {
      await replyMessage(replyToken, "⚠️ 翻譯服務暫時無法使用,請稍後再試。");
    }
    return;
  }

  // 其他訊息一律忽略
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!(await verifySignature(rawBody, signature))) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: { events?: any[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // 逐一處理事件;個別事件失敗不影響整體回 200(LINE 會把非 2xx 視為失敗並重送)
  await Promise.all(
    (payload.events ?? []).map((e) =>
      handleEvent(e).catch((err) => console.error("handleEvent error:", err))
    ),
  );

  return new Response("ok", { status: 200 });
});
