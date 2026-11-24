// LadyS — 長語音整理卡「回覆 → 執行」:把那一則錄音裡的行程 / 待辦逐筆列出確認(24 小時內有效)
// 待辦可「✅ 加入 + 派給 agent」或「只加入」,行程「✅ 加入行事曆」;每筆都要按,沒按的照 ladys_pending 規則 7 天作廢。
// 只認帳號擁有者(呼叫端檢查 uid)。postback:ladys_rx=<pendingId>:a(加入+派工) / :i(只加入);略過沿用 ladys_wskip。
import { LADYS_C, ladysDayLabel, ladysHm, ladysInsert, ladysSelect, ladysTodayTaipei, ladysUpdate } from "./ladys.ts";
import { ladysGcalSweep } from "./ladys-gcal.ts";
import { ladysPickAgent } from "./ladys-agenttask.ts";
import { ladysRecordPendingRows } from "./ladys-record.ts";

const WINDOW_MS = 24 * 3600_000;
const UUID = /^[0-9a-f-]{36}$/i;
const LABEL: Record<string, string> = { marketing: "📣 行銷", editor: "🎬 剪片", coach: "🏋️ 教練" };
const text = (t: string) => ({ type: "text", text: t });
export const ladysIsExecCmd = (t: string) => /^執行[!!。.]?$/.test(t.trim());

function line(p: any): string {
  const d = p.ladys_payload;
  if (p.ladys_kind === "event") return `📅 ${ladysDayLabel(ladysTodayTaipei(new Date(d.ladys_start_at)))} ${d.ladys_all_day ? "全天" : ladysHm(d.ladys_start_at)} ${String(d.ladys_title).replace(/^🎙️ /, "")}`;
  return `☑️ ${String(d.ladys_content).replace(/^🎙️ /, "")}`;
}

function execCard(title: string, items: any[]) {
  const btn = (label: string, data: string, primary = false) => ({ type: "button", height: "sm", style: primary ? "primary" : "secondary",
    ...(primary ? { color: LADYS_C.husband } : {}), action: { type: "postback", label: label.slice(0, 20), data } });
  const rows = items.flatMap((p) => {
    const ag = p.ladys_payload?._agent;
    const buttons = p.ladys_kind === "event"
      ? [btn("✅ 加入行事曆", `ladys_rx=${p.id}:i`, true), btn("略過", `ladys_wskip=${p.id}`)]
      : ag ? [btn(`✅ 加入+派${LABEL[ag] ?? ""}`, `ladys_rx=${p.id}:a`, true), btn("只加入", `ladys_rx=${p.id}:i`), btn("略過", `ladys_wskip=${p.id}`)]
      : [btn("✅ 加入待辦", `ladys_rx=${p.id}:i`, true), btn("略過", `ladys_wskip=${p.id}`)];
    return [
      { type: "text", text: line(p), size: "sm", color: LADYS_C.ink, wrap: true, margin: "lg" },
      { type: "box", layout: "vertical", spacing: "xs", margin: "sm", contents: buttons },
    ];
  });
  return {
    type: "flex", altText: `▶️ 執行:${title}(${items.length} 項)`,
    contents: { type: "bubble", styles: { body: { backgroundColor: LADYS_C.bg } },
      body: { type: "box", layout: "vertical", spacing: "xs", contents: [
        { type: "text", text: "LadyS", size: "xs", color: LADYS_C.wife, weight: "bold" },
        { type: "text", text: `▶️ 執行:${title}`, size: "lg", color: LADYS_C.ink, weight: "bold", wrap: true },
        { type: "text", text: "每一筆都要按,沒按的不會寫入", size: "xs", color: LADYS_C.muted },
        { type: "separator", color: LADYS_C.husband, margin: "md" },
        ...rows,
      ] } },
  };
}

// 「執行」:quotedId = 被回覆的那張摘要卡的訊息 id;回傳要 reply 的訊息
export async function ladysExecCommand(quotedId: string, to: string): Promise<unknown[]> {
  if (!/^\d{1,30}$/.test(quotedId)) return [text("請長按錄音整理卡 → 回覆 → 輸入「執行」🎙️")];
  const [rec] = await ladysSelect("ladys_recordings",
    `ladys_status=eq.done&ladys_detail->sent=cs.${encodeURIComponent(JSON.stringify([quotedId]))}&select=id,ladys_title,ladys_detail,ladys_created_at`);
  if (!rec) return [text("找不到這張卡對應的錄音整理 🤔 請回覆「🎙️ 錄音整理」那張卡")];
  if (Date.now() - new Date(rec.ladys_created_at).getTime() > WINDOW_MS) return [text("這段錄音整理已超過 24 小時,不能再執行了 🙏")];
  const det = rec.ladys_detail ?? {};
  if (det.executed) return [text("這段錄音已經執行過了 👌")];
  const todos = Array.isArray(det.todos) ? det.todos : [];
  if (!todos.length && !(Array.isArray(det.events) && det.events.length)) return [text("這段錄音裡沒有要執行的待辦或行程 👌")];

  const picks = await Promise.all(todos.map((t: any) => ladysPickAgent(String(t?.content ?? "")).catch(() => null)));
  const withAgent: Record<number, string> = {};
  picks.forEach((p, i) => { if (p) withAgent[i] = p.agent; });
  const saved = await ladysInsert("ladys_pending", ladysRecordPendingRows(det, to, crypto.randomUUID(), withAgent));
  if (!saved.length) return [text("這段錄音裡沒有可執行的項目 👌")];
  await ladysUpdate("ladys_recordings", `id=eq.${rec.id}`, { ladys_detail: { ...det, executed: new Date().toISOString() } });
  const title = String(rec.ladys_title || "錄音整理").slice(0, 30);
  const cards = [];
  for (let i = 0; i < saved.length && cards.length < 5; i += 6) cards.push(execCard(title, saved.slice(i, i + 6)));
  return cards;
}

// postback ladys_rx=<id>:a|i:回傳要 reply 的文字;不是本功能的 data 回 null
export async function ladysHandleExecPostback(data: string): Promise<string | null> {
  const m = data.match(/^ladys_rx=([0-9a-f-]{36}):([ai])$/i);
  if (!m || !UUID.test(m[1])) return null;
  const fresh = encodeURIComponent(new Date(Date.now() - 7 * 864e5).toISOString());
  const [p] = await ladysUpdate("ladys_pending", `id=eq.${m[1]}&ladys_status=eq.pending&ladys_created_at=gte.${fresh}`, { ladys_status: "added" });
  if (!p) return "這筆已經處理過了(或已超過 7 天)👌";
  const { _agent, ...payload } = p.ladys_payload ?? {};
  await ladysInsert(p.ladys_kind === "event" ? "ladys_events" : "ladys_notes", { ...payload, ladys_source: "ai" }, "return=minimal");
  if (p.ladys_kind === "event") {
    try { await ladysGcalSweep(); } catch (e) { console.error("ladys rx gcal", e instanceof Error ? e.message : e); }
  }
  const agent = m[2] === "a" && LABEL[_agent] ? _agent : "";
  if (agent) {
    await ladysInsert("ladys_agent_tasks", { ladys_agent: agent, ladys_content: String(payload.ladys_content ?? "").replace(/^🎙️ /, "").slice(0, 1000),
      ladys_status: "待處理", ladys_route: "ai" }, "return=minimal");
  }
  return `✅ 已加入${agent ? `並派給 ${LABEL[agent]} agent` : ""}:${line(p).slice(2)}`;
}
