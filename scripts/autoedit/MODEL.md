# 影片編輯模型(字幕驅動貼圖/B-roll/調色 + 學習迴圈)

> 這是一個「活的編輯模型」。核心能力:**貼圖、B-roll、調色**。
> 它會透過使用者上傳「別人的影片」當參考(見 `CASES.md`)持續學會「怎麼編得更好」。
> ❌ 已移除「自動剪輯(auto-cut 砍片段/砍空白)」——影片整段保留,只做加工。
> 程式在同目錄 `scripts/autoedit/` + CLI `scripts/ae.py`。

**版本:v2.5**(2026-08-10 人臉自動置中 + 燒死字幕漸層 + 使用者掌控斷句)
**平台**:Windows + Python 3.14;ffmpeg 由 winget 安裝,程式自動偵測路徑。

---

> 🎬 **導演層**:給口播稿自動產「逐句分鏡 → 動畫」見 `DIRECTOR.md`(整合 AI-2D 動畫導演框架,對映本工具動畫庫)。

## 一、核心流程(字幕驅動,三步)

```
上傳影片
 └─ Step 1  抓字幕      python ae.py plan 影片 -o out/
              → word 級轉錄,列出每句字幕 + 時間軸(不裁切、不砍空白)
 └─ Step 2  逐句點選     人看字幕清單,替每句標:要不要「貼圖」/「B-roll」/只「調色」
              → 寫成 edit_plan.json(no_cut 預設 true,整段保留)
 └─ Step 3  編輯輸出     python ae.py render edit_plan.json -o 成品.mp4
              → 整段影片 + (可選)調色 + 逐句貼圖/B-roll + 字幕
```

**設計理念**:程式只負責「抓字幕 + 執行 ffmpeg」;**哪句配什麼貼圖/B-roll 由人(或 Claude)決定**,並且這個「決定」會隨著 `CASES.md` 累積越來越準(見第五章)。

---

## 影片模式(可選其一)

| 模式 | 風格 | 版面 | 指令 |
|------|------|------|------|
| **A · 疊圖**(預設) | 黃綠活潑 | 全屏講者 + 上方疊動畫貼圖 | `python ae.py render edit_plan.json -o 成品.mp4` |
| **B · luxe 奢華** | 米白+金 premium | 第一句全屏 → 之後上下分割(講者下方視窗) | `python scripts/autoedit/luxe/render_luxe.py plan.json 成品.mp4` |

> luxe(Mode B)三種語意動畫:`chart`(數字→上升折線圖)、`coin`(感覺→撒錢金幣)、`swap`(改變認知→刪舊字蓋新字)+ `cta`;雙語字幕;plan 格式與範例見 `luxe/render_luxe.py` docstring 與 `luxe/example_807b_plan.json`。動畫庫 `luxe/luxe_anim.py`。
> 之後新設計風格 → 各自成一個 mode 檔,plan 選 mode。

## 二、三大能力

| 能力 | 說明 | 細節 |
|------|------|------|
| 🎯 貼圖 | 逐句疊「演出語意」的動畫貼圖(講者保留) | 第三章 |
| 🎬 B-roll | 講到生活/概念時切全屏畫面(AI 生成或實拍) | 第四章 |
| 🎨 調色 | 暖膚色/降噪/輕磨皮/銳化(縮 1080p) | 第六章 |

> 字幕預設**燒錄**(可雙語,見 roadmap);B-roll 期間仍保留字幕與貼圖。

---

## 三、貼圖動畫系統(`stickers.py`)

用 **PIL 逐幀繪製透明 PNG 序列**,render 疊到影片上(非 AI 生成)。
**原則**:畫面本身要「演出當下那句話的語意」,不是把字放大。

| type | 演出語意 | 參數 |
|------|---------|------|
| `counter` | 數字飆升(133→3.4萬、$10M+) | `from` `to` `label` |
| `ring` | 圓環跑到 N%(99% 交給 AI) | `pct` `label` |
| `loop` | 循環箭頭 + N 點亮起(六個迴圈) | `count` `label` |
| `flow` | 卡片串流飛入 AI 晶片(貼文變素材) | `items` `label` |
| `clone` | 人形複製分身滑入 AI(複製技能) | `clones` `label` |
| `text` | 關鍵字彈跳(無語意動畫時 fallback) | `text` `color` |
| `sticker` | 靜態圖/app logo(png) | `asset` |

- 共同:`start` `end`(秒)、`y`(距頂 px,預設150,避開底部字幕)。
- 視覺規範:主色黃 `#FFD400`、輔綠 `#22DD66`、白字黑邊;`SS=2` 超取樣抗鋸齒;字型 `msjhbd.ttc`(勿用 arial,中文變豆腐);描邊用 PIL 原生 `stroke_width`(勿巢狀迴圈,會 timeout);串流類用 `((p*cycles)+k/n)%1` 確保任何一刻都有動態。

---

## 四、B-roll 工作流(Higgsfield MCP)

1. 依句子語意寫 prompt → `generate_video`(`kling3_0_turbo`, `9:16`, 5秒 ≈ 7.5 點;`get_cost:true` 先估)。
2. 非同步 → `job_display` 取 `rawUrl` → curl 下載。
3. 路徑填 `edit_plan.overlays` 的 `broll.clip` → render。
- B-roll = **全屏切換**(蓋掉講者);貼圖 = **疊上方**(講者可見)。B-roll 期間仍保留字幕/貼圖/CTA。

---

## 五、🧠 學習迴圈(這個模型怎麼變聰明)

**觸發**:使用者上傳/貼一支「別人的影片」網址,說「分析這個參考影片」。

**流程**:
1. 下載影片(`python -m yt_dlp`)+ WebFetch 抓 caption/數據。
2. 均勻抽幀(12+ 張)+ 放大關鍵幀,**看它實際怎麼編**:字幕設計、每句配什麼貼圖、B-roll 時機、節奏、版面/CTA。
3. **在 `CASES.md` 新增一筆案例**(依範本),記錄手法。
4. **萃取可複用規則,寫回本檔下方「已學到的編輯原則」**;版本 +0.1。
5. 向使用者回報:這支編輯強在哪(3 點)、我們學到什麼、下支可以怎麼套。

> 分析對象是「**怎麼編**」(視覺/貼圖/節奏),不是腳本/hook 那套——那是 `/reels-script` 的守備,兩個模型互補。

### 已學到的編輯原則(權重最高,生成 edit_plan 時優先套用)

> 來自 `CASES.md` 的真實範例,持續累積。

1. **每句配「演出語意」的貼圖**(名詞→圖示):數字→counter、軟體/工具→app logo、技能→人形、循環→loop、資料流→flow。(Case #1)
2. **雙語字幕 + 關鍵字黃色 highlight**,是 AI 教學帳號的視覺標配。(Case #1)
3. **計數器裝進深色圓角膠囊 + 小 icon 前綴**,比裸數字精緻。(Case #1)
4. **頂部常駐標題膠囊條**(黑底白字),強化主題 + 當封面點擊。(Case #1)
5. **B-roll 只在敘事需要時切**(生活/對比/概念),且 B-roll 上仍保留字幕/貼圖/CTA。(Case #1)
6. **釘住單一 CTA**(留言關鍵字),全片一個 CTA。(Case #1)
7. **每 2–3 秒一個貼圖/畫面變化**,不留靜止死畫面。(Case #1)
8. **【進階版面】上下分割**:動畫放上方純黑畫布、講者縮小放下方 → 動畫更大更乾淨,不擠臉上。(Case #2)
   ・**【最高階】全螢幕動畫卡 ↔ 全屏講者交替**:動畫吃滿全螢幕更有衝擊(炫技/清單型適用)。(Case #3)
   ・**動態字標題卡**(大粗字+ghost疊影)當章節分隔;**擬真 App-UI mockup**(agent面板/檔案diff/檔案卡)是「等級」關鍵;**品牌吉祥物+品牌色+點陣/光暈**建立視覺識別。(Case #3)
9. **選一套內聚視覺系統**:黃綠活潑 or 黑+紅+白 premium,別亂用色。(Case #2)
10. **講道理用清單卡**:痛點=紅✗清單、功能=紅▶清單,紅膠囊當標題。(Case #2)
11. **痛點→解法→願景→CTA** 的敘事弧,配「數字計數器+虛線弧、華夫格1%、大型動態字、假App-UI mockup」等動畫。(Case #2)
12. **講者小窗要「人臉置中 + 帶肩」**:用 YuNet(cv2 5.0)自動偵測臉,算「卡片比例、臉置於 ~42% 高度」的裁切窗(`face_center`,預設開;偵不到臉 fallback 固定 bias)。固定 bias 會因人物在畫面的位置不同而歪 → 一律自動偵測。(807c)
13. **來源自帶「燒死字幕」時,別硬裁**:字幕常緊貼臉下方,裁掉就得過度放大→糊+切頭。改用**卡片底部柔化漸層**蓋掉(`card_fade`,漸層淡入到卡片底色),構圖維持舒服;我的乾淨字幕在卡片上方不受影響。最乾淨仍是「請對方給無燒字幕的原檔」。(807c)
14. **字幕斷句由使用者掌控**:whisper 依停頓切的卡常斷在詞中間。給使用者「連續全文 + `\|` 標斷句」讓他移動/增刪 `\|`、改字;用 `char_timeline`(每字→時間)+ `resegment.py` 對齊回原片時間(刪英文/合併/改字都能對)。(807c)

---

## 六、edit_plan.json 規格

```json
{
  "video": "C:/path/影片.mp4",
  "no_cut": true,            // 預設 true=整段保留(已移除自動剪輯)
  "enhance": false,          // true=調色磨皮(縮1080p)
  "burn_subtitles": false,   // true=用 cards 燒字幕;片子已內建字幕時設 false
  "segments": [ {"id":1,"start":0,"end":80,"cards":[]} ],  // no_cut 時放一段涵蓋全片
  "overlays": [              // 逐句貼圖/B-roll,用秒數對位
    {"type":"counter","from":0,"to":10000000,"label":"營收","start":8,"end":12},
    {"type":"broll","clip":"broll1.mp4","start":70,"end":76}
  ]
}
```

調色 CONFIG 在 `common.py`(順序:縮放→降噪→磨皮→調色→暖色→銳化);4K 一律先縮 1080p。

---

## 七、踩坑清單(別重犯)

- 專案在 **OneDrive\桌面** 底下:OneDrive 曾把 session 新建但未上傳的檔「還原」掉(整個 autoedit 套件消失,只剩 __pycache__)。**新檔建完盡快 git commit** 上保險;必要時對資料夾設「一律保留在此裝置」。
- iPhone MOV 多軌 → 先 `ffmpeg -map 0:v:0 -map 0:a:0` 清軌再處理。
- whisper `small` 記憶體不足(mkl_malloc)→ transcribe 已自動降級 small→base→tiny。
- whisper 聽錯專有名詞(Claude→counter/Clock code)→ `plan --fix 錯=對` 或人工修。
- 中文字型:用 `msjhbd.ttc`(arial 會讓中文/「萬」變豆腐)。
- drawtext 在 Windows 需 `fontfile=` 明指字型(否則 fontconfig segfault)。
- render timeout:PIL 用原生 stroke、整段用 `no_cut`;長 render 放背景跑。
- **圖片貼圖 `-loop 1` 會讓輸出無限延長**(曾編到 10 分鐘、1GB):render 已加 `-t {總長}` 限制輸出長度。看到成品異常大/render 極慢,先查是不是輸出長度爆掉。
- `smartblur`(磨皮)在 1080p 極慢(~0.05x);只要「暖膚/降噪」就關掉它,留 hqdn3d+colortemperature+eq(可在呼叫前設 `CONFIG['enh_skin']=''`)。
- python subprocess 不吃 MSYS `/c/...` 路徑,要用 `C:/...`;bash 則可用 `/c/...`。
- 含中文的路徑在 bash tool 有時亂碼找不到檔 → 改用 PowerShell 或絕對路徑。
- **OpenCV(cv2)在 Windows 讀不了含中文的路徑**(專案在「桌面」下):模型檔要先複製到 ASCII 暫存再 `FaceDetectorYN_create`;讀影格用 `cv2.imdecode(np.fromfile(path))` 繞過。**成品輸出檔名也用 ASCII**(如 `807c_final.mp4`),否則 bash 驗證階段會 Illegal byte sequence。
- **render 完成偵測別亂猜**:ffmpeg 邊寫邊產生半成品檔 → 「檔案一出現就當完成」會抓到壞檔。正解=等 **render 的 python 程序結束**(PowerShell 輪詢),再 `ffmpeg -v error -f null -` 驗完整解碼。最終合成有 ~70+ overlay(動畫+clip+逐句字幕)時 ffmpeg 很慢,整支 106s 約 13 分鐘,**放背景 + 監看 python 收工**,別用前景(Bash 10 分鐘 timeout 會砍掉)。
- 「Conversion failed!」出現但成品 full-duration 可完整解碼 → 多半是某支 clip 尾端 EOF 的良性報錯,檔案可用(先 `-f null -` 驗一次)。
- **cv2 5.0 沒有 `CascadeClassifier`**(Haar 移除),改用 `FaceDetectorYN`(需 `assets/yunet.onnx`,~230KB,OpenCV zoo)。
- OneDrive 刪檔重建後,`luxe_anim` 的 `clone`/`flow` 曾遺失、`counter`/`ring` 改名為 `make_counter2`/`make_progress_ring` → `render_luxe.ANIM_FN`/`ANIM_Y` 要對齊註冊,否則 render 抛 KeyError。

---

## 八、待辦 / Roadmap（部分來自 Case #1 的啟發)

- [ ] **雙語字幕 + 關鍵字 highlight**(學 Case #1;目前單語無 highlight)。
- [ ] **頂部常駐標題膠囊條**(可在 edit_plan 設 title)。
- [ ] **計數器改膠囊樣式 + icon 前綴**(貼近 Case #1)。
- [ ] **app logo 圖示庫**(Pr/YouTube/code/晶片…)供 `sticker` 類直接引用(自有庫優先,缺的抓公開)。
- [x] **【已做:Mode B】上下分割版面模式**:動畫黑畫布(上)+ 講者小視窗(下)+ 雙語字幕在中線。
- [ ] **【Case #2】新動畫型**:清單卡(紅✗/▶)、華夫格1%點陣、計數器+虛線弧、大型動態字、假App-UI mockup、月曆UI。
- [x] **主題/模式系統**:Mode A 黃綠疊圖 / Mode B 米白奢華分割(已可選);未來新風格各成一 mode。
- [x] **講者卡人臉自動置中**(YuNet)+ **燒死字幕底部漸層**(`face_center`/`card_fade`,render_luxe)。
- [x] **使用者掌控斷句**:`逐字稿_斷句版`(`\|` 標斷句)+ `char_timeline` + `resegment.py` 對回時間 → 塞 plan['subtitles']。
- [ ] **一鍵自動模式**:plan 讀逐字稿,依「已學到的編輯原則」自動產出每句 overlay 草稿,人只微調。
- [ ] 之後升級本機網頁 UI(打勾選句、預覽、拖拉貼圖)。
- [ ] **【借鑑 HyperFrames·大升級】動畫層 PIL → HTML/CSS/GSAP/Lottie + Playwright 無頭截圖**;保留字幕/講者/學習迴圈,只換動畫作者層。詳見 DIRECTOR.md 第六章。
- [ ] **【HyperFrames】pixel 全動畫加 TTS 旁白 + 場景時長對齊**;採密度/節奏表定動畫數;版面補 pip/overlay;storyboard schema 加 zone/intent。

---

## 版本紀錄

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-07-17 | 初版:技術管線文件(analyze/plan/render、6 種貼圖、B-roll、CONFIG、踩坑) |
| v2.0 | 2026-07-28 | **轉型為編輯學習模型**:移除自動剪輯(render 預設 no_cut)、確立字幕驅動三步流程、新增學習迴圈 + CASES.md、寫入 Case #1(@growithfyn)7 條編輯原則 |
| v2.1 | 2026-07-31 | 納入 Case #2(@growithfyn 動畫炫技示範):上下分割版面、黑紅白視覺系統、清單卡/華夫格1%/計數器+虛線弧等新動畫型,寫入原則 8–11 + roadmap |
| v2.2 | 2026-07-31 | luxe 米白奢華上下分割正式化為 Mode B(render_luxe.py + luxe_anim.py):第一句全屏、之後分割、chart/coin/swap/cta 語意動畫、雙語字幕、plan 驅動可重複用 |
| v2.3 | 2026-08-01 | 納入 Case #3(最高階對標):全螢幕動畫卡↔全屏講者交替、動態字標題卡、擬真App-UI mockup、品牌吉祥物/珊瑚色視覺識別 → 未來 Mode C |
| v2.4 | 2026-08-02 | 借鑑 heygen/HyperFrames:DIRECTOR 第六章逐段採用(HTML/GSAP動畫層 roadmap、密度節奏、版面策略、storyboard schema、直式尺寸、BRIEF/VO_MODE、全動畫TTS) |
| v2.5 | 2026-08-10 | Case #5(807c 實作淬煉):**人臉自動置中**(YuNet `face_center`)、**燒死字幕底部漸層**(`card_fade`)、**使用者掌控斷句**(`\|` 標記+`char_timeline`+`resegment.py` 對回時間)、補回 `clone`/`flow` 動畫並註冊 `counter`/`ring`;寫入原則 12–14、踩坑(OpenCV 中文路徑/render 完成偵測/cv2 5.0 無 Haar) |
