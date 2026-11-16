---
name: media-pipeline
description: 影片與圖片處理工具箱。四種用法:(1) 文稿轉口播短影音(vidgen:分鏡→旁白→B-roll→字幕→合成,可接 HTTP API);(2) 照片依日期串成成長紀錄幻燈片影片(轉場、配樂);(3) 兒歌/卡通分鏡素材用 ffmpeg 組裝成 MV(Carbaby 範本);(4) 圖片去背(白底洪水填充 / rembg AI / 綠底輔助)。觸發詞:「文稿做成影片」「口播影片」「vidgen」「照片做成影片」「成長影片」「組裝 MV」「去背」「移除背景」。不負責 AI 生成畫面(那是 stage-ai-video-production),也不負責口播後製貼圖(那是 scripts/autoedit)。
---

# media-pipeline

所有工具都在本機跑,需要 `ffmpeg` 與 `Pillow`。指令一律從 repo root 執行(Windows 用 PowerShell,路徑有中文要加引號)。

## 1. 文稿 → 口播短影音(vidgen)
程式:`src/vidgen/`(細節見 `src/vidgen/README.md`),入口:`scripts/video/make_video.py`
```
pip install -r src/vidgen/requirements.txt
python scripts/video/make_video.py --script 文稿.txt --title "標題" --no-llm   # 純 Mock,先驗證時間軸
python scripts/video/make_video.py --script 文稿.txt --title "標題"            # 用 LLM 導演層分鏡
```
- 產出:`out/final.mp4`(1080×1920),中間檔(分鏡表、各鏡頭)也在 `out/`
- 語音/B-roll 是可插拔 provider,沒金鑰會自動走 Mock;金鑰只放環境變數,不要寫進檔案
- 要給前端用:`python scripts/video/serve_api.py`(非同步 job API,見 README)
- 會花錢的 provider(TTS、圖像生成)**先估成本、問過使用者再跑**

## 2. 照片 → 成長紀錄影片
入口:`scripts/video/baby_growth_video.py`
- 照片放 `assets/baby/`(檔名 `YYYY-MM-DD_*.jpg` 會依日期排序),配樂放 `assets/bgm/`
- 環境變數:`BGV_INPUT_DIR`、`BGV_OUTPUT`(預設 `output/baby-growth.mp4`)、`BGV_BGM`、`BGV_RESOLUTION`(預設 1080x1920)、`BGV_SECONDS_PER_PHOTO`(2.5)、`BGV_TRANSITION`(0.6)、`BGV_FIT`(contain|cover)
- ⚠️ 家人照片是個資:**不要 commit 進 repo**(mainwork 有開 GitHub Pages,檔案可能被公開讀到),用 `BGV_INPUT_DIR` 指向 repo 外的資料夾

## 3. 分鏡素材 → 兒歌 MV(Carbaby 範本)
入口:`scripts/video/carbaby_build.sh`(bash;Windows 用 Git Bash 或 WSL)
- 把各鏡頭圖/片段與 `music.mp3` 放同一個資料夾後執行;沒有 music.mp3 就輸出無聲版
- 換別首歌:複製這支腳本,改鏡頭清單與秒數

## 4. 圖片去背
入口:`scripts/image/remove_bg.py`
```
python scripts/image/remove_bg.py 圖檔或資料夾 --mode flood --out 輸出資料夾
```
| mode | 適用 | 需要 |
|---|---|---|
| `flood`(預設) | 純白底插圖、icon | 只要 Pillow |
| `ai` | 照片、複雜背景 | `pip install rembg` |
| `ai-green` | 白色主體在白底(例如白色機器人吉祥物) | `pip install rembg` |
- 沒給 `--out` 會**覆寫原檔** → 對既有作品素材一定要給 `--out`

## 驗收
- 影片:`ffprobe -v error -show_entries format=duration:stream=width,height -of csv=p=0 輸出.mp4`,確認長度與解析度
- 去背:打開輸出 PNG,確認角落是透明的(alpha=0)、主體沒被吃掉
