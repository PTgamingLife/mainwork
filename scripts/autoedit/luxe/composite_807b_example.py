# -*- coding: utf-8 -*-
"""807b 米白奢華重新設計 — 組合:底層 + 動畫 + 雙語字幕 + 金框 + CTA。"""
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, r"C:/Users/nancy/AppData/Local/Temp/claude/C--Users-nancy-OneDrive----AI-use-claudeskill-code/d3cfa784-0b75-4172-bd86-8706a5f9c6bb/scratchpad")
import luxe_anim as L

FFMPEG = r"C:/Users/nancy/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe"
A = Path(r"C:/Users/nancy/Downloads/807b_edit")
WK = A / "work"; WK.mkdir(exist_ok=True)
CJKB = "C:/Windows/Fonts/msjhbd.ttc"
LAT = "C:/Windows/Fonts/arialbd.ttf"
INK = (34, 30, 26); MUTE = (150, 142, 128)
DUR = 46.54

# (start, end, anim, params, zh, en)
beats = [
    (4.3, 8.6, "chart", {}, "這個月談成更多合作", "MORE DEALS THIS MONTH"),
    (8.6, 16.2, None, {}, "精華課程幾乎都是英文", "THE BEST COURSES ARE IN ENGLISH"),
    (16.2, 20.6, "coin", {}, "我把課程免費中文化", "TRANSLATED FREE INTO CHINESE"),
    (20.6, 24.8, None, {}, "分享後接觸更多合作", "SHARING OPENED MORE DOORS"),
    (24.8, 29.2, "swap", {"old": "分享=價值消失", "new": "價值被放大"}, "怕分享讓價值消失?", "AFRAID SHARING KILLS VALUE?"),
    (29.2, 34.0, "swap", {"old": "才華交付不出去", "new": "才華被放大"}, "AI 放大你的才華", "AI AMPLIFIES YOUR TALENT"),
    (34.0, 40.7, "swap", {"old": "AI 取代你", "new": "AI 放大你"}, "AI 不是取代,是放大你", "IT AMPLIFIES, NOT REPLACES"),
    (40.7, 44.4, None, {}, "想用 AI 放大收入?", "WANT TO SCALE WITH AI?"),
    (44.4, DUR, "cta", {"text": "留言「免費」"}, "留言領免費中文課", "COMMENT FOR THE FREE COURSE"),
]

ANIM_Y = {"chart": 250, "coin": 210, "swap": 320, "cta": 440}


def make_sub(zh, en, path):
    W, H = 1080, 175
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fz = ImageFont.truetype(CJKB, 52)
    d.text((W // 2, 48), zh, font=fz, fill=INK + (255,), anchor="mm")
    fe = ImageFont.truetype(LAT, 26)
    d.text((W // 2, 112), "  ".join(en), font=fe, fill=MUTE + (255,), anchor="mm")
    im.save(path)


inputs = ["-i", str(A / "base.mp4"), "-loop", "1", "-i", str(A / "border.png")]
filt = [f"[0:v]null[v0]"]
# 金框(分割段全程)
filt.append(f"[v0][1:v]overlay=0:0:enable='between(t,4.3,{DUR})'[v1]")
base = "[v1]"; idx = 2; n = 2

for bi, (s, e, anim, prm, zh, en) in enumerate(beats):
    # 動畫
    if anim:
        info = getattr(L, {"chart": "line_chart", "coin": "coin_rain",
                           "swap": "text_swap", "cta": "cta"}[anim])(
            str(WK / f"a{bi}"), **({"dur": e - s, **prm}))
        inputs += ["-framerate", str(info["fps"]), "-i", info["pattern"]]
        w, h = info["w"], info["h"]; x = (1080 - w) // 2; y = ANIM_Y[anim]
        filt.append(f"[{idx}:v]setpts=PTS-STARTPTS+{s}/TB[an{idx}]")
        filt.append(f"{base}[an{idx}]overlay={x}:{y}:enable='between(t,{s},{e})'[v{n}]")
        base = f"[v{n}]"; n += 1; idx += 1
    # 字幕
    sp = WK / f"sub{bi}.png"; make_sub(zh, en, sp)
    inputs += ["-loop", "1", "-i", str(sp)]
    filt.append(f"{base}[{idx}:v]overlay=0:885:enable='between(t,{s},{e})'[v{n}]")
    base = f"[v{n}]"; n += 1; idx += 1

filt_str = ";".join(filt)
(WK / "filter.txt").write_text(filt_str, encoding="utf-8")
cmd = [FFMPEG, "-y", *inputs, "-filter_complex", filt_str,
       "-map", base, "-map", "0:a?", "-t", f"{DUR}",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
       "-preset", "veryfast", "-c:a", "aac", str(A / "807b_成品.mp4")]
print(f"inputs={len(inputs)//2} filters={len(filt)}")
r = subprocess.run(cmd, capture_output=True, text=True)
print("RC", r.returncode)
if r.returncode:
    print(r.stderr[-1500:])
else:
    print("OK", A / "807b_成品.mp4")
