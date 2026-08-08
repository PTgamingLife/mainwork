# -*- coding: utf-8 -*-
"""PoC:HTML+GSAP 場景 → Playwright 無頭 Chrome 逐幀截圖 → FFmpeg 出 mp4。"""
import os
import shutil
import subprocess
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(sys.argv[1] if len(sys.argv) > 1 else "chart_gsap.html").resolve()
OUT = sys.argv[2] if len(sys.argv) > 2 else "chart_gsap.mp4"
FPS = 30
W, H = 1080, 1920
frames_dir = HTML.parent / "_frames"
if frames_dir.exists():
    shutil.rmtree(frames_dir)
frames_dir.mkdir()


def ffmpeg():
    e = shutil.which("ffmpeg")
    if e:
        return e
    base = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    return next(str(p) for p in base.rglob("ffmpeg.exe"))


with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    pg.goto(HTML.as_uri())
    pg.wait_for_function("window.seek && window.__dur")
    dur = pg.evaluate("window.__dur")
    n = int(dur * FPS) + 6                      # 尾巴多留幾幀定住
    print(f"duration={dur:.2f}s  frames={n}")
    for i in range(n):
        pg.evaluate("(t)=>window.seek(t)", i / FPS)
        pg.screenshot(path=str(frames_dir / f"f_{i:05d}.png"))
    b.close()

subprocess.run([ffmpeg(), "-y", "-framerate", str(FPS), "-i", str(frames_dir / "f_%05d.png"),
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", OUT],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("OK", OUT)
