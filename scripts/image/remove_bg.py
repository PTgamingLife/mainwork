"""通用去背工具(合併原本 remove_bg / remove_bg_ai / remove_bg_v2 三支一次性腳本)。

用法:
  python scripts/image/remove_bg.py <檔案或資料夾...> [--mode flood|ai|ai-green] [--out DIR] [--threshold 25]

  flood    : 從四角洪水填充,把與角落相連的白底改透明(不需額外套件,適合純白底插圖)
  ai       : rembg 模型去背(pip install rembg)
  ai-green : 先把白底圖貼到綠底再給 rembg,白色輪廓的角色(例如白色機器人)比較不會被吃掉
未指定 --out 時直接覆寫原檔。
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

from PIL import Image

RB_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def rb_flood(img: Image.Image, threshold: int) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = max(corners, key=lambda c: c[0] + c[1] + c[2])
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seen: set[tuple[int, int]] = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        r, g, b, _ = px[x, y]
        if abs(r - bg[0]) <= threshold and abs(g - bg[1]) <= threshold and abs(b - bg[2]) <= threshold:
            px[x, y] = (r, g, b, 0)
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return img


def rb_ai(img: Image.Image, green: bool) -> Image.Image:
    try:
        from rembg import remove
    except ImportError:
        sys.exit("需要 rembg:pip install rembg")
    src = img.convert("RGBA")
    if green:
        base = Image.new("RGBA", src.size, (0, 220, 80, 255))
        base.paste(src, mask=src.split()[3])
        src = base
    buf = io.BytesIO()
    src.save(buf, format="PNG")
    return Image.open(io.BytesIO(remove(buf.getvalue()))).convert("RGBA")


def rb_collect(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for p in map(Path, paths):
        if p.is_dir():
            files += sorted(f for f in p.iterdir() if f.suffix.lower() in RB_EXTS)
        elif p.suffix.lower() in RB_EXTS:
            files.append(p)
        else:
            print(f"SKIP: {p}")
    return files


def main() -> None:
    ap = argparse.ArgumentParser(description="圖片去背")
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--mode", choices=["flood", "ai", "ai-green"], default="flood")
    ap.add_argument("--out", help="輸出資料夾(省略則覆寫原檔)")
    ap.add_argument("--threshold", type=int, default=25, help="flood 模式的白色容忍度")
    a = ap.parse_args()

    out_dir = Path(a.out) if a.out else None
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
    for f in rb_collect(a.inputs):
        img = Image.open(f)
        res = rb_flood(img, a.threshold) if a.mode == "flood" else rb_ai(img, a.mode == "ai-green")
        dst = (out_dir / f.with_suffix(".png").name) if out_dir else f.with_suffix(".png")
        res.save(dst)
        print(f"OK: {f.name} -> {dst}  {res.size}")


if __name__ == "__main__":
    main()
