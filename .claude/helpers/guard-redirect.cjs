#!/usr/bin/env node
// PreToolUse 守門 — 攔截會產生畸形空檔的重定向誤用。
//
// 病因:在 PowerShell/cmd 執行含 > } ) ( 的 node/python 單行指令時,shell 把
// `>` 當成重定向,後面的程式碼片段(如 f"{x:>5.1f}"、t => t.id)被當成檔名,
// 於是 root 冒出 `5.1f}`、`t.id))`、`console.log('` 這種 0-byte 垃圾檔。
//
// 規則:偵測 `>` 重定向(排除 >> 2> >& &>),若目標 token(或其緊接字元)
// 含 ( ) { } → 擋下。合法檔名幾乎不含這些字元,程式碼片段才會。誤判風險低。
//
// 放行 → exit 0。擋下 → exit 2 + stderr(PreToolUse 的 block 慣例)。
// 任何異常一律放行(fail-open)。

const fs = require('fs');

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return 0;
  }

  const cmd = input && input.tool_input && input.tool_input.command;
  if (typeof cmd !== 'string' || !cmd) return 0;

  const re = /(?<![0-9&>])>(?!>|&)\s*("[^"]*"|'[^']*'|[^\s|;&]+)/g;
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const target = m[1];
    const next = cmd.charAt(re.lastIndex);
    if (/[(){}]/.test(target) || /[(){}]/.test(next)) {
      process.stderr.write(
        `[guard-redirect] 擋下:偵測到把程式碼片段當成重定向目標(> ${target})。\n` +
        `這會產生畸形空檔。若你要跑含 > } ) 的 node/python 單行指令,\n` +
        `請用單引號整段包住,或寫進 .tmp 腳本再執行;若真的要重定向到檔案,\n` +
        `請把檔名加引號。\n`
      );
      return 2;
    }
  }
  return 0;
}

let code = 0;
try {
  code = main();
} catch {
  code = 0; // fail-open
}
process.exit(code);
