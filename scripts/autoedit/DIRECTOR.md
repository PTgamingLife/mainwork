# 動畫導演層(口播稿 → 分鏡 → edit_plan)

> 來源:使用者提供的「AI-2D 動畫導演 Agent」框架,**已改寫成對映本工具動畫庫的版本**。
> 用途:給一段口播稿,產出「逐句分鏡」→ 直接生成 luxe/render 的 `scenes`(動畫)+ `subtitles`。
> **關鍵調整**:原框架假設每鏡都 AI 生成;本工具以**程式動畫庫為主**(免點數、可控),AI clip 只用在需寫實精緻的鏡頭。

---

## 一、流程(5 步)

1. **讀參數**:content_type / platform / tone / visual_style(cream 米白奢華 or dark 深色珊瑚 or pixel 全動畫)/ duration / goal / must_include / must_avoid / reference_style。
2. **切語義單元**:用原片轉錄(word 級)切句,每句一個核心訊息。
3. **標語意功能**:Hook / 問題 / 解釋 / 案例 / 轉折 / 方法 / 結論 / CTA。
4. **判畫面功能 → 選動畫**(見第二章對映表)。
5. **輸出 7 區塊**(第三章)+ 生成 `scenes`/`subtitles`(第四章)。

資訊不足時,先問 1–3 個最關鍵問題(通常:主題?平台長度?主題色 cream/dark/pixel?)。

---

## 二、內容判斷 → 動畫對映(核心)

> 左邊是框架的「句型/畫面功能」,右邊是**本工具實際能出的動畫**(luxe_anim / pixel)。

| 句型 / 畫面功能 | 選用動畫(anim) | 備註 |
|---|---|---|
| 數字 / 數據 / 成長 | `chart`(折線)`counter`(飆升)`ring`(百分比)`loop`(N迴圈) | 不秀數字也可,用趨勢演出 |
| 觀點 / 概念 / 章節標題 | `title`(大字+ghost)`list`(清單卡) | 章節分隔 |
| 抽象 → 具象 / 改變認知 | `swap`(刪舊字蓋新字) | ~~舊觀念~~→新觀念 |
| 資料 / 內容彙整 | `flow`(卡片飛入)`app_ui`(agent面板diff)`list` | 把功能演成介面 |
| 工具 / 品牌 | `logos`(品牌logo)`app_ui` | |
| 免費 / 給予 / 釋出 | `free`(FREE字卡)`coin`(撒錢)`handoff`(交錢) | |
| 痛點 / 情緒 / 案例小劇場 | `smash`(被砸)`clip`(AI寫實) `pixel:scene_*`(像素小劇場) | 需精緻寫實→AI clip |
| 語言/障礙(如全英文) | `words`(單字群) | |
| 技能 / 複製 / 放大 | `clone`(分身)`swap` | |
| 轉折 / 停頓 | (無動畫,留字幕定格) | 空鏡=節奏 |
| 結論 / 收束 | `title` `swap`(定格新觀念) | |
| CTA | `cta`(金色膠囊) | 一支一個 CTA |

**視覺一致性**:整支固定一個 theme(cream/dark/pixel);不跳 tone;動畫不擋臉/字幕。

---

## 三、輸出 7 區塊(導演方案)

1. **影片目標**(1–3 句)
2. **視覺風格設定**(theme + 版面:全屏/上下分割/全動畫)
3. **內容分段摘要**(語義段 + 核心意思)
4. **分鏡表**(欄:鏡號 | 時間碼 | 口播原句 | 語意功能 | 畫面功能 | 動畫(anim) | 畫面描述 | 字幕重點 | 生成提示詞(僅 AI clip 鏡) | 備註)
5. **字幕建議**(短句、關鍵詞、≤一行、不擋臉)
6. **一致性檢查**(角色/場景/道具/字幕遮擋/跳tone/資訊過載/炫技)
7. **下一步建議**(生成 plan.json / AI clip prompt 清單 / render)

---

## 四、產出 edit_plan(接 render_luxe)

分鏡表 → 直接寫成 luxe plan:
- 每個「有動畫的鏡」→ 一個 `scenes[]`:`{"anchor":"該句一段文字","anim":"對映動畫","dur":秒,"params":{…}}`
- 字幕 → `subtitles[]`(逐句、修口誤)。
- theme:`cream` / `dark`;`split_start`:第一句全屏到幾秒。
- AI clip 鏡:先用「生成提示詞」跑 Higgsfield → 下載 → `{"anim":"clip","params":{"file":路徑}}`。

→ `python scripts/autoedit/luxe/render_luxe.py plan.json 成品.mp4`

---

## 五、字幕 / 提示詞規則(沿用框架)

- 字幕:不逐字全抄;每鏡短句;關鍵詞為主;能獨立理解;不壓臉/手/產品。(本工具 split_subtitle 已自動切 ≤max_chars)
- AI clip 提示詞:主體 + 動作 + 場景 + 情緒 + 視覺風格(深色珊瑚/像素)+ 景別 + 構圖 + 禁止事項;具體可生成,不要只寫形容詞。

---

## 版本
| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-08-02 | 導入「AI-2D 動畫導演」框架,改寫成對映本工具動畫庫的導演層;分鏡表 → edit_plan 流程 |
