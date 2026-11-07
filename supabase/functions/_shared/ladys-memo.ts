// LadyS — 「記憶圖片」(單張)與「記憶以上圖片」(回覆的那張起到下指令為止,最多 20 張)
// 讀圖後判讀:要處理的 → 一般整理流程(行程/支出/收入/待辦/目標);參考資料 → 生活紀錄「其他」+ 一行摘要
import { ladysDeleteWhere, ladysInsert, ladysMask, ladysSelect, ladysTodayTaipei, ladysUpdate } from "./ladys.ts";
import { ladysImageReadMany } from "./ladys-image.ts";
import { ladysProcessPending } from "./ladys-extract.ts";

const LADYS_IMG_KEEP_DAYS = 7;
const LADYS_IMG_BATCH_MAX = 20;
const text = (t: string) => ({ type: "text", text: t });
const LADYS_IMG_ERR: Record<string, string> = {
  IMG_GONE: "這張圖片已經過期,LINE 不再提供下載了,請重新傳一次再回覆它 🙏",
  IMG_TOO_BIG: "圖片太大了,請截小一點再傳 🙏",
  IMG_NOT_IMAGE: "回覆的不是圖片喔,請長按圖片 →「回覆」→ 輸入指令",
};

// 家庭群組有人傳圖:只記訊息編號(不下載、不存圖),順便清掉超過 7 天的
export async function ladysRememberImage(ev: any, groupId: string) {
  await ladysInsert("ladys_images?on_conflict=ladys_line_msg_id", {
    ladys_line_msg_id: String(ev.message.id), ladys_group_id: groupId,
    ladys_user_uid: ev.source?.userId ?? null, ladys_sent_at: new Date(Number(ev.timestamp)).toISOString(),
  }, "resolution=ignore-duplicates,return=minimal");
  const before = new Date(Date.now() - LADYS_IMG_KEEP_DAYS * 864e5).toISOString();
  await ladysDeleteWhere("ladys_images", `ladys_sent_at=lt.${encodeURIComponent(before)}`);
}

async function ladysPickImages(ev: any, groupId: string, quoted: string, all: boolean) {
  const [anchor] = await ladysSelect("ladys_images", `ladys_line_msg_id=eq.${quoted}&select=*`);
  if (!all) {
    if (anchor?.ladys_done_at) return { error: "這張圖片之前已經記過了 👌" };
    if (!anchor) {
      await ladysInsert("ladys_images?on_conflict=ladys_line_msg_id", {
        ladys_line_msg_id: quoted, ladys_group_id: groupId, ladys_sent_at: new Date(Number(ev.timestamp)).toISOString(),
      }, "resolution=ignore-duplicates,return=minimal");
    }
    return { rows: [{ ladys_line_msg_id: quoted, ladys_sent_at: anchor?.ladys_sent_at ?? new Date(Number(ev.timestamp)).toISOString() }] };
  }
  if (!anchor || anchor.ladys_group_id !== groupId) {
    return { error: "找不到這張圖片的紀錄(只認得最近 7 天傳到這個群組的圖片)。可以改用「記憶圖片」一張一張記 🙏" };
  }
  const until = new Date(Number(ev.timestamp)).toISOString();
  const rows = await ladysSelect("ladys_images",
    `ladys_group_id=eq.${encodeURIComponent(groupId)}&ladys_sent_at=gte.${encodeURIComponent(anchor.ladys_sent_at)}` +
    `&ladys_sent_at=lte.${encodeURIComponent(until)}&ladys_done_at=is.null&order=ladys_sent_at.asc,id.asc&limit=${LADYS_IMG_BATCH_MAX}&select=*`);
  if (!rows.length) return { error: "這批圖片之前都記過了 👌" };
  return { rows };
}

// 回傳要 reply 的訊息陣列
export async function ladysMemorizeImages(ev: any, groupId: string, all: boolean): Promise<unknown[]> {
  const cmd = all ? "記憶以上圖片" : "記憶圖片";
  const quoted = String(ev.message?.quotedMessageId ?? "");
  if (!/^\d{1,30}$/.test(quoted)) return [text(`請長按${all ? "這批的第一張" : "要記的"}圖片 →「回覆」→ 輸入「${cmd}」📸`)];
  const picked = await ladysPickImages(ev, groupId, quoted, all);
  if ("error" in picked) return [text(picked.error as string)];
  const rows = picked.rows as any[];

  const reads = await ladysImageReadMany(rows.map((r) => r.ladys_line_msg_id));
  const okIds: string[] = [], actions: any[] = [], refs: { title: string; n: number }[] = [], life: any[] = [];
  let failed = 0, firstErr = "";
  reads.forEach((r, i) => {
    const row = rows[i];
    if (r.status === "rejected") { failed++; firstErr ||= r.reason instanceof Error ? r.reason.message : String(r.reason); return; }
    okIds.push(row.ladys_line_msg_id);
    const v = r.value;
    if (v.kind === "action" && v.text) {
      actions.push({
        ladys_line_msg_id: `img-${row.ladys_line_msg_id}`, ladys_group_id: groupId, ladys_user_uid: ev.source?.userId ?? null,
        ladys_text: ladysMask(`[圖片文字]\n${v.text}`).slice(0, 3000), ladys_sent_at: row.ladys_sent_at,
      });
    } else if (v.kind === "reference") {
      const pts = v.points.length ? v.points : (v.text ? [v.text.replace(/\s+/g, " ").slice(0, 100)] : []);
      if (!pts.length) return;
      const last = refs.at(-1);
      if (last && last.title === v.title) last.n++; else refs.push({ title: v.title, n: 1 });
      for (const p of pts) life.push({ ladys_date: ladysTodayTaipei(), ladys_kind: "other", ladys_content: ladysMask(`${v.title}:${p}`).slice(0, 120), ladys_owner: "both" });
    }
  });

  if (!okIds.length) return [text(LADYS_IMG_ERR[firstErr] ?? "讀圖片時出了點問題,請稍後再試一次 🙏")];
  await ladysUpdate("ladys_images", `ladys_line_msg_id=in.(${okIds.join(",")})`, { ladys_done_at: new Date().toISOString() });
  if (life.length) await ladysInsert("ladys_life", life, "return=minimal");

  let cards: unknown[] = [];
  if (actions.length) {
    await ladysInsert("ladys_messages?on_conflict=ladys_line_msg_id", actions, "resolution=ignore-duplicates,return=minimal");
    cards = (await ladysProcessPending(all ? `${okIds.length} 張圖片記好了 📸` : "圖片記好了 📸", "update")).cards;
  }
  const notes: string[] = [];
  if (refs.length) notes.push(`📁 已存入生活紀錄:${refs.map((r) => r.n > 1 ? `${r.title}(${r.n} 張)` : r.title).join("、")}`);
  if (failed) notes.push(`⚠️ 有 ${failed} 張讀不到(可能已過期或太大)`);
  if (!cards.length && !refs.length) notes.unshift("看完圖片了,沒有需要記錄的行程、支出、收入、待辦或生活資料 👌");
  return [...cards.slice(0, 4), ...(notes.length ? [text(notes.join("\n"))] : [])];
}
