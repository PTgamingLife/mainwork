# vidgen — 文稿轉口播影片 pipeline

把一份文稿做成短影音:**(你的聲音)旁白 + 自動字幕 + B-roll → 合成成片**。

這是第一階段。**口播臉(對嘴）目前不做**,之後以新的 provider 接上即可,其餘流程不變。

## 它做什麼

```
文稿
 └─ 1. 導演層(LLM）   文稿 → 分鏡表 storyboard.json(切句 / 情緒 / 每段配什麼畫面)
    2. 語音            每段旁白 → 你的聲音音檔,量測長度
    3. 視覺            每段 → B-roll(生成）或你提供的背景圖,長度對齊旁白
    4. 合成(FFmpeg）  逐鏡頭 mux → 串接 → 燒字幕 →(可選）配樂 → final.mp4
```

導演層和合成層是這個產品的核心——市面上沒有現成 API,所以自己寫。
語音與 B-roll 則是**可插拔 provider**,沒有 API key 時用 Mock 也能跑完整流程、驗證時間軸。

## 快速開始(無需任何 API key)

```bash
# 系統需要 ffmpeg
apt-get install -y ffmpeg          # macOS: brew install ffmpeg
pip install -r requirements.txt

# 純 Mock:佔位畫面 + 靜音旁白,驗證整條流程跑得通
python scripts/make_video.py --script my_script.txt --title "測試" --no-llm
# 產出在 out/final.mp4,中間檔(分鏡表、各鏡頭素材、字幕)也都在 out/
```

## HTTP API(給前端 talkmeme 接)

`build_video()` 耗時(數十秒~數分鐘),所以對外是**非同步 job 服務**:送出文稿 → 背景生成 → 輪詢進度 → 下載成片。前端是純靜態頁、與 API 不同源,API 全程開 CORS。

```bash
# 本機起服務(沿用下面那組 provider 環境變數)
pip install -r requirements.txt          # 含 flask / gunicorn
python scripts/serve_api.py              # 預設 0.0.0.0:8000

# 或用容器(已內建 ffmpeg)
docker build -t vidgen .
docker run -p 8000:8000 \
  -e VIDGEN_VOICE_PROVIDER=elevenlabs -e ELEVENLABS_API_KEY=... -e ELEVENLABS_VOICE_ID=... \
  -e VIDGEN_BROLL_PROVIDER=http -e VIDGEN_BROLL_ENDPOINT=... \
  -v "$PWD/data:/data" vidgen
```

### 端點契約

| Method | 路徑 | 說明 |
|--------|------|------|
| `POST` | `/jobs` | 送出文稿+參數,回 `202` + `{ id, status:"queued", ... }` |
| `GET` | `/jobs/<id>` | 查狀態:`{ status, stage, progress(0~1), error, has_video }`;status ∈ `queued/running/done/error` |
| `GET` | `/jobs/<id>/video` | `done` 後下載 `final.mp4`(未完成回 `409`) |
| `GET` | `/jobs/<id>/storyboard` | 回填過長度的分鏡表 JSON |
| `GET` | `/jobs` | 列出所有 job(除錯用) |
| `GET` | `/health` | 健康檢查 |

`POST /jobs` 接受兩種 body:
- **application/json**:`{ "script": "...", "title?": "...", "style?": "...", "aspect?": "9:16|16:9|1:1|4:5", "use_llm?": true|false }`(純文字,最簡單)
- **multipart/form-data**:同上欄位,另可附 `bg`(背景圖,可多張)與 `music`(配樂)檔案

前端典型流程:`POST /jobs` 拿 `id` → 每 1–2 秒 `GET /jobs/<id>` 更新進度條(用 `stage` + `progress`)→ `status==="done"` 後把 `/jobs/<id>/video` 設給 `<video>` 或下載。

### API 相關環境變數

| 環境變數 | 預設 | 說明 |
|---------|------|------|
| `PORT` | `8000` | 監聽埠 |
| `VIDGEN_API_WORKDIR` | `out/api` | 各 job 的產出根目錄 |
| `VIDGEN_CORS_ORIGIN` | `*` | 上線後建議鎖成前端網域 |

> **擴展性**:job 狀態存在記憶體、由單一背景 worker 依序消化(ffmpeg 很吃 CPU,序列化較穩),所以服務只能跑**單一程序**(Docker 用 gunicorn `--workers 1 --threads N`)。要水平擴展時,把 `jobstore.py` 換成共享儲存(DB + 物件儲存)即可,HTTP 契約不變。

## 接上真實 provider

用環境變數切換,程式不用改:

| 環境變數 | 值 | 說明 |
|---------|----|----|
| `OPENAI_API_KEY` | sk-... | 有設就用 LLM 導演層,否則退回規則切句 |
| `VIDGEN_DIRECTOR_MODEL` | gpt-4o | 導演層模型 |
| `VIDGEN_VOICE_PROVIDER` | `mock` / `elevenlabs` | 語音來源 |
| `ELEVENLABS_API_KEY` | ... | voice-clone 金鑰 |
| `ELEVENLABS_VOICE_ID` | ... | 先用你的乾淨人聲在 ElevenLabs 建好 voice 取得 |
| `ELEVENLABS_MODEL` | eleven_multilingual_v2 | 支援中文 |
| `VIDGEN_BROLL_PROVIDER` | `mock` / `http` | B-roll 來源 |
| `VIDGEN_BROLL_ENDPOINT` / `VIDGEN_BROLL_API_KEY` | ... | `http` provider 用 |

```bash
VIDGEN_VOICE_PROVIDER=elevenlabs VIDGEN_BROLL_PROVIDER=http \
python scripts/make_video.py --script my_script.txt --title "正式版" \
  --style "cinematic, warm tone" --aspect 9:16 \
  --bg backgrounds/office.jpg --music bgm.mp3
```

### 要自己補的兩個接點

- **B-roll(text-to-video)**:`providers.py` 的 `HttpBrollProvider.make_clip()`。
  各家(Seedance / Higgsfield / Kling…）的提交與輪詢流程不同,把生成影片存到 `out_path` 即可;
  提示詞用 `shot.broll_prompt`,長度盡量貼近 `duration`。背景圖那條路(`background`)已實作。
- **口播臉**:第一階段不含。之後新增一個 `TalkingHeadProvider`,
  在 pipeline 的視覺步驟對「對著鏡頭講」的 shot 改用它,其餘維持 B-roll。

## 你需要準備的素材條件

- **語音克隆**:10–30 分鐘乾淨人聲、同一支麥克風、無背景音樂;最好涵蓋平述/興奮/嚴肅等語氣
  (情緒語氣最終取決於你錄的素材是否涵蓋該情緒)。
- **背景圖**:用 `--bg` 提供,導演層會在合適段落改用 `visual_kind=background`。
- **配樂**:`--music`(可選),旁白為主、配樂自動壓低。

## 品質 / 壓縮注意

合成參數集中在 `ffmpeg_utils.py`(低 CRF、高碼率音訊、避免反覆轉檔),
微表情/細節相關的「別被壓縮吃掉」策略都改這裡。中間檔不做多次有損編碼,只在最後輸出一次。

## 模組

| 檔案 | 職責 |
|------|------|
| `schema.py` | 分鏡表資料模型 `Shot` / `Storyboard` |
| `director.py` | LLM 導演層(文稿 → 分鏡表) + 規則切句 fallback |
| `providers.py` | 語音 / B-roll 的抽象介面 + Mock / ElevenLabs / HTTP 實作 |
| `subtitles.py` | 由各 shot 實際長度產生 SRT(之後可升級逐字字幕) |
| `assemble.py` | FFmpeg 合成:mux / 串接 / 燒字幕 / 配樂 |
| `ffmpeg_utils.py` | FFmpeg 封裝與品質參數 |
| `pipeline.py` | 端到端串接 `build_video()`(可選 `progress` 進度回呼) |
| `jobstore.py` | 非同步 job 佇列 + 背景 worker |
| `api.py` | Flask HTTP API(前端接點) |
