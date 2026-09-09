# 安麗蛋白素挑戰 — LINE OA

團隊比賽用的 LINE 官方帳號 + 半頁式 LIFF App。沿用既有的
「我要上513挑戰」channel(Channel ID 2011510570)。

## 玩法

| 行為 | 分數 | 規則 |
|---|---|---|
| 自己吃一湯匙 | +1 | 不設每日上限 |
| 分享一次 | +3 | **必填分享對象名字**;一對一才算,分享到群組不加分 |
| 推薦別人一罐蛋白素 | +5 | **必填被推薦人名字** |
| 每日問答答對 | +1 | 全隊每天同一題,每人一次 |

打「分享」還會回一張**邀請卡**,按下去可以叫出 LINE 的「傳送給…」,
把邀請訊息直接轉傳給朋友或群組。**邀請卡跟比賽計分無關,一律不加分**:
它只是拉人加好友的入口,分數只算你在「加分」頁登記的項目。

計分區下方常駐標語:**自律且誠實,騙人胖十斤**

一輪的長度由 `amp_rounds.start_date`/`end_date` 決定(目前這輪 2026-09-10 ~ 2026-09-30),
`amp_rounds` 同時間只允許一輪 `is_active`。
圖文選單四格都開**同一個半頁 LIFF**(size 設 Tall),在 App 內用底部分頁切換。
排行榜可以「戳」夥伴 —— 戳的當下不推播,每天台北 **17:00** 由排程彙總成一張卡片:
「你被 OO 戳了 N 下,他說一起加油」。

## 架構

```
LINE 訊息 ──► amp-line        (驗簽 → 固定關鍵字 → 回 LIFF 入口卡片)
圖文選單 ──► LIFF 半頁/全頁 ──► amway-protein/ (GitHub Pages)
                                  │ LINE ID token
                                  ▼
                              amp-api        (驗 token → service role 讀寫)
                                  ▼
                        Supabase hhcubvixldieuwdeqnwc(amp_* 資料表)
                                  ▲
GitHub Actions 每天 09:00 UTC ──► amp-poke-digest (彙總推播)
```

前端不持有任何 Supabase 金鑰;LINE token、service role key 只存在 Edge Secrets。

## 檔案

| 路徑 | 用途 |
|---|---|
| `amway-protein/` | LIFF 前端(首頁 / 加分 / 排行 / 問答 / 邀朋友) |
| `supabase/migrations/20260908000100_amway_protein.sql` | 資料表與排行榜 view |
| `supabase/migrations/20260908000200_amway_protein_quiz_seed.sql` | 30 題題庫 |
| `supabase/functions/_shared/amp.ts` | 驗簽 / REST / Flex 卡片 |
| `supabase/functions/amp-line/` | LINE webhook |
| `supabase/functions/amp-api/` | LIFF 後端 API |
| `supabase/functions/amp-poke-digest/` | 戳一下彙總推播 |
| `amway-protein/richmenu.html` / `richmenu.png` | 圖文選單底圖(HTML 原稿 + 2500×1686 成品) |
| `scripts/amp_richmenu.py` | 4 格圖文選單的座標與連結(預設 dry run) |
| `scripts/amp_line_setup.py` | 上線設定:上傳圖文選單 + 設 webhook(預設 dry run) |
| `.github/workflows/amp-line-setup.yml` | 上面那支的手動觸發入口(在網頁上按 Run) |
| `.github/workflows/amp-poke-digest.yml` | 每天 17:00 的排程 |

## 上線步驟

1. **資料庫**:套用兩支 migration。
2. **Edge Secrets**:填下面「Secrets 對照表」的 A 區六個。
3. **部署函式**(LINE 與 LIFF 都不帶 Supabase JWT):
   ```
   supabase functions deploy amp-line --no-verify-jwt
   supabase functions deploy amp-api --no-verify-jwt
   supabase functions deploy amp-poke-digest --no-verify-jwt
   ```
4. **開第一輪賽季**:`insert into amp_rounds (start_date, end_date) values ('YYYY-MM-DD', 'YYYY-MM-DD');`
   (結束後先 `update amp_rounds set is_active=false` 再開新的)
5. **前端上 Pages**:mainwork → Settings → Pages → Deploy from a branch → `main` → `/(root)`。
   網址固定是 **https://ptgaminglife.github.io/mainwork/amway-protein/**
   (要 merge 進 main 才會活),這串就是 LIFF App 的 Endpoint URL。
   四個分頁都在同一個**半頁 LIFF**裡切換,該 LIFF 在 LINE Developers 的
   **size 要設 Tall**(約 3/4 螢幕);Compact 只有一半高,排行榜與問答會被截。
6. **GitHub Secrets**:填對照表的 B 區四個。
7. **圖文選單 + Webhook(自動)**:GitHub → Actions →「安麗蛋白素挑戰 — LINE 上線設定」
   → Run workflow。先用 `dry_run: true` 看一次輸出,確認四格連結沒問題,
   再用 `dry_run: false` 真的送出。不需要在自己電腦下任何指令。
   (本機也可以跑:`python scripts/amp_line_setup.py --action both`,加 `--apply` 才會送)
8. **在 LINE 網頁補最後一步**:
   - Messaging API → 開啟 **Use webhook**,並關閉 Auto-reply 與 Greeting messages
     (這兩個開關沒有 API,只能在網頁上按)
   - LINE Login → 那個半頁 LIFF → 開啟 **Share target picker**
     (分享頁的「傳送給朋友」要靠它;沒開會退回「複製文字」的備援路徑)

## Secrets 對照表

金鑰只存在下面 A / B / C 三處,**絕不進 repo**。D 區是公開值,可以放進程式碼。

### A. Supabase Edge Secrets
位置:Supabase Dashboard → 專案 `hhcubvixldieuwdeqnwc` → Edge Functions → Secrets

| 名稱 | 值從哪來 | 誰在用 |
|---|---|---|
| `AMP_LINE_CHANNEL_SECRET` | LINE Developers → 513 channel → Basic settings → Channel secret | amp-line(驗簽) |
| `AMP_LINE_CHANNEL_ACCESS_TOKEN` | 同 channel → Messaging API → Channel access token (long-lived) | amp-line、amp-poke-digest |
| `AMP_LIFF_CHANNEL_ID` | **LINE Login channel** 的 Channel ID(不是 Messaging API 那個 2011510570) | amp-api(驗 LIFF ID token) |
| `AMP_LIFF_URL_COMPACT` | `https://liff.line.me/<compact LIFF ID>` | amp-line(卡片按鈕) |
| `AMP_LIFF_URL_FULL` | `https://liff.line.me/<full LIFF ID>` | amp-line、amp-poke-digest |
| `AMP_DIGEST_KEY` | 自己產的亂數,見下方說明 | amp-poke-digest(擋非法呼叫) |

`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 由平台自動注入,**不用自己填**。

### B. GitHub Secrets
位置:mainwork → Settings → Secrets and variables → **Actions** → New repository secret

| 名稱 | 值 |
|---|---|
| `AMP_POKE_DIGEST_URL` | `https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/amp-poke-digest` |
| `AMP_DIGEST_KEY` | **與 A 區那份完全相同** |
| `AMP_LINE_CHANNEL_ACCESS_TOKEN` | 與 A 區那份相同(給上線設定 workflow 用) |
| `AMP_LIFF_URL_COMPACT` | 與 A 區那份相同(給上線設定 workflow 用) |

### C. 本機 `.env`(只有想在自己電腦跑腳本時才需要,已在 .gitignore)

`AMP_LINE_CHANNEL_ACCESS_TOKEN`、`AMP_LIFF_URL_COMPACT`、`AMP_WEBHOOK_URL`

走 GitHub Actions 的話這份可以不建。

### D. 不是 secret(公開值,寫在 `js/config.js`)

`LIFF_ID_COMPACT`(所有分頁都用它)、`LIFF_ID_FULL`(目前沒用到,保留)、`API_URL`、
`OA_ADD_FRIEND_URL`(邀請卡按鈕要開的加好友連結)、`SHARE_TITLE` / `SHARE_SUBTITLE`(邀請文案)

### 關於 `AMP_DIGEST_KEY`

它不是 LINE 或 Supabase 發的,是這個專案自己定的共享密碼。`amp-poke-digest` 部署後是個公開網址,
任何人打它就會觸發推播,所以函式要求呼叫端帶 `x-amp-key`,值不對就回 401。
GitHub Actions 帶著這把鑰匙呼叫,別人打不動。隨便產一串長字串,A、B 兩區填同一個值:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
```

## 本機測試

LIFF 只能在 LINE 裡跑,所以前端內建假後端(資料存 localStorage):

```
python -m http.server 8090        # 在 amway-protein/ 底下
# 瀏覽器開 http://127.0.0.1:8090/index.html?mock=1
```

四個頁面、必填名字的擋條件、答題只能一次、戳的提示都可以在這個模式下驗完再上線。

## 題庫

30 題四選一,範圍是蛋白質營養常識、使用習慣、常見迷思、推薦倫理與比賽規則,
**不含療效宣稱與醫療建議**。產品規格類題目沒有入題 —— 那要以當期官方文件為準,
要加題就往 `amp_quiz_questions` 接續 `seq` 新增。
