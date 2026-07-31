# -*- coding: utf-8 -*-
"""luxe 模式:米白奢華 · 上下分割 · 語意動畫 · 雙語字幕。
第一句(0~split_start)維持全屏原畫面,之後上下分割。

用 plan JSON 驅動,任何影片都能套:
{
  "video": "C:/.../src.mp4",
  "duration": 46.54,
  "split_start": 4.3,          // 第一句全屏到此秒,之後分割
  "face_bias": 0.60,           // 講者視窗垂直對臉(0上~1下)
  "beats": [
    {"start":4.3,"end":8.6,"anim":"chart","params":{},"zh":"這個月談成更多合作","en":"MORE DEALS THIS MONTH"},
    {"start":16.2,"end":20.6,"anim":"coin","params":{},"zh":"我把課程免費中文化","en":"TRANSLATED FREE"},
    {"start":24.8,"end":29.2,"anim":"swap","params":{"old":"分享=價值消失","new":"價值被放大"},"zh":"...","en":"..."},
    {"start":44.4,"end":46.5,"anim":"cta","params":{"text":"留言「免費」"},"zh":"...","en":"..."},
    {"start":8.6,"end":16.2,"anim":null,"zh":"...","en":"..."}   // 只有字幕
  ]
}

動畫類型(anim):chart(數字→上升折線)/ coin(感覺→撒錢)/ swap(改變認知→刪舊蓋新)/ cta / null。
"""
from __future__ import annotations
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).parent))
import luxe_anim as L  # noqa: E402

CJKB = "C:/Windows/Fonts/msjhbd.ttc"
LAT = "C:/Windows/Fonts/arialbd.ttf"
CREAM_HEX = "0xF3EEE5"
INK = (34, 30, 26); MUTE = (150, 142, 128); GOLD = (176, 138, 74)
ANIM_Y = {"chart": 250, "coin": 210, "swap": 320, "cta": 440}
ANIM_FN = {"chart": "line_chart", "coin": "coin_rain", "swap": "text_swap", "cta": "cta"}


def _ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    base = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    for hit in base.rglob("ffmpeg.exe"):
        return str(hit)
    sys.exit("找不到 ffmpeg")


FFMPEG = _ffmpeg()


def _run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if r.returncode:
        raise SystemExit("ffmpeg 失敗:\n" + r.stderr.decode("utf-8", "replace")[-1200:])


def _mask_border(wk: Path):
    m = Image.new("L", (1000, 810), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 1000, 810], radius=40, fill=255)
    m.save(wk / "mask.png")
    b = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    ImageDraw.Draw(b).rounded_rectangle([40, 1070, 1040, 1880], radius=40,
                                        outline=GOLD + (255,), width=4)
    b.save(wk / "border.png")


def _sub_png(zh, en, path):
    im = Image.new("RGBA", (1080, 175), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((540, 48), zh, font=ImageFont.truetype(CJKB, 52), fill=INK + (255,), anchor="mm")
    d.text((540, 112), "  ".join(en), font=ImageFont.truetype(LAT, 26),
           fill=MUTE + (255,), anchor="mm")
    im.save(path)


def render_luxe(plan_path: str, output: str) -> None:
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    video = plan["video"]; dur = float(plan["duration"])
    t1 = float(plan.get("split_start", 4.3)); bias = float(plan.get("face_bias", 0.60))
    wk = Path(tempfile.mkdtemp(prefix="luxe_")); _mask_border(wk)

    # 1) partA 全屏原畫面
    print("[luxe] partA 全屏第一句 ...")
    _run([FFMPEG, "-y", "-i", video, "-t", str(t1),
          "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
          "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
          "-preset", "veryfast", "-c:a", "aac", "-ar", "48000", "-ac", "2", str(wk / "A.mp4")])
    # 2) partB 米白上下分割
    print("[luxe] partB 上下分割 ...")
    _run([FFMPEG, "-y", "-ss", str(t1), "-i", video,
          "-f", "lavfi", "-i", f"color=c={CREAM_HEX}:s=1080x1920:r=30",
          "-i", str(wk / "mask.png"),
          "-filter_complex",
          f"[0:v]crop=iw:ih*0.88:0:0,scale=1000:-1,crop=1000:810:0:(ih-810)*{bias},setsar=1[spk];"
          f"[spk]format=rgba[sr];[sr][2:v]alphamerge[sm];[1:v][sm]overlay=40:1070[bg]",
          "-map", "[bg]", "-map", "0:a", "-shortest", "-r", "30", "-c:v", "libx264",
          "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "veryfast",
          "-c:a", "aac", "-ar", "48000", "-ac", "2", str(wk / "B.mp4")])
    # 3) concat
    (wk / "c.txt").write_text("file 'A.mp4'\nfile 'B.mp4'\n", encoding="utf-8")
    _run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(wk / "c.txt"),
          "-c", "copy", str(wk / "base.mp4")])

    # 4) 疊 金框 + 動畫 + 雙語字幕
    print("[luxe] 合成動畫+字幕 ...")
    inputs = ["-i", str(wk / "base.mp4"), "-loop", "1", "-i", str(wk / "border.png")]
    filt = ["[0:v]null[v0]", f"[v0][1:v]overlay=0:0:enable='between(t,{t1},{dur})'[v1]"]
    base = "[v1]"; idx = 2; n = 2
    for bi, bt in enumerate(plan["beats"]):
        s, e = float(bt["start"]), float(bt["end"]); anim = bt.get("anim")
        if anim:
            info = getattr(L, ANIM_FN[anim])(str(wk / f"a{bi}"),
                                             **{"dur": e - s, **bt.get("params", {})})
            inputs += ["-framerate", str(info["fps"]), "-i", info["pattern"]]
            x = (1080 - info["w"]) // 2; y = ANIM_Y[anim]
            filt.append(f"[{idx}:v]setpts=PTS-STARTPTS+{s}/TB[an{idx}]")
            filt.append(f"{base}[an{idx}]overlay={x}:{y}:enable='between(t,{s},{e})'[v{n}]")
            base = f"[v{n}]"; n += 1; idx += 1
        sp = wk / f"s{bi}.png"; _sub_png(bt.get("zh", ""), bt.get("en", ""), sp)
        inputs += ["-loop", "1", "-i", str(sp)]
        filt.append(f"{base}[{idx}:v]overlay=0:885:enable='between(t,{s},{e})'[v{n}]")
        base = f"[v{n}]"; n += 1; idx += 1

    _run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filt),
          "-map", base, "-map", "0:a?", "-t", f"{dur}",
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
          "-preset", "veryfast", "-c:a", "aac", output])
    print(f"\n✅ luxe 成品輸出: {output}")


if __name__ == "__main__":
    render_luxe(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "luxe_out.mp4")
