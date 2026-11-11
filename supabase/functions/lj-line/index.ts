// 生命之旅 — LINE OA webhook(Supabase Edge Function / Deno)
//
// 只做三件事：驗簽、加好友建帳號、關鍵字回覆入口卡片。不接 AI(AI 只在 LIFF 裡)。
// 骨架沿用 amp-line(驗簽、逐事件錯誤隔離、一律回 200)。
//
// 部署(LINE 不會帶 Supabase JWT):verify_jwt = false
// 共用 secrets:AMP_LINE_CHANNEL_SECRET / AMP_LINE_CHANNEL_ACCESS_TOKEN(同一個 OA)

import { ensureMember, lineProfile, lineReply, verifySignature } from "../_shared/lj.ts";

const LJ_LIFF = "https://liff.line.me/2011511140-5AixRgyd";
const LJ_C = { ivory: "#F4F1DE", dusk: "#E07A5F", night: "#2E4057", ink: "#1D2B3A", muted: "#6B7A8C" };

type LjEntry = { label: string; page: string; desc: string };
const LJ_ENTRY: Record<string, LjEntry> = {
  add: { label: "增加我的生命之旅", page: "add.html", desc: "一張照片、三個問題，留下人生裡的一個時刻。" },
  mine: { label: "我的生命之旅", page: "journey.html", desc: "沿著路走一遍，看看你一路走來的樣子。" },
  find: { label: "看別人的旅程", page: "find.html", desc: "輸入朋友的四碼，走進他的旅程。" },
  gift: { label: "送一段回憶", page: "gift.html", desc: "一張照片、一段話，送進朋友的旅程裡。" },
  start: { label: "開始認識自己", page: "index.html", desc: "先回答幾個輕鬆的問題，AI 幫你寫下你是怎樣的人。" },
};

// 關鍵字 → 入口(由上往下比對，先中先回)
const LJ_KEYWORDS: [string, string][] = [
  ["送", "gift"], ["回憶", "gift"],
  ["別人", "find"], ["朋友", "find"], ["代碼", "find"], ["找", "find"],
  ["增加", "add"], ["新增", "add"], ["照片", "add"], ["紀錄", "add"], ["記錄", "add"],
  ["我的", "mine"], ["旅程", "mine"],
  ["開始", "start"], ["認識", "start"], ["問答", "start"],
];

function ljCard(e: LjEntry) {
  return {
    type: "flex",
    altText: `打開「${e.label}」`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", spacing: "md", backgroundColor: LJ_C.ivory, paddingAll: "20px",
        contents: [
          { type: "text", text: "生命之旅", size: "xs", color: LJ_C.muted },
          { type: "text", text: e.label, size: "xl", weight: "bold", color: LJ_C.night, wrap: true },
          { type: "text", text: e.desc, size: "sm", color: LJ_C.ink, wrap: true },
        ],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px",
        contents: [{
          type: "button", style: "primary", color: LJ_C.dusk, height: "sm",
          action: { type: "uri", label: "打開", uri: `${LJ_LIFF}/${e.page}` },
        }],
      },
    },
  };
}

const LJ_HELP = [
  "生命之旅 🌅",
  "",
  "點下方選單，或打：",
  "「增加」→ 用一張照片新增一段旅程",
  "「我的旅程」→ 看你一路走來的樣子",
  "「別人」→ 輸入四碼看朋友的旅程",
  "「送回憶」→ 把一段回憶送給朋友",
].join("\n");

const ljText = (text: string) => ({ type: "text", text });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("x-line-signature") ?? ""))) {
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
    try {   // 一則事件出錯不影響其他事件
      const userId = String(ev?.source?.userId ?? "");
      if (!ev?.replyToken) continue;

      if (ev.type === "follow" && userId) {
        const prof = await lineProfile(userId);
        await ensureMember(userId, prof.name, prof.picture);
        await lineReply(ev.replyToken, [
          ljText(`歡迎來到生命之旅${prof.name ? `，${prof.name}` : ""}。\n\n先花三分鐘認識自己，再一張照片一張照片，把你的旅程走出來。`),
          ljCard(LJ_ENTRY.start),
        ]);
        continue;
      }

      if (ev.type !== "message" || ev.message?.type !== "text") continue;
      const text = String(ev.message.text ?? "").trim().slice(0, 200);
      const hit = LJ_KEYWORDS.find(([k]) => text.includes(k));
      await lineReply(ev.replyToken, [hit ? ljCard(LJ_ENTRY[hit[1]]) : ljText(LJ_HELP)]);
    } catch (e) {
      console.error("event", (e as Error).message);
    }
  }

  return new Response("OK", { status: 200 });
});
