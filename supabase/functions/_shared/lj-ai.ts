// 生命之旅 — 呼叫 Claude 的三件事:要不要追問、寫自我探索結果、寫一段旅程。
//
// 金鑰:Supabase Edge Secret ANTHROPIC_API_KEY(SDK 會自己讀這個名字)。
// 模型:claude-opus-5-5。另外開了 server-side fallback(fallbacks: "default"):
//   萬一安全分類器誤擋,API 會在同一次呼叫裡自動換備援模型重跑,使用者不會看到錯誤。
// 一律要 AI 回 JSON(output_config.format),欄位固定,前端不用猜。

import Anthropic from "npm:@anthropic-ai/sdk";
import { sbInsert } from "./lj.ts";

const MODEL = "claude-opus-5-5";
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const client = KEY ? new Anthropic({ apiKey: KEY }) : null;

export const aiReady = () => !!client;

export type Answer = { question: string; picked: string[]; other: string };

// 中文句子裡的半形標點換成全形(英文、數字之間的不動)
const CJK = "[\\u3000-\\u9fff\\uff00-\\uffef]";
const PUNCT: Record<string, string> = { ",": "，", ";": "；", ":": "：", "?": "？", "!": "！" };
export function zh(t: string): string {
  return String(t ?? "").replace(new RegExp(`(?<=${CJK})\\s*([,;:?!])\\s*|\\s*([,;:?!])\\s*(?=${CJK})`, "g"),
    (_m, a1, a2) => PUNCT[a1 || a2]).trim();
}

// 把作答整理成給 AI 看的純文字。自由輸入的原文保留,那是故事最有個人味的來源。
export function answersText(answers: Answer[]): string {
  return answers.map((a, i) => {
    const parts = [...a.picked];
    if (a.other) parts.push(`(自己說)${a.other}`);
    return `第 ${i + 1} 題:${a.question}\n回答:${parts.join("、") || "(沒有回答)"}`;
  }).join("\n\n");
}

async function ask(opts: {
  kind: string; memberId: string | null; system: string; content: any[];
  schema: Record<string, unknown>; effort: "low" | "medium" | "high";
}): Promise<any> {
  if (!client) throw new Error("AI_NOT_CONFIGURED");
  let res: any;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort, format: { type: "json_schema", schema: opts.schema } },
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    } as any);
  } catch (e) {
    await log(opts.kind, opts.memberId, null, false, String((e as Error)?.message ?? e).slice(0, 300));
    if (e instanceof Anthropic.RateLimitError) throw new Error("AI_BUSY");
    if (e instanceof Anthropic.APIError) throw new Error(`AI_ERROR_${e.status}`);
    throw new Error("AI_ERROR");
  }

  if (res.stop_reason === "refusal") {
    await log(opts.kind, opts.memberId, res, false, `refusal:${res.stop_details?.category ?? ""}`);
    throw new Error("AI_REFUSED");
  }
  const text = [...res.content].reverse().find((b: any) => b.type === "text")?.text ?? "";
  try {
    const out = JSON.parse(text);
    await log(opts.kind, opts.memberId, res, true, "");
    return out;
  } catch {
    await log(opts.kind, opts.memberId, res, false, `bad_json:${res.stop_reason}`);
    throw new Error("AI_BAD_OUTPUT");
  }
}

async function log(kind: string, memberId: string | null, res: any, ok: boolean, note: string) {
  try {
    await sbInsert("lj_ai_log", {
      member_id: memberId, kind, model: res?.model ?? MODEL, ok, note,
      input_tokens: res?.usage?.input_tokens ?? 0, output_tokens: res?.usage?.output_tokens ?? 0,
    });
  } catch (e) {
    console.error("ai log", (e as Error).message);   // 記帳失敗不能讓使用者的請求跟著失敗
  }
}

// 共同底線:規格第五節的「重要限制」
const RULES = `
【絕對規則】
- 全程使用繁體中文(台灣用語)。
- 只能根據提供的內容寫,不捏造使用者沒提到的經歷、人物、地點。
- 線索只有一條時,用「可能」「似乎」「從回答中看見」這類保留語氣,不把推測寫成事實。
- 不做人格分類、不做心理診斷、不貼標籤。
- 不寫誰都適用的勵志套話,例如「善良、熱情、勇敢、充滿可能性」。
- 選擇安靜、謹慎、重視穩定,不是缺點,不要暗示他應該更積極。
- 資訊不足就寫短一點,不要硬湊特色。

【寫法】
- 用自己的話重新說,不要逐字複述題目或選項的字句(例如不要出現「完全屬於自己」「看看不同的世界」這種原句)。
- 先找出一條貫穿好幾題的主線,用它當骨幹;不要一題一句、照題號順序講一遍。
- 不要把使用者選的價值原樣排成一串(例如「自由與自主、學習與成長、體驗與生活樂趣」)。
- 不要用「原來,我是」開頭,也不要用「……是我最想守住的東西」「這些都是我……」這類收尾總結句。
- 標點一律用全形（，。、「」：？）。`;

// ---- 1. 前 6 題答完,要不要追問 ----
const FOLLOW_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["needs_followup", "reason", "questions"],
  properties: {
    needs_followup: { type: "boolean" },
    reason: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["text", "options"],
        properties: { text: { type: "string" }, options: { type: "array", items: { type: "string" } } },
      },
    },
  },
};

export async function judgeFollowup(memberId: string | null, answers: Answer[]) {
  const out = await ask({
    kind: "followup", memberId, effort: "low", schema: FOLLOW_SCHEMA,
    system: `你在設計一份輕鬆的自我探索問答。使用者剛答完 6 題核心問題,請判斷要不要追問。
只有在下列情況才追問,最多 2 題:
1. 回答太籠統,分不出背後的動機。
2. 不同回答之間有值得釐清的張力(例如同時重視自由與穩定)。
3. 缺乏具體的生活例子,寫出來的故事容易流於制式(例如完全沒有「自己說」的內容)。
素材已經足夠就不要追問,不要為了湊題數而問。
每題追問要口語、生活化、一句話問完,並給剛好 4 個選項(每個 6–16 字,彼此不重疊、沒有好壞)。
不要問隱私或敏感的事(健康、收入、感情狀況、宗教、政治)。全程繁體中文。`,
    content: [{ type: "text", text: answersText(answers) }],
  });
  const qs = Array.isArray(out.questions) ? out.questions : [];
  return {
    needs: !!out.needs_followup && qs.length > 0,
    reason: String(out.reason ?? ""),
    questions: qs.slice(0, 2)
      .filter((q: any) => q?.text && Array.isArray(q.options) && q.options.length >= 2)
      .map((q: any) => ({ text: zh(q.text).slice(0, 120), options: q.options.slice(0, 4).map((o: any) => zh(o).slice(0, 40)) })),
  };
}

// ---- 2. 自我探索的結果 ----
const PROFILE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["tagline", "story", "highlights", "future", "note_to_self", "evidence"],
  properties: {
    tagline: { type: "string" },
    story: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    future: { type: "string" },
    note_to_self: { type: "string" },
    evidence: {
      type: "object", additionalProperties: false,
      required: ["tagline", "story", "highlights", "future"],
      properties: {
        tagline: { type: "string" }, story: { type: "string" },
        highlights: { type: "array", items: { type: "string" } }, future: { type: "string" },
      },
    },
  },
};

export async function writeProfile(memberId: string | null, name: string, answers: Answer[], extra = "") {
  const out = await ask({
    kind: extra ? "profile_rewrite" : "profile", memberId, effort: "medium", schema: PROFILE_SCHEMA,
    system: `你在幫一個人整理他的自我探索問答,寫成放在他個人網頁上的一段介紹。目標不是替他定義人格,
而是幫他透過自己的回答,看見值得被看見的生活樣子。
${RULES}

【分析順序】
1 表面興趣(喜歡做什麼)→ 2 內在動機(為什麼喜歡)→ 3 行動與人際模式 → 4 核心價值 → 5 生活期待。
把五層交叉比對,找出重複出現的主題。每個主題至少對應到一個具體回答。
兩個人就算都選了同一個興趣,動機、行動方式、價值不同,寫出來就必須不一樣。

【輸出】
- tagline:個人標語,一句自然、有記憶點的短句,15–25 個中文字。
- story:「原來,我是這樣的人」,第一人稱,100–150 字。
- highlights:我的生活亮點,剛好 3 項,每項 10–24 字,從回答整理出的興趣、優勢或重視的事。
- future:我期待的生活,第一人稱,50–80 字。
- note_to_self:給自己的話,一句簡短、自然、有溫度的話,8–24 字,不要加引號。
- evidence:每一欄依據哪幾題(例如「第 1、2、5 題」),只給檢查用,不會給使用者看。`,
    content: [{
      type: "text",
      text: `稱謂:${name || "(未提供)"}\n\n${answersText(answers)}` +
        (extra ? `\n\n【使用者看完上一版後補充】\n${extra}\n請以這段補充為優先,重新寫一版。` : ""),
    }],
  });
  return {
    tagline: zh(out.tagline).slice(0, 60),
    story: zh(out.story).slice(0, 400),
    highlights: (Array.isArray(out.highlights) ? out.highlights : []).slice(0, 3).map((x: any) => zh(x).slice(0, 60)),
    future: zh(out.future).slice(0, 240),
    note_to_self: zh(out.note_to_self).replace(/^[「"']|[」"']$/g, "").slice(0, 60),
    evidence: out.evidence ?? {},
  };
}

// ---- 3. 一段旅程:照片 + 3 個問題 ----
const STOP_SCHEMA = {
  type: "object", additionalProperties: false, required: ["title", "story"],
  properties: { title: { type: "string" }, story: { type: "string" } },
};

export async function writeStop(memberId: string | null, opts: {
  name: string; photo: { base64: string; mime: string }; whenLabel: string;
  answers: Answer[]; profile: { tagline: string; story: string; future: string } | null;
}) {
  const ctx = opts.profile
    ? `【這個人的自我介紹(只當背景參考,不要照抄)】\n標語:${opts.profile.tagline}\n${opts.profile.story}\n期待:${opts.profile.future}`
    : "";
  const out = await ask({
    kind: "stop", memberId: memberId, effort: "medium", schema: STOP_SCHEMA,
    system: `你在幫一個人把他人生中的一個片段,寫成他個人旅程網頁上的一張卡片。
你會看到一張照片、他對這張照片的回答,以及他的自我介紹當背景。
${RULES}
- 照片只描述看得見的東西,不猜照片裡的人是誰、幾歲、什麼關係;關係只能用他在回答裡說的。
- 不要描述照片裡人物的外貌、身材、長相。
- 同一個人的不同照片,故事要扣住這一張照片與這一次的回答,不要寫成他的自我介紹重述。

【輸出】
- title:這一段的標語,20–50 個中文字,像一句有畫面的話,不要用驚嘆號。
- story:第一人稱,80–140 字,用他的回答當骨幹,照片當畫面。`,
    content: [
      { type: "image", source: { type: "base64", media_type: opts.photo.mime, data: opts.photo.base64 } },
      {
        type: "text",
        text: `稱謂:${opts.name || "(未提供)"}\n時間:${opts.whenLabel || "(沒有填)"}\n\n${answersText(opts.answers)}\n\n${ctx}`,
      },
    ],
  });
  return {
    title: zh(out.title).slice(0, 80),
    story: zh(out.story).slice(0, 400),
  };
}
