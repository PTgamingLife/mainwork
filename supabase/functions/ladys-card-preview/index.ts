// LadyS — 卡片樣式預覽:推一張樣本卡片到綁定群組(不影響正式推播)
//   supabase functions deploy ladys-card-preview --no-verify-jwt
//   POST + header x-ladys-key(= ladys_push_auth.ladys_token)

import { ladysCard, ladysCheckCronKey, ladysJson, ladysPush, ladysSettings } from "../_shared/ladys.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  const s = await ladysSettings();
  if (!s.ladys_group_id) return ladysJson({ error: "NO_GROUP" }, 400);
  const card = ladysCard("新卡片樣式預覽", [
    "這是圓形按鈕的樣本卡片 👇",
    "【行程】",
    "👫 週六 10:00 帶媽媽去看醫生",
    "【待辦】",
    "☐ 準備戶口名簿、401 報表、國泰存摺",
  ], { view: "list", label: "查看修改" });
  try {
    await ladysPush(s.ladys_group_id, [card]);
    return ladysJson({ ok: true });
  } catch (e) {
    return ladysJson({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }, 502);
  }
});
