// generate-script:依使用者的個人模型生成 Reels 腳本
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { callClaude } from "../_shared/claude.ts";
import { GENERATE_SYSTEM } from "../_shared/prompts.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "未登入" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "未登入" }, 401);
    const userId = userData.user.id;

    const { topic, material } = await req.json();
    if (!topic || typeof topic !== "string" || topic.length > 300) {
      return jsonResponse({ error: "請提供標題/主題(300 字內)" }, 400);
    }

    const { data: models, error: modelErr } = await supabase
      .from("user_models")
      .select("version, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (modelErr || !models || !models.length) {
      return jsonResponse({ error: "找不到你的個人模型,請先到「我的模型」頁載入" }, 400);
    }
    const model = models[0];

    const userText =
      `# 我的個人流量模型\n\n${model.content}\n\n---\n\n` +
      `# 本次任務\n\n標題/主題:${topic}\n\n` +
      (material ? `素材資料:\n${String(material).slice(0, 8000)}` : "素材資料:(未提供,請直接就標題發揮)");

    const scriptMd = await callClaude(GENERATE_SYSTEM, [
      { type: "text", text: userText },
    ]);

    const { error: insErr } = await supabase.from("scripts").insert({
      user_id: userId,
      topic,
      content: scriptMd,
      model_version: model.version,
    });
    if (insErr) console.error("scripts insert 失敗:", insErr.message);

    return jsonResponse({ script_md: scriptMd, model_version: model.version });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
