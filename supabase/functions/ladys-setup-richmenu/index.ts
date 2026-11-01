// LadyS — 一次性設定圖文選單(兩格:⚙️ 設定 / 📅 我的記錄)
//   supabase functions deploy ladys-setup-richmenu --no-verify-jwt
//   POST { image_url } + header x-ladys-key(= ladys_push_auth.ladys_token)
// 只連結到帳號擁有者與 ladys_members(per-user),不動這個 OA 的預設選單與其他圖文選單;
// 重跑時只刪除名稱為 ladys-main 的舊選單。圖片 2500x843 PNG,只接受本 repo 的 raw 網址。

import { LADYS_LIFF_URL, LADYS_LINE_TOKEN, ladysCheckCronKey, ladysJson, ladysLine, ladysSelect } from "../_shared/ladys.ts";

const LADYS_OWNER_UID = "U55b426b2cefa9787c9c23c97b45963fe";
const LADYS_MENU: [string, string][] = [["settings", "設定"], ["calendar", "我的記錄"]];

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  if (!LADYS_LINE_TOKEN || !LADYS_LIFF_URL) return ladysJson({ error: "MISSING_SECRETS" }, 500);

  let imageUrl = "";
  try { imageUrl = String((await req.json())?.image_url ?? ""); } catch { /* */ }
  if (!imageUrl.startsWith("https://raw.githubusercontent.com/PTgamingLife/mainwork/")) return ladysJson({ error: "BAD_IMAGE_URL" }, 400);

  try {
    const img = await fetch(imageUrl);
    if (!img.ok) throw new Error(`IMAGE_${img.status}`);
    const png = new Uint8Array(await img.arrayBuffer());

    const { richmenus = [] } = await ladysLine("richmenu/list", undefined, "GET");
    const old = richmenus.filter((m: any) => m.name === "ladys-main");
    for (const m of old) await ladysLine(`richmenu/${m.richMenuId}`, undefined, "DELETE");

    const sep = LADYS_LIFF_URL.includes("?") ? "&" : "?";
    const { richMenuId } = await ladysLine("richmenu", {
      size: { width: 2500, height: 843 },
      selected: true,
      name: "ladys-main",
      chatBarText: "LadyS 選單",
      areas: LADYS_MENU.map(([view, label], i) => ({
        bounds: { x: i * 1250, y: 0, width: 1250, height: 843 },
        action: { type: "uri", label, uri: `${LADYS_LIFF_URL}${sep}view=${view}` },
      })),
    });
    const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: "POST", headers: { Authorization: `Bearer ${LADYS_LINE_TOKEN}`, "Content-Type": "image/png" }, body: png,
    });
    if (!up.ok) throw new Error(`UPLOAD_${up.status}:${(await up.text()).slice(0, 120)}`);

    const members = await ladysSelect("ladys_members", "select=ladys_line_uid");
    const uids = [...new Set([LADYS_OWNER_UID, ...members.map((m: any) => m.ladys_line_uid)])];
    await ladysLine("richmenu/bulk/link", { richMenuId, userIds: uids });
    return ladysJson({ ok: true, richMenuId, deletedOld: old.length, linked: uids.length });
  } catch (e) {
    return ladysJson({ error: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502);
  }
});
