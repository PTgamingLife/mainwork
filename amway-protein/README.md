# 安麗蛋白素 7 天挑戰 — LINE OA

團隊比賽用的 LINE 官方帳號 + 半頁式 LIFF App。沿用既有的
「我要上513挑戰」channel(Channel ID 2011510570)。

## 玩法

| 行為 | 分數 | 規則 |
|---|---|---|
| 自己吃一湯匙 | +1 | 不設每日上限 |
| 分享一次 | +3 | **必填分享對象名字** |
| 推薦別人一罐蛋白素 | +5 | **必填被推薦人名字** |
| 每日問答答對 | +1 | 全隊每天同一題,每人一次 |

計分區下方常駐標語:**自律且誠實,騙人胖十斤**

賽季 7 天一輪,`amp_rounds` 同時間只允許一輪 `is_active`。
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
| `amway-protein/` | LIFF 前端(首頁 / 加分 / 排行 / 問答) |
| `supabase/migrations/20260908000100_amway_protein.sql` | 資料表與排行榜 view |
| `supabase/migrations/20260908000200_amway_protein_quiz_seed.sql` | 30 題題庫 |
| `supabase/functions/_shared/amp.ts` | 驗簽 / REST / Flex 卡片 |
| `supabase/functions/amp-line/` | LINE webhook |
| `supabase/functions/amp-api/` | LIFF 後端 API |
| `supabase/functions/amp-poke-digest/` | 戳一下彙總推播 |
| `scripts/amp_richmenu.py` | 4 格圖文選單(預設 dry run) |
| `.github/workflows/amp-poke-digest.yml` | 每天 17:00 的排程 |

## 上線步驟

1. **資料庫**:套用兩支 migration。
2. **Edge Secrets**(Supabase → Edge Functions → Secrets):
   `AMP_LINE_CHANNEL_SECRET`、`AMP_LINE_CHANNEL_ACCESS_TOKEN`、`AMP_LIFF_CHANNEL_ID`、
   `AMP_LIFF_URL_COMPACT`、`AMP_LIFF_URL_FULL`、`AMP_DIGEST_KEY`
   (值就是 zip 裡 `PROJECT_513FIGHT_*` 那組)。
3. **部署函式**(LINE 與 LIFF 都不帶 Supabase JWT):
   ```
   supabase functions deploy amp-line --no-verify-jwt
   supabase functions deploy amp-api --no-verify-jwt
   supabase functions deploy amp-poke-digest --no-verify-jwt
   ```
4. **開第一輪賽季**:`insert into amp_rounds (start_date, end_date) values ('YYYY-MM-DD', 'YYYY-MM-DD');`
   (7 天,結束後先 `update amp_rounds set is_active=false` 再開新的)
5. **前端**:GitHub Pages 發佈後,把 LIFF App 的 Endpoint URL 指到 `.../amway-protein/`,
   再把兩個 LIFF ID 填進 `js/config.js`。
6. **圖文選單**:`python scripts/amp_richmenu.py` 看 dry run,確認後 `--apply --image <底圖>`。
7. **Webhook**:LINE Developers → Messaging API → Webhook URL 填 amp-line 的網址,
   Verify 後開啟 Use webhook;關閉 Auto-reply 與 Greeting messages。
8. **GitHub Secrets**:`AMP_POKE_DIGEST_URL`、`AMP_DIGEST_KEY`。

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
