// LadyS — 補充備註確認卡:對話內容是在補充「已存在的行程」時,AI 指出是哪一筆 → 發確認卡(📝 補到備註 / 略過)
// 按「補到備註」才把文字接到該行程備註後面(同步 Google 行事曆);存在 ladys_pending(kind=event_note),7 天沒按作廢
import { LADYS_C, ladysInsert, ladysMask, ladysSelect, ladysUpdate } from "./ladys.ts";
import { ladysGcalSweep } from "./ladys-gcal.ts";
import { ladysEventShort } from "./ladys-obsolete.ts";

const UUID = /^[0-9a-f-]{36}$/i;
const NOTE_MAX = 300;
const CARD_MAX = 5;
const EXPIRE_DAYS = 7;
const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

// 把 AI 回傳的 event_notes 轉成 pending 列並寫入;回傳可發卡的項目
export async function ladysQueueEventNotes(raw: unknown, existing: any[], groupId: string): Promise<{ id: string; event: any; note: string }[]> {
  if (!Array.isArray(raw) || !groupId) return [];
  const seen = new Set<string>();
  const items = raw
    .map((o: any) => ({ event: existing[Number(String(o?.ref ?? "").replace(/^E/i, "")) - 1], note: ladysMask(clip(o?.note, 150)) }))
    .filter((o) => o.note && o.event?.id && o.event.ladys_recur !== "yearly" && !String(o.event.ladys_note ?? "").includes(o.note) && !seen.has(o.event.id) && seen.add(o.event.id))
    .slice(0, CARD_MAX);
  if (!items.length) return [];
  const batch = crypto.randomUUID();
  const saved = await ladysInsert("ladys_pending", items.map((o) => ({
    ladys_batch: batch, ladys_kind: "event_note", ladys_group_id: groupId,
    ladys_payload: { event_id: o.event.id, note: o.note },
  })));
  return saved.map((p: any, i: number) => ({ id: p.id, event: items[i].event, note: items[i].note }));
}

export function ladysNoteConfirmCard(items: { id: string; event: any; note: string }[]) {
  const rows = items.slice(0, CARD_MAX).flatMap(({ id, event, note }) => [
    { type: "text", text: `🗓️ ${ladysEventShort(event)}`, size: "sm", color: LADYS_C.ink, weight: "bold", wrap: true, margin: "lg" },
    { type: "text", text: `📝 ${note}`, size: "xs", color: LADYS_C.muted, wrap: true },
    {
      type: "box", layout: "horizontal", spacing: "sm", margin: "sm",
      contents: [
        { type: "button", style: "primary", color: LADYS_C.husband, height: "sm", action: { type: "postback", label: "📝 補到備註", data: `ladys_nadd=${id}` } },
        { type: "button", style: "secondary", height: "sm", action: { type: "postback", label: "略過", data: `ladys_nskip=${id}` } },
      ],
    },
  ]);
  return {
    type: "flex",
    altText: `有 ${items.length} 則補充資訊,要補到行程備註嗎?`,
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: LADYS_C.bg } },
      body: {
        type: "box", layout: "vertical", spacing: "xs",
        contents: [
          { type: "text", text: "LadyS", size: "xs", color: LADYS_C.wife, weight: "bold" },
          { type: "text", text: "要補到這些行程的備註嗎?", size: "lg", color: LADYS_C.ink, weight: "bold", wrap: true },
          { type: "text", text: "對話像是在補充已有的行程", size: "xs", color: LADYS_C.muted, wrap: true },
          { type: "separator", color: LADYS_C.husband, margin: "md" },
          ...rows,
        ],
      },
    },
  };
}

// webhook 的 postback:回傳要 reply 的文字;不是本功能的 data 回 null
export async function ladysHandleNotePostback(data: string): Promise<string | null> {
  const m = data.match(/^ladys_(nadd|nskip)=(.+)$/);
  if (!m || !UUID.test(m[2])) return null;
  const fresh = encodeURIComponent(new Date(Date.now() - EXPIRE_DAYS * 864e5).toISOString());
  const claimed = await ladysUpdate("ladys_pending", `id=eq.${m[2]}&ladys_kind=eq.event_note&ladys_status=eq.pending&ladys_created_at=gte.${fresh}`,
    { ladys_status: m[1] === "nadd" ? "added" : "skipped" });
  const p = claimed[0];
  if (!p) return "這筆已經處理過了(或已超過 7 天)👌";
  const [e] = await ladysSelect("ladys_events", `id=eq.${p.ladys_payload?.event_id}&select=id,ladys_title,ladys_start_at,ladys_all_day,ladys_deleted,ladys_note`);
  if (!e || e.ladys_deleted) return "找不到這筆行程了 🤔";
  if (m[1] === "nskip") return `👌 略過:${ladysEventShort(e)}`;
  const add = String(p.ladys_payload?.note ?? "");
  const cur = String(e.ladys_note ?? "");
  const next = cur.includes(add) ? cur : (cur ? `${cur}\n${add}` : add).slice(0, NOTE_MAX);
  if (next !== cur) {
    await ladysUpdate("ladys_events", `id=eq.${e.id}`, { ladys_note: next, ladys_updated_at: new Date().toISOString() });
    try { await ladysGcalSweep(); } catch (err) { console.error("ladys note gcal", err instanceof Error ? err.message : err); }
  }
  return `📝 已補到備註:${ladysEventShort(e)}`;
}
