# -*- coding: utf-8 -*-
"""像素風角色素材庫 + 小劇場動畫(全動畫無真人 · Case #4 風格)。
sprite = 網格字串;draw_sprite 放大成色塊。scene_* 產出 PNG 序列 → mp4。
"""
from __future__ import annotations
import os
import shutil
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

CJKB = "C:/Windows/Fonts/msjhbd.ttc"
DARK = (24, 23, 27)
GREEN = (74, 122, 78)
CORAL = (217, 119, 87)
GOLD = (214, 170, 92)
WHT = (240, 235, 228)
STAR = (60, 58, 66)

PAL = {".": None, "H": (46, 34, 28), "S": (232, 197, 165), "g": (250, 250, 250),
       "D": (35, 40, 45), "L": (60, 55, 70), "K": (18, 17, 19), "W": (240, 235, 228),
       "C": CORAL, "c": (150, 80, 60), "G": GREEN}

BOSS = ["...HHHHHH...", "..HHHHHHHH..", ".HHSSSSSSHH.", ".HSSSSSSSSH.",
        ".SDgDSSDgDS.", ".SSSSSSSSSS.", "..SSKKKKSS..", "...SSSSSS...",
        "..GGGGGGGG..", ".GGGGGGGGGG.", "SGGGWWWWGGGS", ".GGGGGGGGGG.",
        ".GGGGGGGGGG.", ".LLLL..LLLL.", ".LLLL..LLLL."]
ROBOT = ["..CCCCCCCC..", ".CCCCCCCCCC.", "CCCCCCCCCCCC", "CCKKCCCCKKCC",
         "CCKKCCCCKKCC", "CCCCCCCCCCCC", "CCCCcccCCCCC", "CCCCCCCCCCCC",
         "CC.CC..CC.CC", "CC.CC..CC.CC"]
# 小路人(*=衣服色,由 shirt 參數決定)
SMALL = [".HHH.", ".SSS.", "*****", ".***.", ".L.L."]


def draw_sprite(d, grid, ox, oy, px, pal=PAL, shirt=None):
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            col = shirt if (ch == "*" and shirt) else pal.get(ch)
            if col:
                d.rectangle([ox + c*px, oy + r*px, ox + c*px + px - 1, oy + r*px + px - 1], fill=col)


def _stars(d, W, H, seed=3):
    import random
    r = random.Random(seed)
    for _ in range(70):
        x, y = r.randint(0, W), r.randint(0, H)
        d.point((x, y), fill=STAR); d.point((x+1, y), fill=STAR)


def _ease(p):
    return 1 - (1 - p) ** 3


def scene_cliff(outdir, dur=4.0, fps=30, W=1080, H=1920):
    """3秒略過:小人走到懸崖邊掉下去,留下的看到「繼續看的理由」。"""
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    n = max(int(dur * fps), 1)
    ledge_y = int(H * 0.60)
    edge_x = int(W * 0.56)
    fbig = ImageFont.truetype(CJKB, 60)
    fsm = ImageFont.truetype(CJKB, 40)
    shirts = [(90, 120, 190), (200, 150, 70), (150, 90, 160), CORAL]
    for i in range(n):
        t = (i + 1) / fps
        img = Image.new("RGB", (W, H), DARK); d = ImageDraw.Draw(img)
        _stars(d, W, H)
        # 標題
        d.text((W//2, 200), "3 秒內", font=fbig, fill=GOLD, anchor="mm")
        d.text((W//2, 275), "給人繼續看下去的動機", font=fsm, fill=WHT, anchor="mm")
        # 左高台 + 懸崖 + 下層
        d.rectangle([0, ledge_y, edge_x, ledge_y+8], fill=GREEN)
        d.rectangle([0, ledge_y+8, edge_x, H], fill=(20, 19, 23))
        d.rectangle([edge_x, ledge_y+8, edge_x+6, H], fill=CORAL)   # 紅色斷崖邊
        d.rectangle([edge_x, int(H*0.72), W, int(H*0.72)+8], fill=GREEN)  # 下層(留下的)
        d.rectangle([edge_x, int(H*0.72)+8, W, H], fill=(20, 19, 23))
        # 木牌「繼續看的理由」
        sx = int(W*0.72)
        d.rectangle([sx-140, int(H*0.72)-90, sx+140, int(H*0.72)-30], fill=(120, 85, 55))
        d.text((sx, int(H*0.72)-60), "繼續看的理由", font=ImageFont.truetype(CJKB, 30), fill=WHT, anchor="mm")
        # 老闆站在左邊看
        draw_sprite(d, BOSS, 90, ledge_y - 15*10, 10)
        # 4 個小人往右移;最前面那個走過崖邊墜落
        px = 10
        for k in range(4):
            base_x = 330 + k*90 + int(_ease(min(t/2.2, 1)) * 60)
            if k == 3:   # 領頭的:2.2s 後走過邊緣墜落
                fall = max(0, (t - 2.2) / 1.2)
                if fall > 0:
                    fx = edge_x + int(fall * 120)
                    fy = ledge_y - 5*px + int(_ease(min(fall, 1)) * (H*0.35))
                    draw_sprite(d, SMALL, fx, fy, px, shirt=shirts[k])
                    if fall < 0.4:
                        d.text((fx+40, fy-30), "3秒!", font=fsm, fill=CORAL, anchor="mm")
                    continue
            bob = int(abs(((t*3 + k) % 1) - 0.5) * 8)
            draw_sprite(d, SMALL, base_x, ledge_y - 5*px - bob, px, shirt=shirts[k])
        # 珊瑚機器人站下層(留下的)
        draw_sprite(d, ROBOT, int(W*0.72)-60, int(H*0.72) - 10*10, 10)
        img.save(out / f"px_{i:05d}.png")
    return {"dir": str(out), "pattern": str(out / "px_%05d.png"), "fps": fps, "frames": n}


def _ffmpeg():
    e = shutil.which("ffmpeg")
    if e:
        return e
    base = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    for h in base.rglob("ffmpeg.exe"):
        return str(h)
    sys.exit("no ffmpeg")


def render_scene_mp4(scene_fn, output, **kw):
    info = scene_fn(str(Path(output).with_suffix("")) + "_frames", **kw)
    subprocess.run([_ffmpeg(), "-y", "-framerate", str(info["fps"]), "-i", info["pattern"],
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", output],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"OK {output}")


if __name__ == "__main__":
    render_scene_mp4(scene_cliff, sys.argv[1] if len(sys.argv) > 1 else "cliff.mp4")
