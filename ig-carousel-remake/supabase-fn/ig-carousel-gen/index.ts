import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const STYLE_BASE = `Black and white hand-drawn comic illustration, sketch style, expressive line art.
Two recurring characters: HUSBAND (nerdy man, round glasses, star-shaped sparkly eyes when excited about AI/tech) and WIFE (practical woman, often crossed arms, tired/exasperated expression).
Clean white background, bold black outlines, no shading, no color.
Include Chinese text labels and speech bubbles directly in the image.
Instagram square format 1:1 ratio. Clean, readable, energetic.
Account watermark bottom: "老婆教我別再跟AI聊天"`;

const SLIDES = [
  {
    filename: "slide1-cover.png",
    prompt: `${STYLE_BASE}

SLIDE 1 — COVER.
Large bold title at top: "Claude 有個隱藏模式"
Subtitle: "叫做「無限家教」"
Below: "4小時學會任何技能"

Scene: HUSBAND sitting at laptop, massive star-sparkle eyes, both hands raised in excitement. Claude logo visible on laptop screen.
WIFE standing beside him, arms crossed, one eyebrow raised skeptically.
HUSBAND speech bubble: "它可以教你從零開始學任何東西！！"
WIFE speech bubble: "...你是說你終於要學做家事了嗎？"

Bottom tag: "6個讓Claude變成你專屬家教的Prompt"
Energetic, eye-catching composition.`,
  },
  {
    filename: "slide2-learning-destroyer.png",
    prompt: `${STYLE_BASE}

SLIDE 2 — Prompt 1.
Large number "1" top-left corner.
Title: "學習曲線殺手"
Subtitle small: "The Learning Curve Destroyer"

Scene: HUSBAND at desk looking intense and focused, holding stopwatch. Clock on wall shows 4 hours countdown.
WIFE peeks in from doorway, confused expression.
HUSBAND speech bubble: "你是只剩4小時的老師，目標是讓我能實際用[技能]！"

Below scene, prompt card box:
「你是一位只有4小時的老師。
告訴我：
① 最先學什麼
② 完全忽略什麼
③ 做一次就超越70%人的那個練習
然後教我第一步，等我回應。」

WIFE thought bubble: "他終於不問AI廢話了..."`,
  },
  {
    filename: "slide3-error-simulator.png",
    prompt: `${STYLE_BASE}

SLIDE 3 — Prompt 2.
Large number "2" top-left corner.
Title: "真實錯誤模擬器"
Subtitle small: "The Real Error Simulator"

Scene split into two panels:
LEFT PANEL: HUSBAND confidently typing, star eyes.
RIGHT PANEL: HUSBAND face-palming after making a mistake, small sweat drops.

HUSBAND speech bubble: "不要解釋給我聽。直接把我丟進會犯錯的情境！"

Prompt card box:
「把我放進真實會用到[概念]的情境，
讓我自己犯錯。
我犯錯時，不給答案，
只問一個讓我找到自己盲點的問題。
至少試兩次才給答案。」

WIFE speech bubble (side): "所以就是付錢讓自己被AI羞辱？"`,
  },
  {
    filename: "slide4-translator.png",
    prompt: `${STYLE_BASE}

SLIDE 4 — Prompt 3.
Large number "3" top-left corner.
Title: "看不懂內容翻譯機"
Subtitle small: "The Impossible Language Translator"

Scene: HUSBAND holds a thick textbook labeled "超難的東西", head spinning with question marks floating around.
WIFE points at him with a knowing look.

HUSBAND speech bubble: "這個內容讓我很困惑，告訴我那個搞懂了就全懂的核心觀念！"

Prompt card box:
「在解釋之前，告訴我那個
一旦理解就能讓其他一切到位的核心觀念。
只用日常比喻解釋，不用術語。
然後問我3個問題，
答對3題才繼續。」

WIFE speech bubble: "等等，我也想試試這個..."`,
  },
  {
    filename: "slide5-path-architect.png",
    prompt: `${STYLE_BASE}

SLIDE 5 — Prompt 4.
Large number "4" top-left corner.
Title: "個人學習路徑建築師"
Subtitle small: "The Personal Learning Path Architect"

Scene: HUSBAND in hard hat (construction worker style), holding blueprint/map labeled "7天計畫". Star eyes.
WIFE checks calendar on wall, nodding approvingly for once.

HUSBAND speech bubble: "我的目標是[具體成果]，不是學[技能]本身，幫我規劃7天！"

Prompt card box:
「我的真實目標是[目標]。
不是泛泛學習，是在[期限]內達成[成果]。
我已經會[你已知的]。
幫我規劃7天學習路徑：
每天45分鐘，要有明確的完成標準。
如果路徑無法達到目標，重建它。」

WIFE thought bubble: "這個老公第一次說出正確的問題..."`,
  },
  {
    filename: "slide6-gap-detector.png",
    prompt: `${STYLE_BASE}

SLIDE 6 — Prompt 5.
Large number "5" top-left corner.
Title: "隱藏盲點偵測器"
Subtitle small: "The Hidden Gap Detector"

Scene: HUSBAND poses confidently with arms crossed, star-eyes. Behind him, WIFE holds a magnifying glass, spotting cracks/gaps in his knowledge (drawn as literal cracks in his silhouette).

HUSBAND speech bubble: "我覺得我已經很懂[技能]了，來證明我錯了！"

Prompt card box:
「問我5個看似簡單，
但能暴露出從未真正深入過的人的盲點的問題。
一次一題，等我回答。
每次回答後，告訴我這個答案
揭示了我的哪些不足。
不要對我手軟，如果我在表面打轉，直說。」

WIFE speech bubble: "終於有東西治得了他的自信..."`,
  },
  {
    filename: "slide7-feynman.png",
    prompt: `${STYLE_BASE}

SLIDE 7 — Prompt 6.
Large number "6" top-left corner.
Title: "費曼教學法強制模式"
Subtitle small: "The Forced Feynman Method"

Scene: HUSBAND stands at tiny whiteboard explaining to a small cartoon child (simple stick figure labeled "10歲小孩"). WIFE sits watching with popcorn, entertained.

HUSBAND speech bubble: "我剛學了[主題]，我要像解釋給10歲小孩聽一樣說給你聽..."

Prompt card box:
「等我解釋時，每次我用
自己無法定義的術語、跳過推理步驟、
或說得太複雜時，就打斷我。
最後告訴我，這些錯誤
揭示了我理解中什麼部分還不紮實。」

WIFE speech bubble: "這招治好了他跟我解釋AI的壞習慣"
Small text bottom: "存起來！這6個Prompt值得收藏"`,
  },
];

Deno.serve(async (req: Request) => {
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

  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  return new Response(binary, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${slide.filename}"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
});
