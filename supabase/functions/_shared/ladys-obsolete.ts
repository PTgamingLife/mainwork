// LadyS — 舊行程刪除確認:對話中提到「改期 / 取消」時,AI 標出被取代的舊行程 → 發確認卡(🗑️ 刪除 / 保留)
// 按鈕用 postback,webhook 收到後才真的刪(軟刪除 + 同步 Google),並用 reply 回一句(不扣推播額度)
import { LADYS_C, ladysDayLabel, ladysHm, ladysSelect, ladysTodayTaipei, ladysUpdate } from "./ladys.ts";
import { ladysGcalSweep } from "./ladys-gcal.ts";

const UUID = /^[0-9a-f-]{36}$/i;
const LADYS_DEL_MAX = 5;

export function ladysEventShort(e: any): string {
  const ymd = ladysTodayTaipei(new Date(e.ladys_start_at));
  return `${ladysDayLabel(ymd)} ${e.ladys_all_day ? "全天" : ladysHm(e.ladys_start_at)} ${e.ladys_title}`;
}

// 確認卡:每筆一行說明 + 兩顆按鈕
export function ladysDeleteConfirmCard(items: { event: any; reason: string }[]) {
  const rows = items.slice(0, LADYS_DEL_MAX).flatMap(({ event, reason }) => [
    { type: "text", text: `🗓️ ${ladysEventShort(event)}`, size: "sm", color: LADYS_C.ink, weight: "bold", wrap: true, margin: "lg" },
    ...(reason ? [{ type: "text", text: reason, size: "xs", color: LADYS_C.muted, wrap: true }] : []),
    {
      type: "box", layout: "horizontal", spacing: "sm", margin: "sm",
      contents: [
        { type: "button", style: "primary", color: LADYS_C.husband, height: "sm",
          action: { type: "postback", label: "🗑️ 刪除", data: `ladys_del=${event.id}` } },
        { type: "button", style: "secondary", height: "sm",
          action: { type: "postback", label: "保留", data: `ladys_keep=${event.id}` } },
      ],
    },
  ]);
  return {
    type: "flex",
    altText: `要刪除 ${items.length} 筆舊行程嗎?`,
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: LADYS_C.bg } },
      body: {
        type: "box", layout: "vertical", spacing: "xs",
        contents: [
          { type: "text", text: "LadyS", size: "xs", color: LADYS_C.wife, weight: "bold" },
          { type: "text", text: "這些舊行程要刪除嗎?", size: "lg", color: LADYS_C.ink, weight: "bold", wrap: true },
          { type: "text", text: "對話裡提到改期或取消,舊的那筆還在行事曆上", size: "xs", color: LADYS_C.muted, wrap: true },
          { type: "separator", color: LADYS_C.husband, margin: "md" },
          ...rows,
        ],
      },
    },
  };
}

// webhook 的 postback:回傳要 reply 的文字;不是本功能的 data 回 null
export async function ladysHandleDeletePostback(data: string): Promise<string | null> {
  const m = data.match(/^ladys_(del|keep)=(.+)$/);
  if (!m || !UUID.test(m[2])) return null;
  const [e] = await ladysSelect("ladys_events", `id=eq.${m[2]}&select=id,ladys_title,ladys_start_at,ladys_all_day,ladys_deleted`);
  if (!e) return "找不到這筆行程了 🤔";
  if (e.ladys_deleted) return `這筆已經刪除過了:${ladysEventShort(e)}`;
  if (m[1] === "keep") return `👌 保留:${ladysEventShort(e)}`;
  await ladysUpdate("ladys_events", `id=eq.${e.id}&ladys_deleted=eq.false`, { ladys_deleted: true, ladys_updated_at: new Date().toISOString() });
  try { await ladysGcalSweep(); } catch (err) { console.error("ladys del gcal", err instanceof Error ? err.message : err); }
  return `🗑️ 已刪除:${ladysEventShort(e)}`;
}
