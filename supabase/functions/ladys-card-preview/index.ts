// LadyS — 卡片樣式預覽:推一則樣本訊息到綁定群組(不影響正式推播)
//   supabase functions deploy ladys-card-preview --no-verify-jwt
//   POST + header x-ladys-key(= ladys_push_auth.ladys_token)
// 目前預覽:動畫橫幅 + 大圓動畫圖示(一則輪播訊息,只算一次推播)

import { ladysCard, ladysCheckCronKey, ladysJson, ladysPush, ladysSettings } from "../_shared/ladys.ts";

const SAMPLES = [
  { title: "今日行程", hero: "morning", view: "calendar", lines: ["早安 ☀️", "【今天】", "👫 10:00 帶媽媽去看醫生"] },
  { title: "今日整理", hero: "night", view: "list", label: "查看修改", lines: ["今天辛苦了 🌙", "【待辦】", "☐ 準備戶口名簿"] },
  { title: "剛剛的對話整理好了", hero: "update", view: "todos", lines: ["記了 1 件待辦", "☐ 繳水費"] },
  { title: "LadyS 選單", hero: "menu", view: "money", lines: ["想看什麼?點下面的圓圈 👇"] },
  { title: "進行中的目標", hero: "menu", view: "goals", lines: ["🎯 半年還清債務"] },
  { title: "設定", hero: "menu", view: "settings", lines: ["說話方式、推播時間"] },
] as const;

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  const s = await ladysSettings();
  if (!s.ladys_group_id) return ladysJson({ error: "NO_GROUP" }, 400);
  const bubbles = SAMPLES.map((x) =>
    ladysCard(x.title, [...x.lines], { view: x.view, label: "label" in x ? x.label : undefined }, { hero: x.hero, anim: true }).contents
  );
  const msg = { type: "flex", altText: "LadyS 動畫卡片預覽", contents: { type: "carousel", contents: bubbles } };
  try {
    await ladysPush(s.ladys_group_id, [msg]);
    return ladysJson({ ok: true });
  } catch (e) {
    return ladysJson({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, 502);
  }
});
