---
status: new
from: 十神修行錄(shishen-quest)
date: 2026-11-28
type: web
---
# 今日卜卦(三錢法・周易 64 卦)

## 一句話用途
使用者按住龜殼(或實際搖手機)約 1 秒得一爻,搖滿 6 次成卦,顯示本卦、變爻、變卦的卦辭/爻辭與白話說明;一天一卦。給 LINE OA 建置中心做成獨立的「功能拼圖」。

**只交付卜卦**,十神修行錄的其他功能(命盤、打卡、天使、試煉場)不在範圍內。

## 檔案位置
| 檔案 | 用途 |
|---|---|
| `shishen-quest/js/sg-divine.js` | 核心邏輯(64 行):三錢起爻 `sgCastYao`、加爻 `sgAddYao`、卦象 bits、變卦 `sgChangedBits`、文王卦序 `sgHexNo`/`sgHexName`、爻名 `sgYaoLabel`、存卦辭 `sgSetDivineText` |
| `shishen-quest/js/sg-divine-view.js` | 畫面(47 行):`sgDivineCard(state, ui)` 回傳 HTML 字串(龜殼按鈕、爻象由上往下、本卦/變爻/變卦區塊) |
| `shishen-quest/js/sg-app.js` 第 231–313 行 | 互動:按住龜殼 1 秒出爻(pointerdown/up)、`devicemotion` 搖手機累積 1 秒出爻、iOS 動作權限請求、成卦後呼叫後端取卦辭 |
| `shishen-quest/css/sg-style.css` 第 185–206 行 | 樣式:`.sg-turtle` 搖晃動畫、`.sg-yao` 陽爻/陰爻/變爻 |
| `shishen-quest/img/sg-turtle.webp` | 龜殼與三枚古錢圖(140KB) |
| `supabase/migrations/20261024000100_shishen_quest_iching.sql` | 資料表 `sg_iching` 結構(RLS 開啟,只給 service role 讀) |
| `supabase/seed/sg_iching.json` | 64 卦資料:卦名、全名、bits、上下卦、卦辭、白話、6 條爻辭、用九/用六 |
| `supabase/functions/sg-api/index.ts` 的 `hexagram` action | 後端查卦辭(見下方 API) |

## 怎麼用
**資料結構(存在使用者狀態裡)**
```js
state.sg_divines = {
  "2026-11-28": {
    sg_lines: [7, 8, 9, 7, 6, 8],   // 初爻→上爻;6 老陰(變) 7 少陽 8 少陰 9 老陽(變)
    sg_coins: [[3,2,2], ...],       // 每爻三枚錢,正面 3、反面 2
    sg_bits: "101101",              // 本卦,由下而上 1=陽
    sg_changed: "100111",           // 變卦(沒有變爻時為 "")
    sg_text: { main: {...}, changed: {...} | null },  // 後端回傳的卦辭,取過就不再查
    sg_at: "ISO 時間"
  }
}  // 只保留最近 30 天
```

**流程**
1. `const yao = sgCastYao()` → `{ value, coins }`
2. `const done = sgAddYao(state, yao)` → 滿 6 爻回傳 true,並算好 `sg_bits` / `sg_changed`
3. 成卦後呼叫後端取卦辭 → `sgSetDivineText(state, res)`
4. `sgDivineCard(state, { shaking, divineError })` 產生畫面

**後端 API(目前在 sg-api 裡)**
```
POST { action: "hexagram", bits: "101101", changed: "100111", idToken }
→ { ok: true, main: {sg_no, sg_name, sg_full_name, sg_bits, sg_judgment, sg_plain, sg_lines[6], sg_extra}, changed: {...} | null }
```
做法:`select ... from sg_iching where sg_bits in (bits, changed)`。拆成獨立拼圖時建議另寫一支只做這件事的 Edge Function(或把 64 卦 JSON 直接打包進前端,就不需要後端與資料表)。

**顯示規則**
- 有變爻:顯示變爻的爻辭;六爻全變且有用九/用六 → 顯示 `sg_extra`
- 無變爻:「六爻皆不變,以本卦卦辭為主」
- 有變卦:另顯示「變卦・事情的走向」

## 前置需求
- 若沿用後端:Supabase 建 `sg_iching` 表(跑 migration)+ 匯入 `supabase/seed/sg_iching.json`(64 列)
- sg-api 的使用者驗證是 LIFF ID token(頻道 `2011684838`);拼圖若用別的 LIFF / 頻道要自己換
- 無其他金鑰(卜卦本身不用 AI)

## 外部資料連結
無(64 卦資料已在 repo 的 `supabase/seed/sg_iching.json`)

## 注意事項 / 已知限制
- 命名前綴是十神修行錄的 `sg_`;做成拼圖時請改成建置中心自己的代號前綴(使用者規則:參數要加程式代號)。
- `sg-divine.js` 依賴 `sg-store.js` 的 `sgDateStr()`(本地日期 YYYY-MM-DD),拆出時要自己補一個。
- 卦辭、爻辭依維基文庫《周易》整理(〔〕校注已移除);`sg_plain` 白話說明為自撰。
- 畫面配色是十神的「煙雨水墨」,CSS 變數 `--sg-*`,拼圖可換成建置中心的主題。
- Supabase 線上另有一支 `sg-tool-zhouyi` Edge Function(不在本 repo,來源未知),拆拼圖前可先查是否重複。

## 驗證狀態
- 十神修行錄線上已上線(LIFF「今日」頁);本次交付時未重新實測,請收件後先在本地跑一次。
- 未測:拆成獨立拼圖後的版本(尚未存在)。
