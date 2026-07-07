# LINE 翻譯機器人

把 LINE 官方帳號加進一個群組,群組裡的人打特定開頭就會自動翻譯。

## 功能

| 你在群組打的字 | 機器人做的事 |
|---|---|
| `嘿嘿 Hello world` | 偵測到非中文 → 翻成**繁體中文 + 英文** |
| `嘿嘿 今天天氣很好` | 偵測到中文 → 翻成**群組設定的語言**(預設:越南文、英文) |
| `設定-日文、韓文` | 把「中文輸入」要翻成的語言改成日文、韓文(整個群組共用) |
| `群組id` | 回覆目前群組的 groupId(設定階段用來找 ID) |

> 規則:`嘿嘿` 後面是中文 → 翻成設定的目標語言;後面非中文 → 一律翻成中英。

## 架構

```
LINE 群組訊息
   │ webhook (POST)
   ▼
Supabase Edge Function (line-translate)
   ├─ 驗證 LINE 簽章
   ├─ 讀/寫群組設定 (Supabase 資料表)
   ├─ 呼叫 Claude API 翻譯
   └─ 回覆 LINE
```

金鑰(LINE token、Anthropic key)只存在 Edge Function secrets,**不會**出現在前端或 repo。

---

## 部署步驟

### 1. 建 LINE 官方帳號 + Messaging API channel

1. 到 [LINE Developers Console](https://developers.line.biz/) 建一個 **Messaging API** channel。
2. 記下 **Channel secret**(Basic settings 頁)。
3. 在 **Messaging API** 頁發一個 **Channel access token (long-lived)**。
4. 同一頁把 **Allow bot to join group chats** 打開;關掉 **Auto-reply messages** 跟 **Greeting messages**(不然會洗版)。

### 2. 建資料表

在 Supabase SQL Editor 執行 [`schema.sql`](schema.sql)。

### 3. 設定 secrets 並部署 Edge Function

```powershell
# 在本資料夾(含 supabase/ 的上層)執行
supabase link --project-ref hhcubvixldieuwdeqnwc

supabase secrets set LINE_CHANNEL_SECRET=你的_channel_secret
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=你的_access_token
supabase secrets set ANTHROPIC_API_KEY=你的_anthropic_key
# TARGET_GROUP_ID 先不設,等第 5 步拿到群組 ID 再設

# 重要:LINE 不會帶 Supabase JWT,部署時要關掉 JWT 驗證
supabase functions deploy line-translate --no-verify-jwt
```

部署後 webhook 網址是:
```
https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/line-translate
```

### 4. 設定 LINE webhook

回 LINE Console → Messaging API → **Webhook URL** 填上面那個網址 → 按 **Verify** 應該回 Success → 打開 **Use webhook**。

### 5. 鎖定特定群組

1. 把官方帳號加進你要的群組。
2. 在群組裡打 `群組id`,機器人會回一串 `Cxxxxxxxx...`。
3. 把它設成 secret 並重新部署:
   ```powershell
   supabase secrets set TARGET_GROUP_ID=Cxxxxxxxx...
   supabase functions deploy line-translate --no-verify-jwt
   ```
   設定後,機器人只會回應這個群組(其他群組會被忽略)。

---

## 測試

群組裡依序試:

```
嘿嘿 Good morning everyone        → 回中文 + 英文
嘿嘿 我們明天九點開會               → 回越南文 + 英文(預設)
設定-日文、韓文                       → 回「已更新…日文、韓文」
嘿嘿 我們明天九點開會               → 改回日文 + 韓文
```

## 常見問題

- **Verify 失敗 / 401**:多半是 `LINE_CHANNEL_SECRET` 設錯,或部署時忘了 `--no-verify-jwt`。
- **機器人不回話**:檢查 LINE Console 的 **Auto-reply** 是否關閉、**Use webhook** 是否打開;以及 `TARGET_GROUP_ID` 是否填成別的群組。
- **翻譯很慢或很貴**:把 `index.ts` 裡的 `MODEL` 從 `claude-opus-4-8` 改成 `claude-haiku-4-5`(快很多、便宜很多,翻譯品質對日常對話足夠),再重新部署。
- **想加更多目標語言**:直接在群組打 `設定-越南文、英文、泰文` 即可,不用改程式。
