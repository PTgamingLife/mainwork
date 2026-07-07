#!/usr/bin/env node
// Plan of Life 記憶宇宙 — Claude Code 用的最小 MCP 伺服器(stdio / 零依賴)
// 註冊:claude mcp add plantoflife -e POL_SECRET=你的密碼 -- node "<本檔絕對路徑>"
// 需要 Node 18+(內建 fetch)。

const SUPABASE_URL = 'https://hhcubvixldieuwdeqnwc.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY3Vidml4bGRpZXV3ZGVxbndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjcyNDYsImV4cCI6MjA5MTE0MzI0Nn0.zkWxfm0FugSEL9zW6pwDFWPqmRJ3ystOZfU8yRL2lPo';
const FN = SUPABASE_URL + '/functions/v1/plantoflife-memory';
const SECRET = process.env.POL_SECRET || process.env.APP_SECRET || '';

async function api(payload) {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON, 'x-app-secret': SECRET },
    body: JSON.stringify(payload),
  });
  return r.json();
}

const TOOLS = [
  {
    name: 'memory_search',
    description: '語意檢索使用者的個人記憶宇宙(Plan of Life)。在回答跟使用者個人觀點、計畫、事業、價值觀、過往筆記相關的問題前,先用這個查是否有相關記憶。',
    inputSchema: { type: 'object', properties: {
      query: { type: 'string', description: '要查詢的問題或關鍵字' },
      count: { type: 'number', description: '回傳筆數,預設 5' },
    }, required: ['query'] },
  },
  {
    name: 'memory_store',
    description: '把一段值得長期記住的資訊存進個人記憶宇宙,會自動分類(核心/五觀/四事業)並產生向量。',
    inputSchema: { type: 'object', properties: {
      content: { type: 'string', description: '要記住的內容' },
    }, required: ['content'] },
  },
];

async function callTool(name, args) {
  if (name === 'memory_search') {
    const r = await api({ action: 'recall', query: args.query, count: args.count || 5, threshold: 0.3 });
    if (r.error) return 'error: ' + r.error;
    if (!r.use) return '(沒有找到相關記憶)';
    return r.memories.map((m) => `[${m.category} · ${(m.score * 100) | 0}%] ${m.content}`).join('\n');
  }
  if (name === 'memory_store') {
    const r = await api({ action: 'commit', content: args.content, source: 'claude-code' });
    if (r.error) return 'error: ' + r.error;
    return `已存入:[${r.category}] ${String(r.content).slice(0, 50)}`;
  }
  return 'unknown tool: ' + name;
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'plantoflife-memory', version: '1.0.0' },
    } });
  } else if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  } else if (method === 'tools/call') {
    try {
      const text = await callTool(params.name, params.arguments || {});
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
    } catch (e) {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'error: ' + e.message }], isError: true } });
    }
  } else if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
  } else if (id !== undefined && id !== null) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found: ' + method } });
  }
  // 沒有 id 的是 notification,不回應
}

let buf = '';
process.stdin.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    handle(msg);
  }
});
process.stdin.resume();
