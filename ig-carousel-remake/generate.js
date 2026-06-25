import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 帳號：老婆教我別在跟AI聊天
// 風格：黑白手繪漫畫，老公（圓框眼鏡、星星眼）+ 老婆（雙手叉腰、無奈表情）
// 原帖來源：@kueilanverse「用Claude Code讓AI自動幫你做影片」

const STYLE_BASE = `
Black and white hand-drawn comic illustration, sketch style, expressive line art.
Two recurring characters:
- HUSBAND: nerdy man with round glasses, often has sparkly star-shaped eyes when excited about AI/tech
- WIFE: practical woman, often has crossed arms, tired/exasperated expression
Clean white background, bold black outlines, no shading, no color.
Include Chinese text labels/speech bubbles directly in the image.
Instagram square format, 1:1 ratio.
`.trim();

const slides = [
  {
    filename: 'slide1-cover.png',
    prompt: `${STYLE_BASE}

SLIDE 1 - COVER IMAGE.
Large title text at top: "用AI自動做影片"
Subtitle text below title: "裝這5個工具就夠了"

Scene: HUSBAND sitting at desk with laptop, stars in his eyes, arms raised in excitement.
WIFE standing behind him with crossed arms and a flat/tired expression.
HUSBAND speech bubble: "AI幫我自動剪片！"
WIFE speech bubble: "好啦好啦，我教你裝..."

Bottom corner small text: "老婆教我別再跟AI聊天"
Comic style, energetic composition, clear and readable text.`,
  },
  {
    filename: 'slide2-why-ai-needs-tools.png',
    prompt: `${STYLE_BASE}

SLIDE 2 - Educational infographic comic.
Title text at top: "為什麼AI自己不會剪片？"

Three-panel layout:
PANEL LEFT: A cartoon floating brain labeled "AI大腦" with speech bubble "我只會下指令"
PANEL RIGHT: Multiple robot hands/arms labeled "ffmpeg" "Whisper" "yt-dlp" with label "工具=手腳"
PANEL BOTTOM (full width): HUSBAND sitting between them looking like a conductor,
  speech bubble: "AI下令 + 工具執行 = 自動做影片！"

Bottom summary text box: "AI＝大腦　工具＝手腳　缺一不可"
Clean diagram style with comic characters.`,
  },
  {
    filename: 'slide3-which-ai.png',
    prompt: `${STYLE_BASE}

SLIDE 3 - Menu/comparison comic.
Title text at top: "四家AI，哪個適合你？"

Scene: A restaurant-style menu board. HUSBAND pointing at it enthusiastically with star eyes.
WIFE beside him with a checklist clipboard.

Menu board lists (with checkbox icons):
☑ Claude Code  → "付費｜skill最成熟"
☑ Codex CLI    → "可免費｜本來用ChatGPT最順"
☑ Cursor       → "有免費版｜怕終端機的人"
☑ Antigravity  → "有免費額度｜Google重度用戶"

HUSBAND pointing at Claude Code with star eyes.
WIFE pointing at the free options with a thumbs-up, speech bubble: "先從免費的試！"
Comic restaurant/café setting, clean readable menu layout.`,
  },
  {
    filename: 'slide4-install-list.png',
    prompt: `${STYLE_BASE}

SLIDE 4 - Shopping list / checklist comic.
Title text at top: "到底要先裝什麼？"

HUSBAND holding an enormous scroll/list looking determined.
WIFE with pen checking items off, speech bubble: "這個最重要！" pointing at ffmpeg.

Scroll shows two clearly labeled sections:

【地基】裝一次終身用：
• Homebrew
• Python
• Node
• 中文字型

【核心五件套】：
⭐ ffmpeg ← "AI八成指令都靠它！"
• Whisper
• Auto-Editor
• yt-dlp
• ImageMagick

ffmpeg has a large star icon and underline emphasis.
Comic scroll/shopping list style, clear hierarchy, energetic composition.`,
  },
  {
    filename: 'slide5-tool-map.png',
    prompt: `${STYLE_BASE}

SLIDE 5 - Flowchart / reference map comic.
Title text at top: "你想做的，對應哪個工具？"

WIFE holding a large map/guide, looking knowledgeable.
HUSBAND with notebook taking notes, speech bubble: "原來這麼清楚！"

Clean flowchart arrows connecting left column (goals) to right column (tools):

錄音轉文字  →  Whisper / MacWhisper / SenseVoice
上字幕      →  Whisper出SRT + ffmpeg燒
自動快剪    →  Auto-Editor
上字卡      →  ImageMagick + ffmpeg
配音        →  ElevenLabs
配樂混音    →  ffmpeg

Bottom text: WIFE speech bubble: "學會了嗎？學會就去睡覺！"
Clean reference-card style layout with comic characters in corners.`,
  },
];

async function generateSlide(slide, index) {
  console.log(`\n[${index + 1}/${slides.length}] 生成中: ${slide.filename} ...`);

  const response = await client.images.generate({
    model: 'gpt-image-1',
    prompt: slide.prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
  });

  const imageData = response.data[0];
  const outputPath = path.join('output', slide.filename);

  if (imageData.b64_json) {
    const buffer = Buffer.from(imageData.b64_json, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`  ✓ 儲存：${outputPath}`);
  } else if (imageData.url) {
    console.log(`  URL（請手動下載）：${imageData.url}`);
  } else {
    console.error(`  ✗ 無法取得圖片資料`);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('錯誤：請設定 OPENAI_API_KEY 環境變數');
    console.error('用法：OPENAI_API_KEY=sk-xxx node generate.js');
    process.exit(1);
  }

  fs.mkdirSync('output', { recursive: true });
  console.log('開始生成「老婆教我別在跟AI聊天」IG輪播（手繪漫畫版）');
  console.log(`模型：gpt-image-1  張數：${slides.length}  解析度：1024x1024\n`);

  for (let i = 0; i < slides.length; i++) {
    await generateSlide(slides[i], i);
    if (i < slides.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log('\n✅ 全部完成！圖片儲存於 ./output/ 目錄');
}

main().catch(err => {
  console.error('生成失敗：', err.message);
  process.exit(1);
});
