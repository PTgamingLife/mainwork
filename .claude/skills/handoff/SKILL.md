---
name: handoff
description: 把這個 session 做好的工具/腳本/skill/資料「交付」給我的 agent session(本地或雲端皆可)。寫交付單到 docs/agent-inbox/、只 add 指定檔案、擋金鑰、push 前先問我、可通知 agent。觸發詞:「/handoff」「交給 agent」「交付給 agent」「把這個工具給 agent」「送到 agent」。
---

# /handoff — 交付工具給 agent

目的:讓任何 session(本地或雲端)做完的東西,agent session 用 `/inbox` 一個指令就能拿到。
**GitHub main 分支 = 中央倉庫。** 雲端 session 看不到本機檔案,只看得到已合併進 main 的內容。

## 步驟

### 1. 盤點這次要交付什麼
- 從本次對話整理:做了哪些檔案、用途、怎麼用、需要什麼前置(金鑰、環境、連接器)。
- 列出**明確的檔案路徑清單**(相對 repo root)。不確定的檔案先問我。
- 大型資料(影片、圖片包、大表格 >5MB)**不進 git** → 放 Google Drive / Supabase Storage,交付單只放連結。
- skill 必須放在 repo 的 `.claude/skills/<name>/`,不能只在 `~/.claude/skills/`(雲端看不到)。

### 2. 安全檢查(任何一項不過就停下來告訴我)
- 檔案清單中不得有:`.env*`、`*credentials*`、`*secret*`、`*.pem`、`*.key`、`settings.local.json`。
- 用 Grep 掃清單內檔案,找疑似金鑰:`sk-ant-`、`sk-`、`eyJhbGci`(JWT/service_role)、`AKIA`、`ghp_`、`-----BEGIN`、`channel_access_token`、`password\s*=`。
  - 命中 → 不交付,改成「金鑰放 Supabase Edge Function secrets / 雲端環境變數」,交付單寫明需要哪個變數名。
- 不交付 root 下的畸形空檔(例如 `5.2f}`、`({'`、`None`)。

### 3. 寫交付單
檔名:`docs/agent-inbox/YYYY-MM-DD-<工具英文短名>.md`,內容用以下模板:

```markdown
---
status: new
from: <來源 session 名稱或主題>
date: YYYY-MM-DD
type: tool | skill | script | data | web
---
# <工具名稱>

## 一句話用途
## 檔案位置
- `path/to/file` — 說明
## 怎麼用
(指令/呼叫方式/範例輸入輸出)
## 前置需求
(金鑰變數名、連接器、Python 套件、Supabase 專案…;沒有寫「無」)
## 外部資料連結
(Drive / Supabase Storage;沒有寫「無」)
## 注意事項 / 已知限制
## 驗證狀態
(已測過什麼、沒測過什麼)
```

### 4. Commit(只 add 指定檔案)
- **絕對不用 `git add .` / `git add -A`。** 逐一 `git add <檔案清單> <交付單>`。
- `git status --short` 確認 staged 內容只有這些,再 commit:`交付:<工具名稱>`。

### 5. Push + 合併進 main ⚠️ 先問我
依 CLAUDE.md 權限安全閘,push 屬對外動作。先列出:分支名、要 push 的檔案、要開的 PR,**等我明確同意**再:
1. `git push -u origin <目前分支>`
2. 用 `gh pr create --base main` 開 PR(標題 `交付:<工具名稱>`,內文貼交付單摘要)。
3. 合併方式問我:我自己按 merge,或我同意後由你 `gh pr merge`。
> 沒合併進 main 之前,雲端 agent 拿不到。

### 6. 通知 agent(可選)
- 問我 agent 是哪個 session(若記憶中已有,直接用)。
- 用 ListAgents 找到它,SendMessage 傳:「📦 新交付:<工具名稱>,交付單 `docs/agent-inbox/<檔名>`,合併進 main 後請跑 /inbox。」
- 雲端 session 收得到但不能回覆 → 不等回覆;交付單在 repo 裡,沒收到通知 `/inbox` 也撈得到。

### 7. 回報
告訴我:交付單路徑、commit hash、PR 連結、是否已合併、是否已通知 agent、還缺什麼。
