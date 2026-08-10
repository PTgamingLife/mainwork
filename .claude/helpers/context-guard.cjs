#!/usr/bin/env node
/**
 * context-guard.cjs — UserPromptSubmit hook
 *
 * Hook 的 stdin 沒有 token 用量欄位,但有 transcript_path。
 * transcript JSONL 裡每則 assistant 訊息都帶 message.usage:
 *   input_tokens + cache_creation_input_tokens + cache_read_input_tokens
 *   = 那次 request 實際送進去的 context 大小。
 * 取最後一筆來估算目前佔用率,超過門檻就用 systemMessage 提醒使用者。
 *
 * 永遠 exit 0、永遠不 block —— 這只是提醒,不該擋住任何一次輸入。
 *
 * 可調環境變數:
 *   CLAUDE_CONTEXT_LIMIT   context window 上限 tokens(預設 200000)
 *   CLAUDE_CONTEXT_TIERS   提醒門檻百分比,逗號分隔(預設 50,70,85)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_LIMIT = 200000;
const DEFAULT_TIERS = [50, 70, 85];
const TAIL_BYTES = [256 * 1024, 4 * 1024 * 1024]; // 先讀尾巴,不夠再擴大

function readStdin() {
  try {
    if (process.stdin.isTTY) return null;
    const chunks = [];
    const buf = Buffer.alloc(65536);
    let n;
    for (;;) {
      try {
        n = fs.readSync(0, buf, 0, buf.length, null);
      } catch {
        break;
      }
      if (!n) break;
      chunks.push(Buffer.from(buf.subarray(0, n)));
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw.startsWith('{') ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 讀 transcript 尾端,由後往前找最後一筆帶 usage 的 assistant 訊息
function lastContextTokens(transcriptPath) {
  let size;
  try {
    size = fs.statSync(transcriptPath).size;
  } catch {
    return null;
  }
  if (!size) return null;

  for (const window of TAIL_BYTES) {
    const start = Math.max(0, size - window);
    let text;
    try {
      const fd = fs.openSync(transcriptPath, 'r');
      try {
        const buf = Buffer.alloc(Math.min(window, size - start));
        fs.readSync(fd, buf, 0, buf.length, start);
        text = buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return null;
    }

    const lines = text.split('\n');
    // 第一行可能被截斷,跳過
    if (start > 0) lines.shift();

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line.startsWith('{')) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const u = entry && entry.message && entry.message.usage;
      if (!u) continue;
      const total =
        (u.input_tokens || 0) +
        (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0);
      if (total > 0) return total;
    }

    if (start === 0) break; // 已讀完整份還是沒找到
  }
  return null;
}

function stateFile(sessionId) {
  const dir = path.join(os.tmpdir(), 'claude-context-guard');
  fs.mkdirSync(dir, { recursive: true });
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(dir, safe + '.json');
}

function readTier(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).tier || 0;
  } catch {
    return 0;
  }
}

function writeTier(file, tier) {
  try {
    fs.writeFileSync(file, JSON.stringify({ tier, at: Date.now() }));
  } catch {
    /* 寫不進去就算了,頂多重複提醒 */
  }
}

function advice(pct) {
  if (pct >= 85) {
    return '快滿了 —— 現在就 /compact,或把重要結論先 commit / 寫進 memory 再 /clear。';
  }
  if (pct >= 70) {
    return '建議收尾目前這件事後 /compact;大範圍搜尋改丟 subagent。';
  }
  return '過半了。適合的話下個段落結束就 /compact,可帶指示例如:/compact 只保留正在改的檔案與待辦。';
}

function main() {
  const input = readStdin();
  if (!input || !input.transcript_path) return;

  const limit = Number(process.env.CLAUDE_CONTEXT_LIMIT) || DEFAULT_LIMIT;
  const tiers = (process.env.CLAUDE_CONTEXT_TIERS
    ? process.env.CLAUDE_CONTEXT_TIERS.split(',').map((t) => Number(t.trim()))
    : DEFAULT_TIERS
  )
    .filter((t) => Number.isFinite(t) && t > 0 && t < 100)
    .sort((a, b) => a - b);
  if (!tiers.length) return;

  const used = lastContextTokens(input.transcript_path);
  if (!used) return;

  const pct = (used / limit) * 100;
  const file = stateFile(input.session_id);
  const lastTier = readTier(file);

  // 低於最低門檻代表剛壓縮過或新 session,重置以便下次再提醒
  if (pct < tiers[0]) {
    if (lastTier) writeTier(file, 0);
    return;
  }

  const tier = tiers.filter((t) => pct >= t).pop();
  if (tier <= lastTier) return; // 同一階只提醒一次
  writeTier(file, tier);

  const kUsed = Math.round(used / 1000);
  const kLimit = Math.round(limit / 1000);
  process.stdout.write(
    JSON.stringify({
      systemMessage: `⚠️ Context 已用約 ${pct.toFixed(0)}%(~${kUsed}k / ${kLimit}k)。${advice(pct)}`,
      suppressOutput: true,
    })
  );
}

try {
  main();
} catch {
  /* 提醒失敗絕不影響正常輸入 */
}
process.exit(0);
