# 三段工作流細節

大腦 = 產出 → 累積 → 審核回饋 的同一個迴圈的三段。

## ① 產出流程(新作品 從無到有到完成)

| 步驟 | 動作 | DB 寫入 | status |
|---|---|---|---|
| 1 選題 | RAG 查 knowledge 找靈感/從數據挑題,定分類+平台 | `works` 新增 | `idea` |
| 2 腳本/設計 | 內容→reels/threads skill;工具遊戲→設計文件 | 更新該列 | `scripting` |
| 3 產製 | 拍攝 / Higgsfield 生成 / 寫程式 | `metrics` 存素材連結 | `producing` |
| 4 審核 | 流程③發佈前打分(只提醒) | `reviews`(pre) | `reviewing` |
| 5 發佈 | 上架,記 `link`+`published_at` | works 更新 | `published` |
| 6 回收 | **發佈後 2 天**收數據→寫 metrics→萃取學習 ingest 進 knowledge | `metrics`+`reviews`(post)+`knowledge` | `done` |

**完成定義**:跑到 `done` 且拿到對應回饋。各類回饋指標:
- `social` 流量(觀看/儲存/分享) · `tool` 使用數 · `game` 遊玩數 · `business` 假設驗證 · `knowledge` 是否內化成規則

## ② 工作大腦流程(累積 + 回饋)

- **寫入時機**:步驟 6 回收、隨手丟靈感、拆解成功案例 → edge function `ingest`(自動生 embedding)。
- **讀取時機**:步驟 1 選題、要參考過去 → edge function `search`(RAG 語意)。
- **跨 session 一致性**:分類 enum 與操作規範寫在 SKILL.md,新 session 自動載入,不重問使用者。
- **新增第 6 類**時只改兩處:DB 的 `brain.category` enum + SKILL.md 分類表。

## ③ 審核流程(自動找問題,只給分不硬擋)

**發佈前**(step 4):腳本/成品產出後對照清單打分,寫 `reviews`(stage=pre):
- hook 前 3 秒夠強?CTA 有?長度/字數合規?撞不撞過去失敗案例(RAG 查 social+失敗案例)?
- 可選:接 Higgsfield `virality_predictor` 補流量預測分。
- 低分 → 提醒重寫(不阻擋發佈,決定權在使用者)。

**發佈後**(step 6,發佈後 2 天):寫 `reviews`(stage=post):
- 比對 `predicted` vs `actual`,差距大的標記 → 存成 knowledge 學習點。
- 模型漂移檢查:比對最新高流量案例 vs 各 skill 的 MODEL.md,脫節就提示更新規則。

## 分類 × 完成回饋 對照

| enum | 中文 | 主要 skill | 回饋 |
|---|---|---|---|
| knowledge | 知識 | (未來)研究整理 | 內化成規則 |
| tool | 工具 | (未來)工具開發 | 上線+使用數 |
| game | 遊戲 | (未來)遊戲設計 | 發佈+遊玩數 |
| social | 社群流量 | reels-script, threads-post | 發佈+流量(2 天) |
| business | 商業財務 | (未來)商業分析 | 假設驗證 |
