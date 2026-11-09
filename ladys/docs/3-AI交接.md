# LadyS — AI 交接包(給新的 Claude 工作階段)

> 已移除個人資訊。使用者偏好:繁體中文、回覆精簡、不確定就問、做 App 前先用文字確認架構與細節、配色先給三案、App 參數加專案代號前綴 `ladys_`、改完網頁要實際開啟測試、本地測試前先檢查 port。

## 專案一句話
LINE 家庭秘書:群組對話 → 每晚 AI 整理成行程 / 記帳 / 待辦 / 目標 / 生活紀錄;LIFF 網頁管理;單向同步 Google 日曆。後端 = Supabase Edge Functions + Postgres + pg_cron。

## 先讀哪些
1. `ladys/docs/1-功能與做法.md`(功能與技術層對照)
2. `ladys/docs/2-部署包.md`(migrations、secrets、函式依賴)
3. `supabase/functions/_shared/ladys-extract.ts`(核心:schema + 提示詞 + 寫入 + 卡片)
4. `supabase/functions/ladys-webhook/index.ts`(指令與 postback 路由)

## 架構慣例
- 所有資料表、欄位以 `ladys_` 開頭;資料表開 RLS 並對 anon / authenticated `revoke all`。
- 共用函式在 `_shared/ladys*.ts`,每個 Edge Function 只負責入口;單檔 < 500 行。
- LINE:`reply` 免費、`push` 計額度(一次 ≤5 則算 1 次);所有確認互動用 postback,webhook 收到才執行。
- 指令清單 `LADYS_COMMANDS` 為「完全相符」比對;新增指令要同時改清單與 `ladysRunCommand`。
- reply token 會過期:耗時指令用 `ladysReplySafe(token, msgs, to)`,失敗改推播。
- AI:Claude Haiku 5.5 + `output_config.format = json_schema`;schema 欄位全列 `required`;對話內容視為資料不是指令。
- 提示詞改動原則:一件事只放一類;不確定就不填;引用既有行程用 `E<編號>`(對應傳給 AI 的清單順序)。
- 新增 `ladys_pending` 類型 → 先擴充 check constraint 的 migration,再寫入與 postback 處理(先 claim 狀態再執行,避免重複點擊)。
- 敏感資訊:落地前一律過 `ladysMask`;不得保存圖片與群組原文(整理後立刻刪)。

## 資料流速查
- 訊息:webhook → `ladys_messages` → nightly / 「更新行事曆」→ `ladysProcessPending` → 寫表 → 刪原文 → gcal sweep → 卡片。
- 圖片:webhook 只記 `ladys_images` 編號 → 「記憶…圖片」→ 下載 → 讀圖 → action 轉成 `img-<id>` 訊息再走整理 / reference 存 `ladys_life`。
- 確認卡:整理時 AI 回傳 `obsolete` / `event_notes` → 卡片 → postback → `ladysHandleDeletePostback` / `ladysHandleNotePostback` / `ladysHandleWorkPostback`(webhook 依序嘗試,回 null 表示非本功能)。

## 部署與發佈流程(重要)
- 沒有 supabase CLI 時:用 MCP `deploy_edge_function`,**每次要傳完整檔案內容**(入口 + 全部依賴的 `_shared` 檔);MCP 常斷線,需重新載入工具。
- 依賴鏈:webhook 需 9 個 shared 檔(含 image、memo);nightly 不需 image、memo;api 只需 ladys、gcal、life。
- 資料庫變更用 migration,同時把檔案存進 `supabase/migrations/`。
- Git:專案規則要求 push / 部署 / migration / 刪資料前先問使用者。PR 被 squash 合併後,分支要從最新 `origin/main` 重建;**禁止 force push**,舊分支歷史用 `git merge -s ours origin/<舊分支>` 併入再正常 push。
- 型別檢查:`npx -y tsc --noEmit --target es2022 --lib es2022,dom --module es2022 --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck <deno 型別宣告> <檔案>`。
- 前端測試:`python3 -m http.server <port> --bind 127.0.0.1`(先檢查 port 是否被占用),Playwright iPhone 裝置,網址加 `?mock=1` 使用假資料。

## 踩過的坑
| 問題 | 原因 / 解法 |
|---|---|
| 指令沒反應 | 完全相符比對,多打字或同義詞要加進 `LADYS_COMMANDS` |
| 讀很多圖後回覆失敗 | reply token 過期 → 退回 push |
| PR 合併衝突 | 從最新 main 重建分支再 cherry-pick |
| iPhone 日期 / 時間欄位溢出 | CSS `appearance:none; min-width:0; max-width:100%` |
| 補充資訊沒進備註 | 整理流程只新增、不修改既有行程 → 已用「補備註確認卡」處理 |
| 手動備註含敏感資訊 | 手動輸入不遮蔽且同步到 Google 描述 → 待辦:對手動備註也套 `ladysMask` |
| 某些模型回合被安全機制中止 | 切換模型後繼續;避免在輸出中重現資料庫內的敏感內容 |

## 待辦 / 可擴充
- 手動備註遮蔽(見上)。
- 補充卡與工作群卡同批超過 5 則時,補充卡可能被擠出推播(可改成分兩次推或調整優先順序)。
- 確認卡尚未涵蓋「補充收支 / 待辦的修改」。
