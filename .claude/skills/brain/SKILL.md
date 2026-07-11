---
name: brain
description: 工作大腦 — 跨 session 的統一知識庫與作品台帳(Supabase heart-cards 專案的 brain schema)。任何新 session 要「存靈感/案例/筆記到大腦」「用 RAG 語意查大腦」「登記/更新作品」「看大腦網狀圖」時用。觸發詞:「存進大腦」「呼叫大腦」「查大腦」「大腦裡有沒有」「更新作品」「大腦地圖」「brain map」「這個歸哪類」。
---

# 工作大腦 (brain)

跨 session 的單一真相來源。規則(MODEL.md)留在各 skill 檔案;**數據與可語意檢索的知識**放這裡。
新 session 只要讀這份 SKILL.md 就知道分類、表結構、怎麼寫、怎麼查——**不需要再問使用者確認 enum**。

## 存放位置

| 項目 | 值 |
|---|---|
| Supabase 專案 | `heart-cards` (ref: `hhcubvixldieuwdeqnwc`) |
| Schema | `brain`(未曝露 REST,天然隔離) |
| 專案 URL | `https://hhcubvixldieuwdeqnwc.supabase.co` |
| Edge function | `.../functions/v1/brain`(embedding gateway) |
| 認證 | 呼叫 edge function 帶 `Authorization: Bearer <ANON_KEY>`;anon key 用 `mcp__Supabase__get_publishable_keys` 取,或環境變數 `$SUPABASE_ANON_KEY` |

## 五大分類 (enum,強制一致,不可自由打字)

| enum 值 | 中文 | 存什麼 | 完成的回饋指標 |
|---|---|---|---|
| `knowledge` | 知識 | 方法、參考、學習 | 是否內化成規則 |
| `tool` | 工具 | 需求、技術決策、bug | 上線 + 有人用 |
| `game` | 遊戲 | 玩法、關卡、數據 | 發佈 + 遊玩數據 |
| `social` | 社群流量 | 案例、成效、靈感 | 發佈 + 流量(**發佈後 2 天回收**) |
| `business` | 商業財務 | 商業概念、成本、營收 | 假設是否驗證 |

跨界資料可同時掛多類(`knowledge.categories` 是陣列)。

## 三張表

- `brain.works` — 作品台帳(所有類型共用)。主分類 `category` + 副標籤 `tags[]`;狀態 `idea→scripting→producing→reviewing→published→done`;`metrics` jsonb 存各類回饋。
- `brain.knowledge` — 知識庫,RAG 目標。`categories[]` 多選;`embedding` vector(1536);`type` = case/idea/note/rule。
- `brain.reviews` — 審核紀錄。`stage` = pre/post;`score`;`checks` jsonb;`predicted`/`actual`。

brain schema 未曝露,一律透過 `public` 的 SECURITY DEFINER RPC 存取(見下)。

## 寫入知識(自動生 embedding)

透過 edge function ingest,它會呼叫 OpenAI 生向量再寫入:

```bash
curl -s -X POST "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/brain" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"action":"ingest","title":"標題","content":"內容全文","categories":["social","business"],"type":"case","work_id":null,"source_url":null}'
```

## RAG 語意查詢

```bash
curl -s -X POST "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/brain" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"action":"search","query":"我之前關於留存率的點子","match_count":8,"categories":["social"]}'
```

`categories` 省略 = 全類搜尋。回傳依 `similarity` 排序。

## 作品台帳 / 審核(用 MCP execute_sql 直接寫,不需 embedding)

```sql
-- 新作品
insert into brain.works (title, category, tags, platform, status)
values ('主題', 'social', array['reels'], 'instagram', 'idea');
-- 推進狀態 / 回收數據
update brain.works set status='done', completed_at=now(),
  metrics = metrics || '{"views":12000,"saves":300}'::jsonb where id='<uuid>';
-- 審核紀錄(只給分,不硬擋)
insert into brain.reviews (work_id, stage, score, checks, passed)
values ('<uuid>', 'pre', 82, '{"hook":true,"cta":true,"length_ok":true}'::jsonb, true);
```

## 三段工作流(細節見 references/workflows.md)

1. **產出**:idea→scripting→producing→reviewing→published→done。完成 = 跑到 done 且拿到對應回饋。
2. **大腦**:每次回收/丟靈感/拆案例 → ingest 進 knowledge;每次選題/找參考 → RAG search。
3. **審核**:發佈前打分寫 reviews(pre,只提醒不擋);發佈後 2 天比對預測 vs 實際 + 查模型漂移,寫 reviews(post)。

## 大腦網狀圖

要「看大腦地圖 / brain map」時,執行產生器,它會拉 `brain_nodes()` + `brain_similarity_edges()` 算好的 RAG 連線,輸出可視化 HTML:

```bash
node .claude/skills/brain/render-map.mjs   # 產出 brain-map.html
```

節點=知識,顏色=分類,連線=RAG 語意相似度(粗細=相似度)。詳見 references/brain-map.md。
