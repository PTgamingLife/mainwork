# 寶寶成長影片 Baby Growth Video

把一系列寶寶照片,依時間順序串接成一支「簡單幻燈片 + 配樂」的成長影片。

> ⚠️ 本文件為**流程參數的單一真實來源(single source of truth)**。
> 修改參數後,`scripts/baby_growth_video.py` 會以對應的環境變數 / 旗標讀取;
> GitHub Actions 也用同一組預設值。下方為目前的預設,請依實際需求調整。

## 1. 輸入照片來源

- 路徑:`assets/baby/`(repo 內committed 資料夾)
- 支援副檔名:`.jpg .jpeg .png .heic .webp`(HEIC 需 Pillow 對應外掛,缺少時自動略過)
- **排序方式**:預設依 EXIF 拍攝時間(`DateTimeOriginal`)由舊到新;若照片無 EXIF,退回用「檔名自然排序」。
- **EXIF 轉正**:讀檔時自動套用 EXIF Orientation 把照片轉正(Pillow `ImageOps.exif_transpose`)。

## 2. 影片規格(預設值)

| 參數 | 預設 | 環境變數 | 說明 |
|------|------|----------|------|
| 解析度 | `1080x1920` | `BGV_RESOLUTION` | 直式(適合 IG/限動);橫式可設 `1920x1080` |
| FPS | `30` | `BGV_FPS` | 影格率 |
| 每張秒數 | `2.5` | `BGV_SECONDS_PER_PHOTO` | 每張照片停留秒數(含轉場) |
| 轉場秒數 | `0.6` | `BGV_TRANSITION` | 交叉淡入淡出(xfade)長度,須 < 每張秒數 |
| 背景縮放 | `contain` | `BGV_FIT` | `contain`=完整letterbox / `cover`=填滿裁切 |
| 背景色 | `black` | `BGV_PAD_COLOR` | letterbox 補邊顏色 |
| 配樂 | `assets/bgm/`第一個音檔 | `BGV_BGM` | `.mp3/.m4a/.wav`;無檔則輸出無聲影片 |
| 輸出 | `output/baby-growth.mp4` | `BGV_OUTPUT` | H.264 + AAC,`yuv420p` |

影片總長(N 張照片)= `N * 每張秒數 - (N-1) * 轉場秒數`。配樂會以 `-shortest` 對齊影片長度。

## 3. 執行方式

### 本地
```bash
pip install Pillow
# 需要系統有 ffmpeg
python scripts/baby_growth_video.py
```

### GitHub Actions
`.github/workflows/baby-growth-video.yml`,以 `workflow_dispatch` 手動觸發。
可在觸發時用 inputs 覆寫:每張秒數、轉場、解析度。
產出的 `baby-growth.mp4` 會以 **artifact** 上傳,可在該次 run 頁面下載。

## 4. 待辦 / 可擴充

- [ ] 日期字幕(每張照片角落顯示拍攝日期)
- [ ] 片頭片尾標題卡
- [ ] 從 Supabase / Google Drive / IG 抓照片(目前為 repo 內資料夾)
