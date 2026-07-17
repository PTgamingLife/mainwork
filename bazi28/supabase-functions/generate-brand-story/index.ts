import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TASK_TITLES: Record<number, string> = {
  1:'旅程起點', 2:'你的身份標籤', 3:'真正的你', 4:'你的隱藏天賦', 5:'你的陰影面', 6:'核心身份宣言',
  7:'你的表達方式', 8:'你的轉折故事', 9:'你的迷你課', 10:'你的品牌作品', 11:'未寄出的信',
  12:'你的隱形資源', 13:'重新定義財富', 14:'你的時間真相', 15:'你的感恩帳', 16:'資源槓桿計劃',
  17:'你的影響力時刻', 18:'你改變了誰', 19:'你的使命召喚', 20:'你的核心訊息', 21:'影響力宣言',
  22:'改變你的那本書', 23:'你的非正式老師', 24:'你的直覺', 25:'失敗的禮物', 26:'智慧傳承', 27:'28天回望',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { memberId, memberName, baziProfile } = await req.json();
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: tasks }, { data: chats }] = await Promise.all([
    sb.from('bazi28_tasks').select('day_index,response').eq('member_id', memberId).order('day_index'),
    sb.from('bazi28_ai_chats').select('day_index,role,content').eq('member_id', memberId).order('day_index').order('created_at'),
  ]);

  let ctx = `用戶名稱：${memberName}\n`;
  if (baziProfile?.selfElem) ctx += `八字日主：${baziProfile.selfElem}\n`;

  ctx += '\n=== 28天任務記錄 ===\n';
  for (const t of (tasks || [])) {
    if (t.response) ctx += `\n[Day ${t.day_index} - ${TASK_TITLES[t.day_index] ?? ''}]\n${t.response}\n`;
  }

  if (chats && chats.length > 0) {
    ctx += '\n=== 小老師對話記錄 ===\n';
    let cur = 0;
    for (const c of chats) {
      if (c.day_index !== cur) { cur = c.day_index; ctx += `\n[Day ${cur} 對話]\n`; }
      ctx += `${c.role === 'user' ? '用戶' : '教練'}：${c.content}\n`;
    }
  }

  const system = `你是一位資深品牌故事顧問，擅長把人的真實生命故事轉化為有力的個人品牌故事。

請根據以下用戶在28天挑戰中留下的所有記錄，為他們生成一份獨一無二的個人品牌故事。

要求：
1. 必須自然融合以下五個元素（不要用標題硬切分段）：
   - 我是誰（核心身份）— 核心標籤、獨特性
   - 我的旅程（表達故事）— 最重要的轉折點
   - 我的資源（價值提供）— 能給別人什麼、核心優勢
   - 我的影響力（社會使命）— 想改變什麼、服務誰
   - 我的智慧（傳承宣言）— 最深的洞見、留給世界的話
2. 長度：600–1000字
3. 語言：第一人稱、繁體中文
4. 風格：真實、有溫度、具感染力，讓讀者讀完後深深記住這個人
5. 直接輸出故事內容，不加任何前言或後記`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: ctx }],
    }),
  });

  const data = await res.json();
  const story = data.content?.[0]?.text ?? '';

  return new Response(JSON.stringify({ story }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
