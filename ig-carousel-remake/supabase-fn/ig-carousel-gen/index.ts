import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const STYLE_BASE = `Black and white hand-drawn comic illustration, sketch style, expressive line art.
Two recurring characters: HUSBAND (nerdy man, round glasses, star-shaped sparkly eyes when excited about AI/tech) and WIFE (practical woman, often crossed arms, tired/exasperated expression).
Clean white background, bold black outlines, no shading, no color.
Include Chinese text labels and speech bubbles directly in the image.
Instagram square format 1:1 ratio. Clean, readable, energetic.`;

const SLIDES = [
  {
    filename: "slide1-cover.png",
    prompt: `${STYLE_BASE}

SLIDE 1 — COVER.
Large bold title at top: "用AI自動做影片"
Subtitle below: "裝這5個工具就夠了"

Scene: HUSBAND at desk with laptop, arms raised, huge star eyes (very excited).
WIFE standing behind him, arms crossed, flat tired expression.
HUSBAND speech bubble: "AI幫我自動剪片！"
WIFE speech bubble: "好啦好啦，我教你裝..."

Bottom small text: "老婆教我別再跟AI聊天"
Energetic comic composition.`,
  },
  {
    filename: "slide2-why-tools.png",
    prompt: `${STYLE_BASE}

SLIDE 2 — Educational infographic comic.
Title at top: "為什麼AI自己不會剪片？"

Three-panel layout:
LEFT PANEL: Cartoon floating brain labeled "AI大腦", speech bubble: "我只會下指令"
RIGHT PANEL: Multiple robot arms/hands labeled "ffmpeg" "Whisper" "yt-dlp", label: "工具＝手腳"
BOTTOM PANEL (full width): HUSBAND sitting between them like a conductor with a baton,
  speech bubble: "AI下令＋工具執行＝自動做影片！"

Summary text box at bottom: "AI＝大腦　工具＝手腳　缺一不可"`,
  },
  {
    filename: "slide3-which-ai.png",
    prompt: `${STYLE_BASE}

SLIDE 3 — Menu comparison comic.
Title at top: "四家AI，哪個適合你？"

Scene: Restaurant-style menu board. HUSBAND points at it with star eyes.
WIFE holds clipboard checklist beside him.

Menu board:
☑ Claude Code    "付費｜skill最成熟"
☑ Codex CLI      "可免費｜本來用ChatGPT最順"
☑ Cursor         "有免費版｜怕終端機的人"
☑ Antigravity    "有免費額度｜Google重度用戶"

HUSBAND pointing at Claude Code (star eyes).
WIFE pointing at free options, speech bubble: "先從免費的試！"`,
  },
  {
    filename: "slide4-install-list.png",
    prompt: `${STYLE_BASE}

SLIDE 4 — Shopping list comic.
Title at top: "到底要先裝什麼？"

HUSBAND holding an enormous scroll, looks determined.
WIFE with pen checking items, pointing at ffmpeg, speech bubble: "這個最重要！"

Scroll content — two sections:
【地基】裝一次終身用：
• Homebrew  • Python  • Node  • 中文字型

【核心五件套】：
⭐ ffmpeg  ← big star, underlined, "AI八成指令都靠它！"
• Whisper  • Auto-Editor  • yt-dlp  • ImageMagick`,
  },
  {
    filename: "slide5-tool-map.png",
    prompt: `${STYLE_BASE}

SLIDE 5 — Reference map comic.
Title at top: "你想做的，對應哪個工具？"

WIFE holds a large map/guide, knowledgeable pose.
HUSBAND with notebook taking notes, speech bubble: "原來這麼清楚！"

Flowchart arrows (left → right):
錄音轉文字  →  Whisper / MacWhisper / SenseVoice
上字幕      →  Whisper出SRT ＋ ffmpeg燒
自動快剪    →  Auto-Editor
上字卡      →  ImageMagick ＋ ffmpeg
配音        →  ElevenLabs
配樂混音    →  ffmpeg

WIFE corner speech bubble: "學會了嗎？學會就去睡覺！"`,
  },
];

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const slideParam = url.searchParams.get("slide");
  const slideIndex = parseInt(slideParam ?? "0", 10);

  if (isNaN(slideIndex) || slideIndex < 0 || slideIndex >= SLIDES.length) {
    return new Response(
      JSON.stringify({ error: `slide 必須是 0~${SLIDES.length - 1}`, total: SLIDES.length }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  const slide = SLIDES[slideIndex];
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY secret 未設定" }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  console.log(`生成 slide ${slideIndex}: ${slide.filename}`);

  const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: slide.prompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    return new Response(
      JSON.stringify({ error: "OpenAI 失敗", detail: err }),
      { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  const data = await openaiRes.json();
  const b64 = data.data?.[0]?.b64_json;

  if (!b64) {
    return new Response(
      JSON.stringify({ error: "OpenAI 未回傳圖片" }),
      { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Decode base64 → binary
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  return new Response(binary, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${slide.filename}"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
});
