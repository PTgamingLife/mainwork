# 寶寶 0→2 歲「吃東西長大」串接影片 (專案代號 `bg_`)

透過 Higgsfield MCP 把多張寶寶照片做成一支「每換一個畫面就長大一點」的串接影片,
約 20 秒、直式 9:16,適合 IG Reels。

> 注意:來源照片與輸出影片屬個人/兒童影像,**不納入版控**(見 `.gitignore` 的 `photos/`、`output/`)。
> 本檔僅記錄流程、參數與決策,方便重跑。

## 決策(與使用者確認)

1. **照片**:採用實際提供的 5 張(原表格的 6 個月 / 1.5 歲缺檔,改用現有 5 張依外觀年齡重排),
   成片實際為 **0 → 約 3 歲**。
2. **步驟 B(統一構圖重繪)**:跳過,保留真實長相;直接用原圖當 Kling 關鍵影格。
3. **換場手法**:用「寶寶打嗝 (hiccup)」動作當作每段之間的成長轉場。
4. **Kling 聲音**:關閉 (`sound: off`) 以節省額度。

## 照片順序(年齡遞增)

| 順序 | 檔案 | 年齡(外觀) | 特徵 |
|---|---|---|---|
| 0 | IMG_3536 | 0 歲 | 企鵝包屁衣躺著 |
| 1 | IMG_4922 | ~1 歲 | 領結背心站著 |
| 2 | IMG_4097 | ~2 歲 | 粉條紋拿杯子 |
| 3 | IMG_7024 | ~2.5 歲 | 灰色警車衣吃飯大笑 |
| 4 | IMG_4895 | ~3 歲 | 灰衣用筷子吃麵(原檔橫向,已 EXIF 轉正)|

`IMG_4895` 原始 EXIF orientation=6,以 `PIL.ImageOps.exif_transpose` 轉成直式正向 (4284×5712)。

## 影片模型參數 (Kling v3.0 / `kling3_0`)

- duration: 5 秒 / 段(範圍 3–15,預設 5)
- aspect_ratio: `9:16`
- sound: `off`
- mode: `std`
- medias roles: `start_image` / `end_image`
- 4 段關鍵影格:
  - bg_seg_1: img0 → img1
  - bg_seg_2: img1 → img2
  - bg_seg_3: img2 → img3
  - bg_seg_4: img3 → img4

### 共用 prompt(打嗝轉場 / 英文)

```
The same child sits at the table. They give a small, cute hiccup ("hic!"),
their shoulders bouncing once. As they hiccup, their face and body smoothly and
naturally grow older — cheeks slimming, hair growing, getting taller — morphing
seamlessly into an older version of the same child. Continuous growth
transformation, identity preserved, warm cozy home lighting, soft cinematic
focus, heartwarming family moment, single continuous shot.
```

## 串接 (ffmpeg)

```bash
cd output
printf "file 'bg_seg_1.mp4'\nfile 'bg_seg_2.mp4'\nfile 'bg_seg_3.mp4'\nfile 'bg_seg_4.mp4'\n" > bg_list.txt
ffmpeg -f concat -safe 0 -i bg_list.txt -c copy bg_final.mp4
# 若 -c copy 因編碼不一致失敗:
ffmpeg -f concat -safe 0 -i bg_list.txt -c:v libx264 -pix_fmt yuv420p -r 30 bg_final.mp4
```

## 已知阻礙 (2026-06-28)

Higgsfield 上傳主機 `upload.higgsfield.ai` 被本環境的 egress 政策拒絕 (CONNECT 403),
代理規則禁止繞過政策封鎖。可行解法:

1. 在環境網路政策放行 `upload.higgsfield.ai` 與 `d2ol7oe51mr4n9.cloudfront.net`,
   重開一個新 session(政策於容器啟動時固定,需重啟才生效),再 curl 直傳。
2. 用 Higgsfield 上傳 widget(瀏覽器端直傳,繞過 proxy)。
3. 在 higgsfield.ai 網站手動上傳,取得 5 個 media_id。

額度:目前 210 credits / `starter` 方案(4 段 Kling 影片可能偏緊)。
