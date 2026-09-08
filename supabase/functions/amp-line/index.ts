// 安麗蛋白素比賽 — LINE OA webhook(Supabase Edge Function / Deno)
//
// 這支只做三件事:驗簽、加好友建帳號、固定關鍵字回覆(帶 LIFF 入口卡片)。
// 刻意不接 AI —— 比賽用途,產品資訊講錯的風險大於方便性,
// 所以 zip 裡 ai-config.json 的 AI 分流在這個專案關閉。
//
// 骨架照抄 supabase/functions/cofounder-line/index.ts(驗簽、逐事件錯誤隔離)。
//
// 部署(LINE 不會帶 Supabase JWT,--no-verify-jwt 是必須的):
//   supabase functions deploy amp-line --no-verify-jwt
//
// 額外 secrets:
//   AMP_LIFF_URL_COMPACT  半頁 LIFF,例:https://liff.line.me/xxxxxxxx-xxxxxxxx
//   AMP_LIFF_URL_FULL     全頁 LIFF

import {
  C, HONESTY, lineReply, textMsg, upsertMember, verifySignature,
} from "../_shared/amp.ts";

const LIFF_COMPACT = Deno.env.get("AMP_LIFF_URL_COMPACT") ?? "";
const LIFF_FULL = Deno.env.get("AMP_LIFF_URL_FULL") ?? "";

const url = (base: string, view: string) => `${base}${base.includes("?") ? "&" : "?"}view=${view}`;

// 固定回覆(對應 zip 的 fixed-replies.json,改成這場比賽的用語)。
// 命中就直接回,不做任何其他處理。
const MENU: Record<string, { view: string; full: boolean; label: string }> = {
  任務: { view: "score", full: false, label: "任務加分" },
  加分: { view: "score", full: false, label: "任務加分" },
  分數: { view: "board", full: true, label: "排行榜" },
  排行: { view: "board", full: true, label: "排行榜" },
  挑戰: { view: "quiz", full: true, label: "每日問答" },
  問答: { view: "quiz", full: true, label: "每日問答" },
  戳: { view: "board", full: true, label: "戳夥伴" },
};

function entryCard(label: string, view: string, full: boolean) {
  const base = (full ? LIFF_FULL : LIFF_COMPACT) || LIFF_COMPACT || LIFF_FULL;
  return {
    type: "flex",
    altText: `打開${label}`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        backgroundColor: C.cream, paddingAll: "20px",
        contents: [
          { type: "text", text: "安麗蛋白素 7 天挑戰", size: "xs", color: C.grey },
          { type: "text", text: label, size: "xl", weight: "bold", color: C.green },
          {
            type: "text", wrap: true, size: "sm", color: C.ink,
            text: "自己吃一湯匙 +1 · 分享一次 +3 · 推薦一罐 +5 · 問答答對 +1",
          },
          { type: "text", text: HONESTY, size: "xs", color: C.leaf, align: "center" },
        ],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px",
        contents: [{
          type: "button", style: "primary", color: C.green, height: "sm",
          action: { type: "uri", label: `打開${label}`, uri: url(base, view) },
        }],
      },
    },
  };
}

const HELP = [
  "安麗蛋白素 7 天挑戰 🥤",
  "",
  "打「加分」→ 記錄今天的行動",
  "打「排行」→ 看排行榜、戳夥伴",
  "打「問答」→ 今日一題,答對 +1",
  "",
  `計分:吃一湯匙 +1 / 分享 +3 / 推薦一罐 +5 / 答對 +1`,
  `推薦與分享要填對方名字 —— ${HONESTY}`,
].join("\n");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const sig = req.headers.get("x-line-signature") ?? "";
  if (!(await verifySignature(raw, sig))) {
    console.error("bad signature");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  for (const ev of (body?.events ?? [])) {
    // 一則事件出錯不影響其他事件,並且一律回 200(LINE 會重送)。
    try {
      const userId = ev?.source?.userId ?? "";

      if (ev.type === "follow" && userId) {
        await upsertMember(userId, "", "");
        await lineReply(ev.replyToken, [
          textMsg(`歡迎加入挑戰!\n\n${HELP}`),
          entryCard("任務加分", "score", false),
        ]);
        continue;
      }

      if (ev.type !== "message" || ev.message?.type !== "text") continue;

      const text = String(ev.message.text ?? "").trim();
      const hit = Object.keys(MENU).find((k) => text.includes(k));

      if (hit) {
        const m = MENU[hit];
        await lineReply(ev.replyToken, [entryCard(m.label, m.view, m.full)]);
      } else {
        await lineReply(ev.replyToken, [textMsg(HELP)]);
      }
    } catch (e) {
      console.error("event", (e as Error).message);
    }
  }

  return new Response("OK", { status: 200 });
});
