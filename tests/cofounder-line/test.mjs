// AI 合夥人 LINE webhook 的測試。用 Node 內建的 type stripping 直接跑 TypeScript 原始碼:
//   node --experimental-strip-types tests/cofounder-line/test.mjs
// harness.mjs 假造 Deno、fetch、Supabase REST、LINE API 與 Anthropic,不會打到任何真實服務。

import * as H from "./harness.mjs";
await import("../../supabase/functions/cofounder-line/index.ts"); // 執行 Deno.serve,拿到 handler

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const text = (t) => ({ content: [{ type: "text", text: t }], stop_reason: "end_turn" });
const ev = (id, txt, userId = "U-me") => ({
  events: [{
    type: "message", webhookEventId: id, replyToken: "rt-" + id,
    source: { userId }, message: { type: "text", id: "msg-" + id, text: txt },
  }],
});
const member = () => H.db.members.push({ id: "m1", line_user_id: "U-me", display_name: "PT" });

console.log("\n[1] 簽章驗證");
H.reset();
ok("錯誤簽章 → 401", (await H.post(ev("e0", "hi"), { badSig: true })).status === 401);
H.setAnthropicQueue([]);
ok("正確簽章 + 未註冊 → 200 且不呼叫 LLM",
   (await H.post(ev("e1", "hi"))).status === 200 && H.calls.anthropic.length === 0);

console.log("\n[2] allowlist 與綁定");
H.reset();
await H.post(ev("e2", "隨便問個問題", "U-stranger"));
ok("陌生人訊息 → 靜默忽略,不建成員、不呼叫 LLM",
   H.db.members.length === 0 && H.calls.anthropic.length === 0 && H.calls.linePush.length === 0);
await H.post(ev("e3", "綁定 GO123", "U-new"));
ok("正確綁定碼 → 建立成員 + 建 state", H.db.members.length === 1 && H.db.state.length === 1);
ok("綁定後有回覆", H.calls.lineReply.length === 1, JSON.stringify(H.calls.lineReply));
H.reset();
await H.post(ev("e4", "綁定 WRONG", "U-new"));
ok("錯誤綁定碼 → 不建成員", H.db.members.length === 0);

console.log("\n[3] 一般對話 → Haiku");
H.reset(); member();
H.setAnthropicQueue([text("今天先開 3 場對話。")]);
await H.post(ev("e5", "今天該做什麼"));
ok("用 claude-haiku-4-5", H.calls.anthropic[0]?.model === "claude-haiku-4-5", H.calls.anthropic[0]?.model);
ok("先 reply 收到", H.calls.lineReply[0]?.includes("收到"), H.calls.lineReply[0]);
ok("答案走 push", H.calls.linePush[0] === "今天先開 3 場對話。", H.calls.linePush[0]);
ok("system 有帶 cache_control",
   H.calls.anthropic[0]?.system?.[0]?.cache_control?.type === "ephemeral");
ok("system 含注入防禦", String(H.calls.anthropic[0]?.system?.[0]?.text).includes("不可信的資料來源"));
ok("使用者訊息有存檔", H.db.messages.some((m) => m.role === "user" && m.text === "今天該做什麼"));
ok("回覆有存檔", H.db.messages.some((m) => m.role === "assistant"));

console.log("\n[4] 覆盤 → Opus");
H.reset(); member();
H.setAnthropicQueue([text("對帳:今天差 1 場對話。")]);
await H.post(ev("e6", "覆盤"));
ok("用 claude-opus-5", H.calls.anthropic[0]?.model === "claude-opus-5", H.calls.anthropic[0]?.model);
H.reset(); member();
H.setAnthropicQueue([text("週會")]);
await H.post(ev("e7", "來開週會"));
ok("「週會」也走 Opus", H.calls.anthropic[0]?.model === "claude-opus-5");

console.log("\n[5] 冪等(LINE 重送)");
H.reset(); member();
H.setAnthropicQueue([text("第一次")]);
await H.post(ev("dup", "回報一下"));
await H.post(ev("dup", "回報一下"));
ok("同一個 eventId 只呼叫一次 LLM", H.calls.anthropic.length === 1, `calls=${H.calls.anthropic.length}`);
ok("同一個 eventId 只存一則 user 訊息",
   H.db.messages.filter((m) => m.role === "user").length === 1);

console.log("\n[6] 額度上限");
H.reset(); member();
H.calls.quotaOk = false;
H.setAnthropicQueue([]);
await H.post(ev("e8", "哈囉"));
ok("超額 → 不呼叫 LLM", H.calls.anthropic.length === 0);
ok("超額 → 回覆額度訊息", H.calls.lineReply[0]?.includes("額度"), H.calls.lineReply[0]);

console.log("\n[7] tool use 落資料");
H.reset(); member();
H.setAnthropicQueue([
  { content: [{ type: "tool_use", id: "t1", name: "record_daily",
      input: { conversations: 3, leads: 2, pitches: 1, deals: 0, revenue: 0, ai_ratio: 60 } }],
    stop_reason: "tool_use" },
  text("記好了。本月 0 / 60,000。"),
]);
await H.post(ev("e9", "回報 3 2 1 0 0 60"));
ok("寫進 cofounder_daily", H.db.daily.length === 1, JSON.stringify(H.db.daily));
ok("數字正確", H.db.daily[0]?.conversations === 3 && H.db.daily[0]?.ai_ratio === 60);
ok("action_date 是台北日期",
   H.db.daily[0]?.action_date === new Intl.DateTimeFormat("en-CA",
     { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
   H.db.daily[0]?.action_date);
ok("工具結果餵回去做第二輪", H.calls.anthropic.length === 2);
ok("最終文字有 push", H.calls.linePush[0]?.includes("記好了"));

H.reset(); member();
H.setAnthropicQueue([
  { content: [{ type: "tool_use", id: "t2", name: "record_revenue",
      input: { amount: 15000, source: "1對1導入(早鳥)", client: "客戶A" } }], stop_reason: "tool_use" },
  text("開張了。"),
]);
await H.post(ev("e10", "收到第一筆 15000"));
ok("寫進 cofounder_revenue", H.db.revenue[0]?.amount === 15000, JSON.stringify(H.db.revenue));

H.reset(); member();
H.setAnthropicQueue([
  { content: [{ type: "tool_use", id: "t3", name: "record_revenue", input: { amount: 0, source: "x" } }],
    stop_reason: "tool_use" },
  text("金額怪怪的,再說一次?"),
]);
await H.post(ev("e11", "收到 0 元"));
ok("金額 <= 0 不寫入", H.db.revenue.length === 0);

console.log("\n[8] LLM 掛掉的降級");
H.reset(); member();
H.setAnthropicQueue([]);   // 空佇列 → anthropic() 會 throw
const degraded = await H.post(ev("e12", "哈囉"));
ok("回 200 給 LINE(不觸發重送)", degraded.status === 200, `status=${degraded.status}`);
ok("推一則錯誤提示", H.calls.linePush[0]?.includes("卡住"), H.calls.linePush[0]);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
