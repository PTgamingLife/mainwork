#!/usr/bin/env python3
"""寶寶成長影片 — 把 assets/baby/ 的照片串成簡單幻燈片 + 配樂的 mp4。

流程參數的單一真實來源見 docs/baby-growth-video.md。
依賴:Pillow(EXIF 轉正)+ 系統 ffmpeg(影片串接 / 轉場 / 配樂)。
"""
from __future__ import annotations

import os
import re
import sys
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

# ---- 參數(預設值;可用環境變數覆寫,見 docs/baby-growth-video.md) ----
ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = Path(os.environ.get("BGV_INPUT_DIR", ROOT / "assets" / "baby"))
BGM_PATH = os.environ.get("BGV_BGM", "")            # 空字串 = 自動找 assets/bgm/ 第一個音檔
OUTPUT = Path(os.environ.get("BGV_OUTPUT", ROOT / "output" / "baby-growth.mp4"))
RESOLUTION = os.environ.get("BGV_RESOLUTION", "1080x1920")
FPS = int(os.environ.get("BGV_FPS", "30"))
SECONDS_PER_PHOTO = float(os.environ.get("BGV_SECONDS_PER_PHOTO", "2.5"))
TRANSITION = float(os.environ.get("BGV_TRANSITION", "0.6"))
FIT = os.environ.get("BGV_FIT", "contain").lower()   # contain | cover
PAD_COLOR = os.environ.get("BGV_PAD_COLOR", "black")

IMG_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".webp", ".bmp", ".tiff"}
AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".aac", ".ogg"}


def log(msg: str) -> None:
    print(f"[baby-growth] {msg}", flush=True)


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def exif_datetime(img: Image.Image):
    """回傳 EXIF DateTimeOriginal 字串,沒有則 None。"""
    try:
        exif = img.getexif()
        # 0x9003 = DateTimeOriginal, 0x0132 = DateTime
        for tag in (0x9003, 0x0132):
            val = exif.get(tag)
            if val:
                return str(val)
    except Exception:
        pass
    return None


def collect_photos(input_dir: Path):
    files = [p for p in input_dir.iterdir()
             if p.is_file() and p.suffix.lower() in IMG_EXTS]
    if not files:
        return []

    dated, undated = [], []
    for p in files:
        dt = None
        try:
            with Image.open(p) as im:
                dt = exif_datetime(im)
        except Exception as e:
            log(f"WARN 無法讀取 {p.name}:{e}")
            continue
        (dated if dt else undated).append((dt, p))

    dated.sort(key=lambda x: x[0])
    undated.sort(key=lambda x: natural_key(x[1].name))
    ordered = [p for _, p in dated] + [p for _, p in undated]
    return ordered


def find_bgm() -> str:
    if BGM_PATH:
        return BGM_PATH if Path(BGM_PATH).is_file() else ""
    bgm_dir = ROOT / "assets" / "bgm"
    if bgm_dir.is_dir():
        cands = sorted([p for p in bgm_dir.iterdir()
                        if p.is_file() and p.suffix.lower() in AUDIO_EXTS],
                       key=lambda p: natural_key(p.name))
        if cands:
            return str(cands[0])
    return ""


def normalize_image(src: Path, dst: Path, w: int, h: int) -> None:
    """EXIF 轉正 + 縮放成 w x h(contain letterbox 或 cover 裁切)。"""
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)        # EXIF 轉正
        im = im.convert("RGB")
        if FIT == "cover":
            im = ImageOps.fit(im, (w, h), method=Image.LANCZOS, centering=(0.5, 0.5))
            canvas = im
        else:  # contain
            im.thumbnail((w, h), Image.LANCZOS)
            canvas = Image.new("RGB", (w, h), PAD_COLOR)
            canvas.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
        canvas.save(dst, "JPEG", quality=92)


def build_filter_complex(n: int, w: int, h: int):
    """產生 ffmpeg filter_complex:每張正規化 + xfade 交叉淡入淡出鏈。"""
    dur = SECONDS_PER_PHOTO
    trans = min(TRANSITION, dur - 0.1) if n > 1 else 0.0

    parts = []
    for i in range(n):
        # 已在 Pillow 正規化過尺寸,這裡只設 fps/sar/format,並確保長度
        parts.append(
            f"[{i}:v]fps={FPS},format=yuv420p,setsar=1,"
            f"trim=duration={dur},setpts=PTS-STARTPTS[v{i}]"
        )

    if n == 1:
        parts.append("[v0]copy[vout]")
        return ";".join(parts)

    last = "v0"
    for k in range(1, n):
        offset = k * (dur - trans)
        out = "vout" if k == n - 1 else f"x{k}"
        parts.append(
            f"[{last}][v{k}]xfade=transition=fade:duration={trans}:"
            f"offset={offset:.3f}[{out}]"
        )
        last = out
    return ";".join(parts)


def main() -> int:
    if not shutil.which("ffmpeg"):
        log("ERROR 找不到 ffmpeg,請先安裝(setup hook / apt-get install ffmpeg)")
        return 2

    if not INPUT_DIR.is_dir():
        log(f"ERROR 輸入資料夾不存在:{INPUT_DIR}")
        return 2

    try:
        w, h = (int(x) for x in RESOLUTION.lower().split("x"))
    except Exception:
        log(f"ERROR 解析度格式錯誤:{RESOLUTION}(應如 1080x1920)")
        return 2

    photos = collect_photos(INPUT_DIR)
    if not photos:
        log(f"找不到任何照片於 {INPUT_DIR}(支援:{sorted(IMG_EXTS)})。"
            f"請把寶寶照片放進去再執行。")
        return 1
    log(f"找到 {len(photos)} 張照片,解析度 {w}x{h},每張 {SECONDS_PER_PHOTO}s,"
        f"轉場 {TRANSITION}s,fit={FIT}")

    bgm = find_bgm()
    log(f"配樂:{bgm or '(無,輸出無聲影片)'}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        norm_paths = []
        for i, p in enumerate(photos):
            dst = tmp / f"f{i:04d}.jpg"
            try:
                normalize_image(p, dst, w, h)
                norm_paths.append(dst)
            except Exception as e:
                log(f"WARN 略過 {p.name}:{e}")
        if not norm_paths:
            log("ERROR 沒有任何照片正規化成功")
            return 1

        n = len(norm_paths)
        cmd = ["ffmpeg", "-y"]
        for p in norm_paths:
            cmd += ["-loop", "1", "-t", str(SECONDS_PER_PHOTO), "-i", str(p)]
        # 配樂作為最後一個 input(index n),須在輸出選項 / -map 之前
        if bgm:
            cmd += ["-i", bgm]

        fc = build_filter_complex(n, w, h)
        cmd += ["-filter_complex", fc, "-map", "[vout]"]

        if bgm:
            cmd += ["-map", f"{n}:a", "-c:a", "aac", "-b:a", "192k", "-shortest"]

        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS),
                "-movflags", "+faststart", str(OUTPUT)]

        log("執行 ffmpeg…")
        proc = subprocess.run(cmd, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, text=True)
        if proc.returncode != 0:
            log("ERROR ffmpeg 失敗:\n" + proc.stdout[-3000:])
            return proc.returncode

    size_mb = OUTPUT.stat().st_size / 1024 / 1024
    log(f"完成 ✅ {OUTPUT}({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
