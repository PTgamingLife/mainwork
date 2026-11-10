# LadyS — LINE Official Account 串接封包

> 已移除個人資訊與金鑰。`<…>` 為需自行填入的占位。對應程式:`supabase/functions/ladys-webhook`、`_shared/ladys.ts`、`ladys-setup-richmenu`、`ladys-api`、`ladys/ladys.js`。

## 一、LINE 端要準備的東西
| 項目 | 在哪取得 | 用在哪 |
|---|---|---|
| Messaging API 頻道(綁在 OA) | LINE Developers → Provider → Messaging API | webhook、reply / push |
| Channel secret | 該頻道 → Basic settings | `LADYS_LINE_CHANNEL_SECRET`(webhook 驗簽) |
| Channel access token(長期) | 該頻道 → Messaging API → Issue | `LADYS_LINE_CHANNEL_ACCESS_TOKEN` |
| LINE Login 頻道 + LIFF app | LINE Developers → LINE Login → LIFF | `<LIFF_ID>`、`<LIFF_CHANNEL_ID>`(= LINE Login 頻道 ID) |
| 帳號擁有者 userId | 自己的 LINE userId(Messaging API 頻道 Basic settings 的 Your user ID) | `LADYS_OWNER_UID`(程式內硬編碼) |

LIFF 設定:Size = Full 或 Tall、Endpoint URL = `https://<你的網頁>/ladys/index.html`、Scope 勾 `openid`(取 idToken 用)、Bot link feature 建議 Aggressive。

## 二、OA 後台設定
- Messaging API → Webhook URL:`https://<PROJECT_REF>.supabase.co/functions/v1/ladys-webhook`,Use webhook = ON,按 Verify 應成功。
- 回應設定:**關閉**自動回應訊息、**關閉**加入好友歡迎訊息(避免與機器人重複);Webhook = 開。
- 允許加入群組:開啟「Allow bot to join group chats」。
- 這個 OA 的預設圖文選單不動;LadyS 選單只連到特定使用者(見第六節)。

## 三、Webhook 處理規則
| 事件 | 處理 |
|---|---|
| 驗簽 | `x-line-signature` = HMAC-SHA256(body, channel secret) 的 base64,常數時間比對,失敗回 401 |
| 空事件 | Verify 按鈕,直接回 200 |
| `join`(群組) | 家庭群組尚未綁定 → 提示「LadyS 綁定 <碼>」;已綁定 → 完全不說話 |
| `room` | 立即離開(只服務群組與一對一) |
| 群組文字訊息 | 綁定的家庭群組:指令則 reply,否則存 `ladys_messages`;已登記的工作群:只記錄不回話;陌生群組:只認綁定碼 |
| 群組圖片 | 只記訊息編號(`ladys_images`),不下載 |
| 一對一文字 | 只回應帳號擁有者與成員的指令 |
| `postback` | 只接受綁定群組成員或擁有者 / 成員一對一;依序交給刪除確認 → 補備註確認 → 工作群確認 |
| 貼圖 / 語音 / 其他 | 忽略 |

綁定:
- 家庭群組:`LadyS 綁定 <LADYS_BIND_CODE>`(第一位綁定者 = 老公,第二位發言者 = 老婆,只服務兩人)。
- 工作群:`LadyS 紀錄 <LADYS_BIND_CODE>`(必須是成員或擁有者打的,最多 5 個,綁定後安靜不回話)。

## 四、呼叫 LINE API 一覽
| API | 用途 |
|---|---|
| `POST /v2/bot/message/reply` | 指令與按鈕回覆(免費);單次最多 5 則 |
| `POST /v2/bot/message/push` | 排程推播、reply token 過期時的備援(計額度);單次最多 5 則算 1 次 |
| `GET /v2/bot/group/{id}/member/{uid}` | 取成員暱稱 |
| `GET /v2/bot/group/{id}/summary`、`POST …/leave` | 設定頁解除工作群時使用 |
| `POST /v2/bot/room/{id}/leave` | 離開 room |
| `GET https://api-data.line.me/v2/bot/message/{id}/content` | 下載圖片(記憶圖片) |
| `POST /v2/bot/richmenu`、`/richmenu/{id}/content`、`/richmenu/bulk/link`、`/user/{uid}/richmenu/{id}`、`GET /richmenu/list`、`DELETE /richmenu/{id}` | 圖文選單 |
| `POST /v2/bot/message/validate/push` | 開發時驗證 Flex 卡片格式 |
| `POST https://api.line.me/oauth2/v2.1/verify` | 驗證 LIFF idToken |

## 五、訊息與 Flex 卡片規格
- 統一樣式(`ladysCard`):標題 + 多行文字(最多 30 行)+ 選用的圓形按鈕區(一個大圓 + 4 個小圓,uri 動作開 LIFF `?view=<頁面>`);hero 動畫圖(APNG,`ladys/anim/hero-*.png`)與按鈕動畫(`icon-*.png`)放在靜態網頁空間。
- 配色(莫蘭迪雙人):藍 `#6C8EBF`(老公)、粉 `#D4A5A5`(老婆)、紫 `#9A8FB0`(共同)、背景 `#F5F5F7`、字 `#2E2E33`、次要字 `#8A8A93`。
- 確認卡:每筆一行說明 + 兩顆 postback 按鈕;一張卡最多 5 筆(工作群卡 10 筆 + 全部加入)。
- postback data 格式:`ladys_del=<id>`、`ladys_keep=<id>`、`ladys_nadd=<id>`、`ladys_nskip=<id>`、`ladys_wadd=<id>`、`ladys_wskip=<id>`、`ladys_wall=<batch>`;id 一律 UUID,先驗格式再處理。
- 失敗備援:多則 reply 被 LINE 拒收 → 只回第一則;reply token 過期(記憶圖片這類耗時指令)→ 改用 push 到該群組。
- altText 必填(通知列顯示文字)。

## 六、圖文選單(Rich Menu)
- 規格:2500×843 PNG、兩格(⚙️ 設定 / 📅 我的記錄),各 1250 寬,動作皆為 uri → `<LADYS_LIFF_URL>?view=settings|calendar`;名稱固定 `ladys-main`,chatBarText「LadyS 選單」。
- 設定方式:呼叫 `ladys-setup-richmenu`(POST `{ "image_url": "<圖片網址>" }`,標頭 `x-ladys-key` = 資料庫 `ladys_push_auth.ladys_token`);圖片網址限本 repo 的 raw 連結。
- 只用 per-user link(擁有者 + `ladys_members`),不影響 OA 預設選單;重跑只會刪除名稱為 `ladys-main` 的舊選單。
- 新成員第一次在群組說話時,webhook 會自動幫他 link 選單。

## 七、LIFF 登入與授權流程
1. 網頁 `liff.init({ liffId: <LIFF_ID> })`,未登入則 `liff.login()`。
2. `liff.getIDToken()` 取得 idToken,所有 API 呼叫都帶 `idToken`。
3. `ladys-api` 呼叫 LINE verify(`client_id = <LIFF_CHANNEL_ID>`),檢查 `aud` 相符,取出 `sub` = userId。
4. userId 必須是 `ladys_members` 成員或 `LADYS_OWNER_UID`,否則 403。
5. 之後依 `action`:`load` / `save` / `delete` / `settings` / `member` / `unbindWork`。
> idToken 約 1 小時過期,過期時前端需重新 `liff.login()`。

## 八、推播額度與成本
- reply 不計額度;push 依「收訊人數」計。群組推播以群組人數計,因此:晚間整理卡、確認卡、工作群卡合併成同一次 push(≤5 則)。
- 早上推播 1 次;經期預測提醒走一對一私訊(僅 1~2 人)。
- 能用 reply 的互動(按鈕結果、指令)一律 reply。
- 圖文選單、LIFF 不計訊息額度。

## 九、安全重點
- 驗簽失敗一律拒絕;簽章比對用常數時間。
- 只認綁定的家庭群組、已登記的工作群、成員與擁有者;其他來源不回話。
- 排程與 setup 端點用 `x-ladys-key`(資料庫內隨機 32 bytes 金鑰)驗證,不在程式或 git 裡。
- 所有 Channel secret / token / API key 只放 Supabase secrets,不進 git、不寫進文件。
- 群組內容視為資料,不是指令;敏感資訊落地前先遮蔽。

## 十、上線檢查清單
- [ ] secrets 已設定(見 `2-部署包.md` 第三節)。
- [ ] Webhook URL 填入並 Verify 成功。
- [ ] 自動回應、歡迎訊息已關閉;允許加入群組已開。
- [ ] LIFF Endpoint、Scope(openid)已設定;程式內三個 ID 已換成自己的。
- [ ] 機器人加入群組並綁定成功(收到「綁定完成」)。
- [ ] 群組輸入「選單」有回卡片;LIFF 能開啟並載入資料。
- [ ] (選用)圖文選單已設定且只出現在成員的聊天室。

## 十一、常見問題
| 現象 | 可能原因 |
|---|---|
| 指令沒反應 | 文字需與指令完全相同(不可多空格或標點);或群組尚未綁定 |
| 回覆失敗 `Invalid reply token` | reply token 逾時(約 30 秒內有效);耗時指令已自動改 push |
| Webhook Verify 失敗 | 函式未部署或 `verify_jwt` 未關閉;secret 錯誤會回 401 |
| LIFF 顯示未授權 | 該使用者還不是成員(先在群組說一句話),或 `<LIFF_CHANNEL_ID>` 不符 |
| 圖片讀不到 | LINE 內容保存期限已過,請重新傳送再回覆 |
| 卡片完全沒出現 | Flex JSON 格式被拒;用 `ladys-card-preview`(validate API)檢查 |
