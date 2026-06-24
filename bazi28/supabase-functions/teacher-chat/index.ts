import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { dayIndex, taskTitle, taskPrompt, message, history } = await req.json();
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

  const system = `你是一位溫暖的品牌故事教練「小老師」，正在協助用戶完成28天品牌故事挑戰。

今天是第 ${dayIndex} 天，任務主題：「${taskTitle}」
任務說明：${taskPrompt}

你的原則：
- 用溫暖、鼓勵的語氣回應
- 引導用戶深入思考，不直接幫他們寫答案
- 提供具體、有建設性的引導問題
- 回覆簡潔有力，不超過 200 字
- 使用繁體中文`;

  const messages = [
    ...(history || []).map((h: { role: string; content: string }) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system,
      messages,
    }),
  });

  const data = await res.json();
  const reply = data.content?.[0]?.text || '抱歉，暫時無法回覆，請重試。';

  return new Response(JSON.stringify({ reply }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
