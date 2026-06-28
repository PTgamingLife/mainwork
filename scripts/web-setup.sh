#!/bin/bash
# Claude Code on the web — environment Setup script
# 貼到「環境設定 → Setup script」欄位。每個新 cloud session 啟動前會以 root 執行一次,
# 結果會被環境快取,之後開 session 不必重裝。
# 用途:寶寶成長影片專案 (bg_) 需要 ffmpeg 串接、Pillow 做 EXIF 轉正。
#
# 全程容錯:任何一步失敗都不會讓 session 啟動失敗(最後一律 exit 0)。

# 1) 移除會 403、害 `apt-get update` 整包失敗的第三方 PPA(ondrej/php 已不再簽署)
rm -f /etc/apt/sources.list.d/*ondrej* 2>/dev/null || true

# 2) 系統媒體工具:ffmpeg(影片串接 / 重新編碼)
apt-get update || true
apt-get install -y --no-install-recommends ffmpeg || true

# 3) Python 影像處理:Pillow(依 EXIF 把橫的照片轉正)
pip3 install --quiet --no-input Pillow || true

# 4) 驗證(非致命,只印結果)
ffmpeg -version >/dev/null 2>&1 && echo "setup: ffmpeg OK" || echo "setup: WARN ffmpeg missing"
python3 -c "import PIL; print('setup: Pillow', PIL.__version__)" 2>/dev/null || echo "setup: WARN Pillow missing"

exit 0
