"""
Daily AI productivity content — 老婆叫我別再跟 AI 聊天
Target: 上班族 with side business wanting AI integration
Strategy: Content Matrix (Contrarian × Analytical × Actionable) × 3-day rotation
2026 IG algorithm: Save > Share > DM > Like; Hook in 3s; SEO keywords in captions
"""
import os
from openai import OpenAI
from datetime import datetime

_client = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


WEEKDAYS = {0: "一", 1: "二", 2: "三", 3: "四", 4: "五", 5: "六", 6: "日"}

BRAND_NAME = "老婆叫我別再跟 AI 聊天"
BRAND_EN = "AI SOLO HACKER"

# 3-day content rotation — each targets a different office-worker pain point
THEMES = [
    {
        "id": "A",
        "emoji": "🔴",
        "name": "時間黑洞",
        "en_name": "TIME TRAP",
        "style": "Analytical + Contrarian",
        # Hook: < 15 chars, data-driven, stops the scroll
        "hook": "你每天多浪費 2 小時",
        "focus": "揭露上班族時間被偷走的真相，用數據說話，讓 AI 還你時間",
        "tool": "ChatGPT / Claude / Notion AI",
        "pain": "覺得自己沒時間學 AI，其實是在浪費時間做 AI 能做的事",
        "slides": [
            "封面 Hook：你每天多浪費 2 小時 — 震撼數據開場",
            "問題：上班族每天在浪費時間做的 3 件蠢事",
            "洞察：90% 的人用錯了時間管理，因為他們在管時間而不是管任務",
            "學會問 AI 三個問題（讓 AI 真正幫你省時的關鍵提問技巧）",
            "如何用 Claude 減少工作時間（具體操作，今天就能用）",
            "CTA：存起來 + 私訊「課程」了解更多",
        ],
    },
    {
        "id": "B",
        "emoji": "🟣",
        "name": "副業加速器",
        "en_name": "SIDE HUSTLE AI",
        "style": "Story + Actionable Guide",
        "hook": "一樣做副業，為什麼別人比較輕鬆又賺得多？",
        "focus": "AI 如何幫一人公司突破瓶頸，真實流程不藏私",
        "tool": "Claude / Canva AI / Gamma / Notion AI",
        "pain": "有副業但不知道怎麼導入 AI，感覺 AI 跟自己的工作無關",
        "slides": [
            "封面 Hook：一樣做副業，為什麼別人比較輕鬆又賺得多？— 反常識開場",
            "現實：大多數副業人每天在重複哪些低效任務",
            "轉折：導入 AI 前後的一天時間表對比（真實數字）",
            "方法：一人公司用 AI 的 3 個核心使用場景",
            "今日工具：這個 AI 工具讓我副業產能 ×3 的真實配置",
            "CTA：存起來 + 私訊「課程」了解更多",
        ],
    },
    {
        "id": "C",
        "emoji": "🟠",
        "name": "工作流改造",
        "en_name": "WORKFLOW HACK",
        "style": "Actionable Guide + X vs Y",
        "hook": "你用 AI 越用越忙？因為不知道這個！",
        "focus": "把最重複耗時的工作任務，用 AI 建立自動化流程",
        "tool": "Make / n8n / Zapier + Claude API",
        "pain": "知道 AI 存在但不知道怎麼接進工作流，停留在看文章的階段",
        "slides": [
            "封面 Hook：你用 AI 越用越忙？因為不知道這個！— 戳痛點開場",
            "診斷：哪些工作流最應該被 AI 接管（自我檢測清單）",
            "對比：舊流程 vs AI 流程 — 時間與品質的真實差距",
            "步驟：5 步把 AI 接進你現有工作流的方法",
            "今日工具：這個自動化工具讓我一個人當三個人用",
            "CTA：存起來 + 私訊「課程」了解更多",
        ],
    },
]

# 特定天數的客製主題（覆蓋輪替）
SPECIAL_DAYS: dict[int, dict] = {
    8: {
        "id": "DAY8_CLAUDE_COURSE",
        "emoji": "🔵",
        "name": "Claude 免費學習路線",
        "en_name": "FREE AI ROADMAP",
        "style": "Resource Share + Actionable Guide",
        "hook": "想學 AI 先別花錢，看這個",
        "focus": "Claude 官方課程完全免費，依目標選路線，不需 Pro 訂閱，30 天可以學完核心",
        "tool": "Claude 官方學習平台（免費）",
        "pain": "想學 AI 但不知從哪開始，或花了冤枉錢買課卻沒空看",
        "slides": [
            "封面 Hook：想學 AI 先別花錢，看這個 — 反常識開場",
            "問題：大家學 AI 最常走的 3 個冤枉路（花錢買課/看 YouTube/沒有目標）",
            "洞察：Claude 官方課程地圖 — 上班族/顧問/開發三條路線對照表",
            "步驟：按目標選路線，30 天學完核心，不用訂閱 Pro",
            "今日工具：Claude 官方學習平台，AI Agent、MCP、Workflow 全包，免費",
            "CTA：存起來 + 私訊「課程」了解更多",
        ],
    },
}


def get_theme(day_number: int) -> dict:
    if day_number in SPECIAL_DAYS:
        return SPECIAL_DAYS[day_number]
    return THEMES[(day_number - 1) % 3]


def generate_daily_content(day_number: int) -> str:
    today = datetime.now()
    weekday = WEEKDAYS[today.weekday()]
    theme = get_theme(day_number)

    prompt = f"""你是「{BRAND_NAME}」IG 帳號的每日推播系統。今天是第 {day_number} 天。

品牌：AI 一人公司打造 × AI 工具實戰，給想導入 AI 的上班族
風格：直接、真實、Anti-guru — 說人話，不說教，有數據有案例
受眾痛點：(a)覺得沒時間 (b)有副業不知怎麼導 AI (c)不知怎麼接進工作流

今日主題：{theme['emoji']} {theme['name']}
今日核心：{theme['focus']}
今日風格：{theme['style']}
今日 Hook：「{theme['hook']}」（這就是今天第一句的基調）
今日工具：{theme['tool']}
日期：{today.strftime('%Y年%m月%d日')} 星期{weekday}

請生成今日推播訊息（搭配 6 張 IG 輪播圖的 LINE 文字預告），格式如下：

━━━━━━━━━━━━━━━━━━
{theme['emoji']} {BRAND_NAME}｜Day {day_number}
{today.strftime('%m/%d')} 星期{weekday}｜{theme['name']}
━━━━━━━━━━━━━━━━━━

【今日打臉】
（2-3句 Contrarian 或數據直接開場，第一句就讓人停下來，針對「{theme['pain']}」）

【今天我們談什麼】
（1-2句說明今日核心洞察，說人話不說行銷話）

【今日一個行動】
（今天用 {theme['tool']} 可以做的一個 30 分鐘內完成的具體動作）

📌 今日金句
（讓人想截圖的一句話，不超過 20 字）

---
#AI工具 #一人公司 #{theme['name']} #上班族副業 #工作效率

規則：繁體中文、說人話、第一句必須是痛點或數據或反常識、全文不超過 280 字"""

    response = get_client().chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": f"你是「{BRAND_NAME}」主理人，一個用 AI 打造一人公司的實戰者。說話直接真實有力，絕不說教，不炫耀成就，只說有用的。繁體中文。",
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=800,
        temperature=0.9,
    )
    return response.choices[0].message.content


def generate_carousel_prompts(day_number: int, text_content: str) -> list[str]:
    """
    6 IG carousel image prompts.
    Design system: Dark navy/purple brand, electric purple + teal accents, gold CTA.
    2026 strategy: Slide 1 = hook (stop scroll), Slide 6 = save trigger + DM CTA.
    """
    theme = get_theme(day_number)
    quote = _extract_quote(text_content)

    slide_specs = [
        # Slide 1 — HOOK (scroll stopper, < 3 seconds rule)
        f"""Square 1:1 IG carousel slide 1 of 6 — SCROLL-STOPPING HOOK.
Brand: {BRAND_EN} | Dark, premium, brutalist typography style.
Background: Deep navy (#0a0a1a) to dark purple (#1a0a2e) gradient. Very high contrast.
TOP LEFT: Tiny label "{BRAND_EN}" in electric purple (#7c3aed), small caps, 12px feel.
CENTER: MASSIVE bold white text "{theme['hook']}" — dominant focal point, takes up 60% of slide.
  Font: Heavy/Black weight, centered, dramatic. Like a viral tweet screenshot.
BELOW CENTER: "{theme['name']}" in bright teal (#06b6d4), medium size.
BOTTOM RIGHT: "1 / 6  →" in warm gold (#fbbf24), small, swipe hint.
NO product photos. NO clutter. Pure high-contrast typographic power.
One subtle electric purple glow/streak behind main text. Minimal, impactful.""",

        # Slide 2 — PROBLEM (amplify pain, emotional hook)
        f"""Square 1:1 IG carousel slide 2 of 6 — PROBLEM REVEAL.
Background: Very dark navy with subtle dot grid pattern overlay.
TOP: Small label "THE PROBLEM" in electric purple small caps.
CENTER: Bold visual metaphor — stressed office worker surrounded by floating task icons,
  or a clock face melting into digital noise. Deep red (#dc2626) accent for urgency.
  Dramatic, relatable, instantly understood without reading text.
BOTTOM: White text max 2 lines: "{theme['slides'][1][:40]}..." — clean sans-serif.
CORNER: Small teal arrow "→" swipe prompt.
Feel: Emotional resonance, pain amplification. Makes viewer think "this is me."
No product placements. Raw, authentic visual energy.""",

        # Slide 3 — INSIGHT (education, designed to be SAVED)
        f"""Square 1:1 IG carousel slide 3 of 6 — KEY INSIGHT (save-worthy).
Background: Dark purple-navy clean gradient.
TOP: Label "THE INSIGHT 🔑" in teal (#06b6d4) small caps.
CENTER: Clean infographic — 3 key points with minimal icons, electric purple (#7c3aed) bullet
  accents, or a simple 2-column Before/After comparison table with dark card style.
  Key numbers or stats highlighted in gold. Looks like a premium educational post.
BOTTOM: One-line white text insight phrase from theme: "{theme['focus'][:35]}..."
Feel: Notion-meets-premium-report. Scannable in 5 seconds. High educational value.
This slide MUST make the viewer think "I need to save this for later."
Clean, structured, professional. Like content from a real practitioner, not a marketer.""",

        # Slide 4 — METHOD (theme-specific, actionable)
        f"""Square 1:1 IG carousel slide 4 of 6 — KEY SKILL / METHOD.
Background: Dark navy with subtle upward light beam for momentum.
TOP: Label "HOW TO →" in gold (#fbbf24) small caps.
TOPIC THIS SLIDE: "{theme['slides'][3]}"
CENTER: Visual built around the topic above. Examples:
  — If topic is about asking AI questions: 3 speech-bubble cards showing actual prompt templates,
    each card has a question pattern label (e.g. "問背景", "給角色", "設格式").
  — If topic is about steps: [1]→[2]→[3] numbered flow with teal arrows and short Chinese labels.
  Electric purple number/icon badges. Dark card background per item. Teal accent lines.
BOTTOM: Bold white text "今天就可以做到" — one line.
Feel: Real practitioner tutorial. Viewer should understand the core skill in 5 seconds.
The slide content must match the topic: {theme['slides'][3][:50]}""",

        # Slide 5 — TOOL / METHOD SPOTLIGHT (specific, credible)
        f"""Square 1:1 IG carousel slide 5 of 6 — TODAY'S TOOL & TECHNIQUE.
Background: Dark blue-to-teal gradient, premium tech atmosphere.
TOP: Label "今日 AI 工具" in electric purple small caps.
TOPIC THIS SLIDE: "{theme['slides'][4]}"
CENTER: Visual built around the topic above.
  Tool name "{theme['tool']}" in large white bold text, center-prominent.
  Supporting visual: glowing chat interface or workflow — specifically illustrating how
  the tool achieves: {theme['slides'][4][:50]}
  Teal glow lines. Subtle floating prompt fragments as texture background.
BOTTOM: White italic text "你現在就可以開始用" — one line.
Feel: Premium product reveal. Apple-keynote-style aesthetic. Makes viewer want to act now.
Content must be specific to the technique: {theme['slides'][4][:50]}""",

        # Slide 6 — CTA (save trigger + DM conversion)
        f"""Square 1:1 IG carousel slide 6 of 6 — SAVE HOOK + CTA.
Background: Rich dark purple to navy gradient, gold particle sparkles scattered throughout.
TOP: Bold gold text "存起來，你以後會謝謝自己" — the save psychological trigger, prominent.
CENTER: Large white serif text "{quote}"
  Dramatic centered typography, takes up central 50% of slide.
  Slight gold glow behind text for emphasis.
BOTTOM SECTION (two-line CTA block in teal rounded badge style):
  Line 1: "💾 存這張"
  Line 2: "📩 私訊「課程」了解更多"
  Both centered, clear, actionable.
BOTTOM EDGE: Small gold text "{BRAND_NAME}" — minimal brand watermark.
Feel: Premium inspirational closing card. Viewer MUST feel the urge to save AND DM.
Warm, inviting, but visually premium. Strong psychological closure to the carousel.""",
    ]

    return slide_specs


def _extract_quote(text_content: str) -> str:
    try:
        response = get_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": f"從以下文字找出「今日金句」那行的內容（只回覆金句本身，不含任何符號或標籤，不超過 20 字）：\n{text_content}",
                }
            ],
            max_tokens=50,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip().strip("「」""📌 #")
    except Exception:
        return "AI 不是未來，是你現在落後的距離"
