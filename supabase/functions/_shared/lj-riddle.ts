// 生命之旅 — 每日腦筋急轉彎:題目卡、作答比對、各種回應
//
// 只在「今天的題目已推播,而且這個人有收到」時接手訊息:
//   作答中 → 每句都當答案;已完成 → 有命中旅程關鍵字就照常回入口卡,否則回「今天完成了」。

import { sbRpc, sbSelect } from "./lj.ts";

export const LJ_FIREWORKS = "https://ptgaminglife.github.io/mainwork/life-journey/media/fireworks.png";
const C = { night: "#1D2B3A", navy: "#2E4057", gold: "#F2CC8F", coral: "#E07A5F", ivory: "#F4F1DE", muted: "#A9B4C2" };

export const LJ_WRONG = [
  "差一點點……其實差很多 😂",
  "不對喔～再想想！",
  "這個答案很有創意，但不是它 🙈",
  "嗯……方向錯了，換個角度？",
  "冷靜，答案比你想的還冷 🧊",
  "錯！但我欣賞你的勇氣 💪",
  "不是這個啦，再給你一次機會",
  "你的腦袋在轉了，但轉錯方向 🌀",
  "好可惜！再猜一個？",
  "答錯了，不過離答案只差一個腦筋急轉彎的距離 😆",
];

// 台北日期(YYYY-MM-DD)
export function ljTaipeiDate(d = new Date()): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

// 去空白、標點、全半形差異,英文轉小寫
export function ljNorm(t: string): string {
  return String(t ?? "").normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

export function ljIsCorrect(text: string, answers: string[]): boolean {
  const t = ljNorm(text);
  return !!t && answers.some((a) => ljNorm(a) && t.includes(ljNorm(a)));
}

const txt = (text: string) => ({ type: "text", text });

export function ljRiddleCard(question: string) {
  return {
    type: "flex", altText: `🧠 今日腦筋急轉彎：${question}`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", spacing: "lg", backgroundColor: C.night, paddingAll: "22px",
        contents: [
          { type: "text", text: "🧠 今日腦筋急轉彎", size: "sm", color: C.gold },
          { type: "text", text: question, size: "lg", color: C.ivory, wrap: true, weight: "bold" },
          { type: "separator", color: C.navy },
          { type: "text", text: "直接在聊天室打答案就可以！", size: "sm", color: C.muted, wrap: true },
        ],
      },
    },
  };
}

export function ljSolvedCard(rank: number, answerLabel: string) {
  return {
    type: "flex", altText: `🎉 答對了！你是今天第 ${rank} 個答對的人！`,
    contents: {
      type: "bubble",
      hero: { type: "image", url: LJ_FIREWORKS, size: "full", aspectRatio: "2:1", aspectMode: "cover", animated: true },
      body: {
        type: "box", layout: "vertical", spacing: "md", backgroundColor: C.night, paddingAll: "22px",
        contents: [
          { type: "text", text: "🎉 答對了！", size: "xl", color: C.gold, weight: "bold", align: "center" },
          {
            type: "box", layout: "baseline", justifyContent: "center", spacing: "sm",
            contents: [
              { type: "text", text: "你是今天第", size: "md", color: C.ivory, flex: 0 },
              { type: "text", text: String(rank), size: "3xl", color: C.coral, weight: "bold", flex: 0 },
              { type: "text", text: "個答對的人！", size: "md", color: C.ivory, flex: 0 },
            ],
          },
          { type: "text", text: `答案：${answerLabel}`, size: "sm", color: C.muted, align: "center" },
        ],
      },
    },
  };
}

// 回傳要回覆的訊息;null = 不是題目時間/沒收到題目,交回一般流程
export async function ljRiddleReply(memberId: string, text: string, hitsKeyword: boolean): Promise<unknown[] | null> {
  const rows = await sbSelect("lj_riddles",
    `riddle_date=eq.${ljTaipeiDate()}&sent_at=not.is.null&select=id,answers,answer_label,reveal&limit=1`);
  const r = rows[0];
  if (!r) return null;

  const res = await sbRpc("lj_riddle_answer", {
    p_riddle: r.id, p_member: memberId, p_correct: ljIsCorrect(text, r.answers),
  });
  switch (res?.state) {
    case "solved": return [ljSolvedCard(res.rank, r.answer_label)];
    case "wrong": return [txt(`${LJ_WRONG[Math.floor(Math.random() * LJ_WRONG.length)]}（已答 ${res.wrong}/5）`)];
    case "revealed": return [txt(`揭曉答案：「${r.answer_label}」！${r.reveal}\n明天再來挑戰吧～`)];
    case "done": return hitsKeyword ? null : [txt("今天的題目你已經完成囉，明天見！")];
    default: return null;   // none:這個人沒收到今天的題目
  }
}
