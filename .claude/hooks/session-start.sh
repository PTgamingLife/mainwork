#!/bin/bash
# Claude Code SessionStart hook
# 安裝專案執行所需的系統與 Python 相依：ffmpeg(影片串接) + Pillow(EXIF 轉正) + requirements.txt
set -uo pipefail

# 移除會 403、害 apt-get update 失敗的第三方 PPA
rm -f /etc/apt/sources.list.d/*ondrej* 2>/dev/null || true

# ffmpeg(影片串接) — 需要 root；本機非 root 時用 sudo，失敗也不中斷
if command -v ffmpeg >/dev/null 2>&1; then
  echo "setup: ffmpeg already installed"
else
  APT="apt-get"
  [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && APT="sudo apt-get"
  $APT update || true
  $APT install -y --no-install-recommends ffmpeg || true
fi

# Python 相依(含 Pillow、openai、supabase 等)
if [ -f requirements.txt ]; then
  pip3 install --quiet --no-input -r requirements.txt || true
fi
# Pillow(EXIF 轉正)— 保險再裝一次
pip3 install --quiet --no-input Pillow || true

# 驗證
ffmpeg -version >/dev/null 2>&1 && echo "setup: ffmpeg OK" || echo "setup: WARN ffmpeg missing"
python3 -c "import PIL; print('setup: Pillow', PIL.__version__)" 2>/dev/null || echo "setup: WARN Pillow missing"

exit 0
