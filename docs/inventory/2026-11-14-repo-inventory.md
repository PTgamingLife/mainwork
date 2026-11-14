# mainwork 盤點(2026-11-14)

## 1. main 上的功能清單

| 類別 | 項目 | 位置 | 狀態判斷 |
|---|---|---|---|
| LINE OA | LadyS 家庭生活秘書(行程/記帳/經期/運動/Google 日曆) | `ladys/` + `supabase/functions/ladys-*` | 🟢 活躍(11 月持續更新) |
| LINE OA | 生命之旅 | `life-journey/` + `lj-api`/`lj-line` | 🟢 活躍 |
| LINE OA | 十神修行錄 / 十神試煉場 | `shishen-quest/` + `sg-*`/`si-gen-art` | 🟢 活躍 |
| LINE OA | 創業合夥人 cofounder | `cofounder/` + `cofounder-line` + skill | 🟡 排程已停用,僅手動 |
| LINE OA | 安麗蛋白素 7 天挑戰 | `amway-protein/` + `amp-*`(8 個 function、4 個 workflow) | ⚪ 比賽已結束 → 庫存候選 |
| 銷售頁 | AI 秘書工作坊 選位頁 / IG DM | `aisec-seat/` `dm-ai-secretary/` | 🟢 上線中(deploy-sites) |
| 網頁 | IG 拍攝規劃 | `ig-planner/` | 🟢 |
| 網頁 | 命運校準 destiny | `destiny-*` function | 🟡 7 月後無更新 |
| 網頁 | 臉部檢測 facialmonitor、AI 健康檢查 | `facialmonitor/` `ai-health-check/` | 🟡 |
| 網頁 | 28 天挑戰 bazi28 / sprint28、IP 測驗 | `bazi28/` `sprint28-challenge/` `src/ip-quiz/` | 🟡 |
| 網頁 | 技能星圖、生命規劃、心智圖 AI | `skillmapstar/` `plantoflife/` `mind-map-ai/` | 🟡 |
| 遊戲 | health-quest-rpg、jr-game、root 的 action_battle / monga-game / my-app-world | 各資料夾 / root | ❓ 是否還在用待確認 |
| 工具頁 | ai-chat-app、ig-content-tool、ai-business-intro | root `.html` | ❓ 待確認 |
| 自動化 | 每日行程提醒(唯一仍有 cron 的 workflow) | `scripts/schedule_*` + `schedule-reminder.yml` + `line-webhook` | 🟢 每天 06:00 |
| 自動化 | 口播後製 autoedit、電子發票、IG 分析 | `scripts/` | 🟡 |
| Skills | cofounder / household-finance / reels-script v2.5 / threads-post v2.2 / stage-ai-video-production / skill-builder | `.claude/skills/` | 🟢 |

## 2. 分支(62 個,不含 main)

### A. 已合併、可以刪的分支(25 個)
內容已全部在 main,head 與已合併 PR 相同:
`agent/daily-fortune-highlight` `agent/fortune-data-completeness-label` `agent/guardian-presence`
`agent/guardian-profile-details` `agent/real-admin-dashboard` `agent/talent-energy-chart`
`agent/weekly-metaphysics-evidence` `feat/destiny-calibration-mvp` `fix/destiny-edge-cors`
`claude/amp-clap` `claude/amp-clap-cron` `claude/amp-final-card` `claude/amp-stop-poke-schedule`
`claude/amway-protein-competition-line-oa-twok3y` `claude/ai-startup-partner-system-q1vke3`
`claude/broll-video-upload-flow-5gvabh` `claude/context-window-full-mi3yff` `claude/life-journey-mock`
`claude/shishen-idle` `claude/friendly-ramanujan-w16jhi` `claude/loving-brown-7lg6dd`
`claude/happy-thompson-8348ap` `claude/personal-ip-qa-site-xjzv92` `claude/reels-hook-formulas-8j835b`
`claude/instagram-reels-analysis-lj66pc`(reels v2.5 已在 main)

> `claude/practical-hawking-0skhp0` 也已合併,但是 LadyS 正在用的工作分支,先保留。

### B. 沒有 PR 或 PR 已關閉的舊分支(3 個)→ 庫存
| 分支 | 內容 |
|---|---|
| `claude/e-invoice-platform-integration-j9369a` | 電子發票(PR #18 已關,被 #12 取代) |
| `claude/household-financial-model-5fto0v` | 合併後多 3 個 commit:發票 CSV 匯入、消費統計頁 |
| `claude/sales-page-photos-ufovnm` | 銷售頁照片 + 錯字修正 |

### C. 未合併的 Draft PR(31 個)
**① 流程/模型 → 建議轉成 skill(9)**
| PR | 內容 | 建議 |
|---|---|---|
| #38 | threads-post 模型 v2.3–v2.4(main 只有 v2.2) | 併入現有 skill |
| #20 | threads-post 第八章「時事熱點嫁接公式」 | 併入現有 skill |
| #39 | daily-roast:每日三條建議 | 新 skill |
| #17 | market-value:市場價值量化評分 | 新 skill |
| #14 | reels-carousel:輪播圖文設計 | 新 skill |
| #13 | business-loop:變現飛輪 | 新 skill(可能和 cofounder 重疊) |
| #15 | 工作大腦(知識庫 + RAG) | 和 plantoflife MCP 重疊,待決定 |
| #43 / #40 | autoedit B-roll 素材庫、Linux render | 併入 `scripts/autoedit` |
| #5 / #6 / #8 / #16 | vidgen 文稿轉口播、寶寶成長影片、Carbaby | 合成一個「影片 pipeline」skill,或庫存 |

**② 教材/內容 → 建議放進資料庫/文件(3)**:#3 AI 教學 8 堂課、#21 個人 IP 課程、#4 course-poster(gpt-image 海報 function)

**③ 作品(網頁/遊戲)→ 上線或庫存(10)**:#67 踩地雷、#66 貓咪躲紙箱、#65 下樓梯、#53 wheels-bus、#9 卡通農場、#22 DISTILL、#25 Reels 教練 App、#2 28 天挑戰舊版、#37 課程照片、#47 臉部顯老細節

**④ 資安/維運(3)**:#55 收回 anon RPC 權限(線上已生效,repo 沒有這支 migration)、#46 cofounder-line 補回 repo、#52 掌聲排程(比賽已結束 → 庫存)

**⑤ 過期(2)**:#1 舊的 CLAUDE.md、#48 7 月信用卡消費資料(個資)

## 3. main 上的庫存候選檔案
| 項目 | 大小 | 原因 |
|---|---|---|
| root `test-*.png/jpeg`(19 個) | 約 5.6 MB | 測試截圖,不該放在 root |
| `robot.mp4` `theme.mp3` | 9.5 MB | 沒有任何地方引用 |
| `plantoflife-{fan,rings,universe,v2}.png` | 0.6 MB | 沒有任何地方引用 |
| `remove_bg*.py`(3 個) | — | 放在 root,可以做成「去背」skill |
| `health-quest-rpg/node_modules` | 2336 個檔、65 MB | 不該 commit |
| `Joyful揪福_網站封包.zip` + 說明 | — | 已交付的封包 |
| `src/googlebe2faa99e4a8959c.html` | — | 和 root 那份重複 |
| `amway-protein/` + `amp-*` functions + 4 個 amp workflow | 4.4 MB | 比賽已結束 |
| `.github/workflows/debug-calendar.yml` + `scripts/debug_calendar.py` | — | 一次性除錯用,會把私人行程印進 Actions log |

## 4. 資安風險
| 等級 | 問題 | 處理方式 |
|---|---|---|
| 🔴 高 | `line-webhook` 沒有驗 LINE 簽章,又是 `--no-verify-jwt`,任何人都能 POST 假的「確認」,觸發每日推圖 | 加上 `x-line-signature` HMAC 驗證(需重新部署) |
| 🔴 高 | Supabase `wcemkmwrlvijxxwybrgs`:`rpc_my_prizes(p_user_id)` 未登入也能呼叫;約 20 支 `rpc_*(p_user_id)` 登入者可帶別人的 id(可能是 IDOR);`curve_ranking` 是 SECURITY DEFINER view(ERROR 等級) | 要先讀函式內容確認(這些函式的程式碼不在這個 repo) |
| 🟠 中 | `facialmonitor_mcp_set_secret` 任何登入者都能呼叫 | 確認函式內有檢查擁有者 |
| 🟠 中 | PR #55 線上已生效,但 repo 缺 migration → 重建資料庫時漏洞會回來 | 合併 #55 |
| 🟠 中 | debug-calendar workflow 會把行程印進 log | 刪除 |
| 🟡 低 | 兩個專案共 10 支函式 search_path 可變;pg_net / pg_trgm 裝在 public;Auth 外洩密碼保護關閉 | migration 補 `set search_path`;Dashboard 開啟保護 |
| 🟡 低 | repo 有個人財務資料(`household-finance/data.json`、PR #48) | repo 若改成公開就會外洩,保持私有,或移到 Supabase |
| ✅ | git 全歷史掃描:沒有 OpenAI / Anthropic / GitHub / service_role / 私鑰外洩,只有 anon key(本來就是公開的) | — |
| ✅ | 其他 Edge Functions 都有驗證(cron key / LINE 簽章 / JWT);RLS 全部開啟(「沒有 policy」= 擋掉 anon,安全) | — |
