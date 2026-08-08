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

---

## 六、借鑑 HyperFrames(heygen/hyperframes;逐段採用決定)

> HyperFrames = 「寫 HTML → 無頭 Chrome 逐幀截圖 → FFmpeg 出 MP4」的 agent 影片框架。
> 跟我們同目標但更成熟。以下是逐段判斷後**要吸收進本模型**的部分。

### A.【大升級·roadmap】動畫作者層:PIL → HTML/CSS/GSAP/Lottie + Playwright
- 現況:luxe_anim 用 PIL 逐幀手畫(受限、費工)。
- 目標:場景改用 **HTML/CSS + GSAP/Lottie** 寫,用 **Playwright(無頭 Chrome)逐幀截圖** + 現有 FFmpeg 合成。
- 好處:整個 web 動畫生態(GSAP 緩動、**Lottie 免費動畫庫**、SVG、WebGL 轉場),質感跳專業級、程式更少。
- **保留不變**:字幕精準對位、講者上下分割、Supabase 24h、學習迴圈、DIRECTOR 分鏡。只換「動畫怎麼畫」那層。
- 遷移方式:PoC 先用 HTML+GSAP 寫一個場景(折線圖/標題卡)→ Playwright 截圖 → 比 PIL 版 → 逐步替換。
- ✅ **已 PoC 通過 + 引擎建好**:`luxe/luxe_html.py`(title/list/counter/swap 4 場景,GSAP+Playwright 透明 PNG)、`luxe/examples/`(chart PoC)。下一步:render_luxe 的對映 anim 切到 luxe_html,舊 PIL 當 fallback。

### B.【立即採用】卡片密度 / 節奏規則(決定放幾個動畫)
| 片長 | 每卡秒數 |
|---|---|
| <60s | 6–8s |
| 60s–3min | 8–12s |
| 3–10min | 12–20s |
- 密度倍率:高(清單/數據/短促)×0.7、中 ×1.0、長(敘事)×1.5;**最少 5 個動畫卡**。

### C.【採用】版面策略(擴充我們的 stack)
| 版面 | 講者位置 | 卡片區 | 用途 |
|---|---|---|---|
| split | 右半 | 側欄 | 講者+數據並排 |
| **stack**(我們現用) | 上/下半 | lower-third | 講者+摘要 |
| pip | 角落小窗 | 全屏 | 內容為主、講者次要 |
| overlay | 全屏 | 疊玻璃層 | 電影感 |
- 版面切換用 0.5–0.7s ease 過場。

### D.【採用】storyboard 卡片 schema(擴充我們的 scenes)
每個鏡加:`zone`(fullscreen/lower-third/side-panel/video-overlay)、`intent`(自然語言描述,給設計用)、`accentIndex`(主題色索引)、`contentHints`(kicker/title/detail/quote/data)。

### E.【採用】直式尺寸基準(1080×1920,比橫式 ×1.3)
Hero 標題 88–132px、內文 30–40px、左右留白 24–36px。

### F.【採用】主題用色彩變數
`--accent-N` / `--bg` / `--text`,主題可攜(對映我們 cream/dark/pixel);HTML 化後直接用。

### G.【採用】BRIEF 鎖定 + VO_MODE
專案開頭鎖死決策(主題/受眾/theme/版面/語音/VO_MODE=逐字 or 重構),寫進 plan 頂層,**半途不再反覆問**。

### H.【採用·補我們缺口】全動畫(pixel/faceless)需 TTS 旁白
- pixel 全動畫模式沒有真人聲 → 需 **TTS 生成旁白**(Higgsfield audio / 離線 TTS),再 **sync-durations** 把每個場景時長對齊旁白。
- 靜音片可省 SCRIPT,BGM 由 storyboard 的 music 欄決定。

### I.【採用·原則】
- **動畫全程發展、不要 hook 後就凍結**(配合旁白逐步 reveal)。
- **value-before-evidence**:先立教學點,再鋪陳(呼應 reels 模型)。
- 字幕:短句、關鍵詞、能獨立理解、不擋臉(已內建)。

### 版本
| 版本 | 日期 | 變更 |
|------|------|------|
| v1.1 | 2026-08-02 | 逐段吸收 HyperFrames:動畫層 HTML/GSAP 化(roadmap)、密度節奏表、版面策略、storyboard schema、直式尺寸、色彩變數、BRIEF/VO_MODE、全動畫 TTS |
