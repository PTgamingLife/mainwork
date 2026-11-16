#!/usr/bin/env bash
# ============================================================
#  Carbaby —《小星星》第一支影片 自動合併腳本
#  需求: 已安裝 ffmpeg
#     macOS:  brew install ffmpeg
#     Windows: winget install ffmpeg   (或 choco install ffmpeg)
#     Linux:  sudo apt install ffmpeg
#
#  用法:
#     1) 準備一段免版稅《小星星》器樂 mp3，命名 music.mp3 放同資料夾
#        (YouTube 音效庫 / Pixabay Music 搜 "Twinkle instrumental" CC0)
#     2) 執行:  bash scripts/carbaby_build.sh
#     3) 產出:  carbaby_twinkle.mp4  (1080p, 約 38 秒)
#  如果沒有 music.mp3，腳本仍會輸出「無聲版」影片。
# ============================================================
set -e

BASE="https://d8j0ntlcm91z4.cloudfront.net/user_3E8E7dfEkimdmsd0LdokMgNgQuE"

# --- 依播放順序列出片段 (檔名 : 來源) ---  ※ 新版劇情 (唱兩遍)
declare -a FILES=(
  "intro.mp4|$BASE/hf_20260712_032107_748e28eb-27ee-41a5-9117-3e62986f9ea4.mp4"   # 片頭 Logo
  "s1.mp4|$BASE/hf_20260712_135954_1e8cde5b-3af3-468e-b8e5-bafc93959127.mp4"       # 1 一閃一閃亮晶晶 左前45° 眼睛飛星
  "s2.mp4|$BASE/hf_20260712_135956_a04390c6-1337-4fe6-80cc-aeabd408bf4a.mp4"       # 2 滿天都是小星星 POV左 8星彈出
  "s3.mp4|$BASE/hf_20260712_135959_ec8d4d32-5899-4473-a5ad-0e35b5a4864a.mp4"       # 3 掛在天上放光明 POV直 喇叭閃3次
  "s4.mp4|$BASE/hf_20260712_151102_a5bcb194-4fda-4de0-b2e7-1eb26eacda9a.mp4"       # 4 好像許多小眼睛 POV右 星滑左
  "s5.mp4|$BASE/hf_20260712_151105_5ec11b72-90ba-4e4a-b827-96da1a2754c5.mp4"       # 5 一閃一閃亮晶晶 右前45° 眼睛飛星
  "s6.mp4|$BASE/hf_20260712_005124_0f1a55e4-addd-4a0e-b08a-fc4a9f3c6c18.mp4"       # 6 滿天都是小星星 拉遠
  "end.mp4|$BASE/hf_20260712_151108_d8c49380-b214-4000-83f8-a62f29ffb820.mp4"      # 片尾 微笑→倒車入庫→閉眼
)

echo "==> 下載片段..."
for item in "${FILES[@]}"; do
  name="${item%%|*}"; url="${item##*|}"
  [ -f "$name" ] || curl -sSL -o "$name" "$url"
done

echo "==> 統一規格 (1920x1080 / 30fps / 去音軌)..."
norm() {  # $1=in  $2=out  $3=額外參數(可空,例如 -t 3 裁切片頭)
  ffmpeg -y $3 -i "$1" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" \
    -c:v libx264 -pix_fmt yuv420p -an "$2" -loglevel error
}
norm intro.mp4 n_intro.mp4 "-t 3"     # 片頭裁成 3 秒
norm s1.mp4  n_s1.mp4
norm s2.mp4  n_s2.mp4
norm s3.mp4  n_s3.mp4
norm s4.mp4  n_s4.mp4
norm s5.mp4  n_s5.mp4
norm s6.mp4  n_s6.mp4
norm end.mp4 n_end.mp4

echo "==> 依順序串接 (第 1-6 播兩遍後接片尾)..."
cat > list.txt <<EOF
file 'n_intro.mp4'
file 'n_s1.mp4'
file 'n_s2.mp4'
file 'n_s3.mp4'
file 'n_s4.mp4'
file 'n_s5.mp4'
file 'n_s6.mp4'
file 'n_s1.mp4'
file 'n_s2.mp4'
file 'n_s3.mp4'
file 'n_s4.mp4'
file 'n_s5.mp4'
file 'n_s6.mp4'
file 'n_end.mp4'
EOF
ffmpeg -y -f concat -safe 0 -i list.txt -c copy silent_full.mp4 -loglevel error

if [ -f music.mp3 ]; then
  echo "==> 疊上背景音樂..."
  ffmpeg -y -i silent_full.mp4 -stream_loop -1 -i music.mp3 \
    -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k \
    -af "volume=0.85" -shortest carbaby_twinkle.mp4 -loglevel error
  echo "✅ 完成: carbaby_twinkle.mp4 (含音樂)"
else
  cp silent_full.mp4 carbaby_twinkle.mp4
  echo "⚠️  找不到 music.mp3 → 已輸出無聲版: carbaby_twinkle.mp4"
  echo "    放一段《小星星》器樂 music.mp3 後重跑即可加上音樂。"
fi
