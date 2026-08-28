// analyze-reel:抽幀+逐字稿 → 流量歸因 → 更新個人模型(學習迴圈)
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { b64encode, callClaude, extractJson } from "../_shared/claude.ts";
import { ANALYZE_SYSTEM } from "../_shared/prompts.ts";

const MAX_FRAMES = 20;
const MAX_SHOTS = 5;
const WHISPER_LIMIT = 25 * 1024 * 1024;

interface AnalyzeBody {
  videoPath: string;
  framePaths: { path: string; t: number }[];
  screenshotPaths: string[];
  sourceUrl?: string | null;
  isOwn?: boolean;
  metricsText?: string | null;
  durationSec?: number;
  skipTranscript?: boolean;
}

interface AnalyzeResult {
  report_md: string;
  case_md: string;
  updated_model_md: string;
  new_version: string;
  change_note: string;
}

async function download(sb: SupabaseClient, path: string): Promise<Blob> {
  const { data, error } = await sb.storage.from("reels").download(path);
  if (error || !data) throw new Error(`讀取檔案失敗(${path}):${error?.message}`);
  return data;
}

async function transcribe(video: Blob): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key || video.size > WHISPER_LIMIT) return null;
  const form = new FormData();
  form.append("file", video, "video.mp4");
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    console.error("Whisper 失敗:", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const data = await res.json();
  return typeof data.text === "string" ? data.text : null;
}

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

    const body = (await req.json()) as AnalyzeBody;
    if (!body.videoPath || !Array.isArray(body.framePaths) || !body.framePaths.length) {
      return jsonResponse({ error: "缺少影片或畫面幀" }, 400);
    }
    // 路徑必須落在使用者自己的資料夾(RLS 之外再擋一層)
    const allPaths = [
      body.videoPath,
      ...body.framePaths.map((f) => f.path),
      ...(body.screenshotPaths || []),
    ];
    if (allPaths.some((p) => !p.startsWith(`${userId}/`))) {
      return jsonResponse({ error: "檔案路徑不合法" }, 403);
    }

    // 1. 個人模型 + 案例編號
    const { data: models } = await supabase
      .from("user_models")
      .select("version, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!models || !models.length) {
      return jsonResponse({ error: "找不到你的個人模型,請先到「我的模型」頁載入" }, 400);
    }
    const model = models[0];
    const { count } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const caseNo = (count || 0) + 1;

    // 2. 口播逐字稿(可跳過)
    let transcript: string | null = null;
    if (!body.skipTranscript) {
      const video = await download(supabase, body.videoPath);
      transcript = await transcribe(video);
    }

    // 3. 組多模態內容:幀(標秒數)+ 後台截圖 + 文字脈絡
    const content: Parameters<typeof callClaude>[1] = [];
    const frames = body.framePaths.slice(0, MAX_FRAMES);
    for (const f of frames) {
      const blob = await download(supabase, f.path);
      content.push({ type: "text", text: `【畫面幀 ${f.t} 秒】` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64encode(await blob.arrayBuffer()) },
      });
    }
    for (const p of (body.screenshotPaths || []).slice(0, MAX_SHOTS)) {
      const blob = await download(supabase, p);
      content.push({ type: "text", text: "【後台數據截圖】" });
      content.push({
        type: "image",
        source: { type: "base64", media_type: blob.type || "image/jpeg", data: b64encode(await blob.arrayBuffer()) },
      });
    }
    content.push({
      type: "text",
      text:
        `# 影片資訊\n` +
        `- 這是${body.isOwn ? "使用者自己的影片(有後台數據,權重高)" : "別人的影片(外部參考案例)"}\n` +
        `- 片長:${body.durationSec ?? "未知"} 秒\n` +
        `- 出處連結:${body.sourceUrl || "未提供"}\n` +
        `- 案例編號:Case #${caseNo}\n\n` +
        `# 口播逐字稿\n${transcript || "(未取得 —— 依畫面幀與字卡分析)"}\n\n` +
        `# 使用者補充數據/背景\n${body.metricsText || "(未提供)"}\n\n` +
        `# 使用者目前的個人模型(${model.version})\n\n${model.content}`,
    });

    // 4. 歸因分析 + 模型改寫(一次呼叫)
    const raw = await callClaude(ANALYZE_SYSTEM, content, 16000);
    const result = extractJson<AnalyzeResult>(raw);
    if (!result.report_md || !result.updated_model_md || !result.new_version) {
      throw new Error("AI 輸出欄位不完整,請重試");
    }

    // 5. 寫入 case / analysis / 新版模型
    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .insert({
        user_id: userId,
        case_no: caseNo,
        source_url: body.sourceUrl || null,
        is_own: !!body.isOwn,
        content: result.case_md || "",
      })
      .select("id")
      .single();
    if (caseErr) throw new Error("寫入案例失敗:" + caseErr.message);

    await supabase.from("analyses").insert({
      user_id: userId,
      case_id: caseRow.id,
      report: result.report_md,
      transcript,
      metrics_text: body.metricsText || null,
    });

    const { error: modelInsErr } = await supabase.from("user_models").insert({
      user_id: userId,
      version: result.new_version,
      content: result.updated_model_md,
      change_note: result.change_note || `Case #${caseNo} 分析更新`,
    });
    if (modelInsErr) throw new Error("寫入新版模型失敗:" + modelInsErr.message);

    return jsonResponse({
      report_md: result.report_md,
      new_version: result.new_version,
      change_note: result.change_note,
      case_no: caseNo,
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
