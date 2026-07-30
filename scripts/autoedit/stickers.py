# -*- coding: utf-8 -*-
"""貼圖生成:用 PIL 產生透明背景的動畫貼圖幀,供 render 疊到影片上。
語意動畫(畫面演出當下那句話的意思):
  counter — 數字飆升(133→3.4萬、$10M+)
  ring    — 圓環進度跑到 N%
  loop    — 循環箭頭旋轉 + N 點依序亮起
  flow    — 卡片串流飛入 AI 晶片
  clone   — 人形複製分身滑入 AI 晶片
  text    — 關鍵字彈跳(無語意動畫時 fallback)
中文用微軟正黑粗體 msjhbd(含數字+「萬」,arial 會變豆腐);描邊用 PIL 原生 stroke。
"""
from __future__ import annotations
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_CJK = "C:/Windows/Fonts/msjhbd.ttc"    # 微軟正黑 粗體(繁中,含數字+「萬」)
FONT_NUM = "C:/Windows/Fonts/msjhbd.ttc"

SS = 2                      # supersample:先畫 2 倍再縮,邊緣才平滑
YEL, GRN, WHT = "#FFD400", "#22DD66", "#FFFFFF"
DRK = (20, 20, 20, 235)


def _ease_out(p: float) -> float:
    return 1 - (1 - p) ** 3


def fmt_num(v: float) -> str:
    if v >= 10000:
        return f"{v/10000:.1f}萬"
    return f"{int(round(v))}"


def _text_with_outline(draw, xy, text, font, fill, outline="black", ow=6, anchor="mm"):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor,
              stroke_width=ow, stroke_fill=outline)


# ───────────────── 基本(單層,非超取樣)貼圖 ─────────────────
def make_counter(spec: dict, outdir: str, fps: int = 30, canvas=(900, 300)) -> dict:
    """數字飆升(ease-out)+ 綠色上升箭頭。"""
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas
    n = max(int(round((float(spec["end"]) - float(spec["start"])) * fps)), 1)
    a, b = float(spec["from"]), float(spec["to"])
    label = spec.get("label", "")
    color = spec.get("color", YEL)
    fnum = ImageFont.truetype(FONT_NUM, 150)
    flab = ImageFont.truetype(FONT_CJK, 52)
    for i in range(n):
        p = _ease_out((i + 1) / n)
        val = a + (b - a) * p
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        ah = int(60 + 40 * p); cx = 90
        d.polygon([(cx, H // 2 - ah // 2), (cx - 34, H // 2 + ah // 2),
                   (cx + 34, H // 2 + ah // 2)], fill=GRN)
        _text_with_outline(d, (W // 2 + 40, H // 2), fmt_num(val), fnum, fill=color, ow=8)
        if label:
            _text_with_outline(d, (W // 2 + 40, H - 40), label, flab, fill="white", ow=4)
        img.save(out / f"cnt_{i:05d}.png")
    return {"pattern": str(out / "cnt_%05d.png"), "fps": fps, "w": W, "h": H, "frames": n}


def make_text(spec: dict, outdir: str, fps: int = 30, canvas=(900, 260)) -> dict:
    """關鍵字 pop-in 放大彈入。"""
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas
    n = max(int(round((float(spec["end"]) - float(spec["start"])) * fps)), 1)
    text = spec["text"]; color = spec.get("color", YEL)
    pop = max(int(0.25 * fps), 1)
    for i in range(n):
        scale = _ease_out(min((i + 1) / pop, 1.0))
        size = max(int(84 * (0.4 + 0.6 * scale)), 8)
        font = ImageFont.truetype(FONT_CJK, size)
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        _text_with_outline(d, (W // 2, H // 2), text, font, fill=color, ow=6)
        img.save(out / f"txt_{i:05d}.png")
    return {"pattern": str(out / "txt_%05d.png"), "fps": fps, "w": W, "h": H, "frames": n}


# ───────────────── 語意動畫(超取樣 + 圖示)─────────────────
def _canvas(w, h):
    img = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def _finish(img, w, h, out: Path, i: int, prefix: str):
    img = img.resize((w, h), Image.LANCZOS)
    img.save(out / f"{prefix}_{i:05d}.png")


def _chip(d, cx, cy, r, label="AI", glow=0.0):
    s = int(r * (1 + 0.08 * glow))
    d.rounded_rectangle([cx - s, cy - s, cx + s, cy + s], radius=s // 4,
                        fill=DRK, outline=YEL, width=max(4 * SS, 2))
    for k in range(-1, 2):
        off = k * s // 2
        for x0, y0, x1, y1 in (
            (cx + off - 3 * SS, cy - s - 10 * SS, cx + off + 3 * SS, cy - s),
            (cx + off - 3 * SS, cy + s, cx + off + 3 * SS, cy + s + 10 * SS),
            (cx - s - 10 * SS, cy + off - 3 * SS, cx - s, cy + off + 3 * SS),
            (cx + s, cy + off - 3 * SS, cx + s + 10 * SS, cy + off + 3 * SS)):
            d.rectangle([x0, y0, x1, y1], fill=YEL)
    f = ImageFont.truetype(FONT_NUM, int(s * 0.8))
    d.text((cx, cy), label, font=f, fill=YEL, anchor="mm")


def _person(d, cx, cy, r, color=WHT, alpha=255):
    col = color if alpha == 255 else (255, 255, 255, alpha)
    d.ellipse([cx - r * .42, cy - r, cx + r * .42, cy - r * .16], fill=col)
    d.pieslice([cx - r * .72, cy - r * .1, cx + r * .72, cy + r * 1.5],
               start=180, end=360, fill=col)


def _label(d, cx, cy, text, size=48):
    f = ImageFont.truetype(FONT_CJK, size * SS)
    d.text((cx, cy), text, font=f, fill=WHT, anchor="mm",
           stroke_width=5 * SS, stroke_fill="black")


def make_progress_ring(spec: dict, outdir: str, fps=30, canvas=(900, 300)) -> dict:
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas
    n = max(int(round((spec["end"] - spec["start"]) * fps)), 1)
    pct, label = float(spec.get("pct", 99)), spec.get("label", "")
    cx, cy, r = int(W * .26) * SS, (H // 2) * SS, int(H * .34) * SS
    for i in range(n):
        p = _ease_out((i + 1) / n)
        img, d = _canvas(W, H)
        d.arc([cx - r, cy - r, cx + r, cy + r], 0, 360, fill=(255, 255, 255, 60), width=13 * SS)
        if p > 0.01:
            d.arc([cx - r, cy - r, cx + r, cy + r], -90, -90 + 360 * (pct / 100) * p,
                  fill=YEL, width=13 * SS)
        f = ImageFont.truetype(FONT_NUM, 62 * SS)
        d.text((cx, cy), f"{int(round(pct*p))}%", font=f, fill=WHT, anchor="mm",
               stroke_width=4 * SS, stroke_fill="black")
        if label:
            _label(d, int(W * .66) * SS, cy, label, 56)
        _finish(img, W, H, out, i, "ring")
    return {"pattern": str(out / "ring_%05d.png"), "fps": fps, "w": W, "h": H, "frames": n}


def make_loop(spec: dict, outdir: str, fps=30, canvas=(900, 300)) -> dict:
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas
    n = max(int(round((spec["end"] - spec["start"]) * fps)), 1)
    cnt, label = int(spec.get("count", 6)), spec.get("label", "")
    cx, cy, r = int(W * .26) * SS, (H // 2) * SS, int(H * .32) * SS
    for i in range(n):
        p = (i + 1) / n
        img, d = _canvas(W, H)
        rot = 360 * p * 1.5
        d.arc([cx - r, cy - r, cx + r, cy + r], rot, rot + 300, fill=YEL, width=11 * SS)
        a = math.radians(rot + 300)
        ax, ay = cx + r * math.cos(a), cy + r * math.sin(a)
        d.regular_polygon((ax, ay, 15 * SS), 3, rotation=rot + 300 + 90, fill=YEL)
        lit = int(cnt * _ease_out(p) + 0.999)
        for k in range(cnt):
            ang = math.radians(-90 + k * 360 / cnt)
            px, py = cx + (r + 26 * SS) * math.cos(ang), cy + (r + 26 * SS) * math.sin(ang)
            d.ellipse([px - 8 * SS, py - 8 * SS, px + 8 * SS, py + 8 * SS],
                      fill=GRN if k < lit else (255, 255, 255, 70))
        f = ImageFont.truetype(FONT_NUM, 66 * SS)
        d.text((cx, cy), str(lit), font=f, fill=WHT, anchor="mm",
               stroke_width=4 * SS, stroke_fill="black")
        if label:
            _label(d, int(W * .66) * SS, cy, label, 56)
        _finish(img, W, H, out, i, "loop")
    return {"pattern": str(out / "loop_%05d.png"), "fps": fps, "w": W, "h": H, "frames": n}


def make_flow(spec: dict, outdir: str, fps=30, canvas=(900, 300)) -> dict:
    """卡片持續串流飛入 AI 晶片(任何一刻都看得到動態)。"""
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas
    n = max(int(round((spec["end"] - spec["start"]) * fps)), 1)
    label, items = spec.get("label", ""), int(spec.get("items", 4))
    cycles = float(spec.get("cycles", 2.5))
    tx, ty = int(W * .60) * SS, (H // 2) * SS
    sx, sy = int(W * .08) * SS, (H // 2) * SS
    for i in range(n):
        p = (i + 1) / n
        img, d = _canvas(W, H)
        for k in range(items):
            e = ((p * cycles) + k / items) % 1.0
            x = sx + (tx - sx) * e
            y = sy - 30 * SS * math.sin(e * math.pi)
            a = 255 if e < .8 else int(255 * (1 - (e - .8) / .2))
            cw, ch = int(30 * SS * (1 - .3 * e)), int(38 * SS * (1 - .3 * e))
            d.rounded_rectangle([x - cw, y - ch, x + cw, y + ch], radius=6 * SS,
                                fill=(255, 255, 255, a))
            for ln in range(3):
                yy = y - ch + (ln + 1) * ch // 2
                d.line([x - cw * .6, yy, x + cw * .6, yy], fill=(60, 60, 60, a), width=3 * SS)
        pulse = max(0.0, 1 - ((p * cycles) % (1 / items)) * items * 2)
        _chip(d, tx, ty, int(H * .3) * SS, "AI", glow=pulse)
        if label:
            _label(d, int(W * .60) * SS, int(H * .90) * SS, label, 44)
        _finish(img, W, H, out, i, "flow")
    return {"pattern": str(out / "flow_%05d.png"), "fps": fps, "w": W, "h": H, "frames": n}


def make_clone(spec: dict, outdir: str, fps=30, canvas=(900, 300)) -> dict:
    """人形持續複製分身滑向 AI 晶片。"""
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas
    n = max(int(round((spec["end"] - spec["start"]) * fps)), 1)
    label = spec.get("label", "")
    clones, cycles = int(spec.get("clones", 2)), float(spec.get("cycles", 2.5))
    px, py, r = int(W * .12) * SS, (H // 2) * SS, int(H * .26) * SS
    tx = int(W * .58) * SS
    for i in range(n):
        p = (i + 1) / n
        img, d = _canvas(W, H)
        d.line([px + r, py, tx - r, py], fill=(255, 212, 0, 90), width=5 * SS)
        _person(d, px, py, r)
        for k in range(clones):
            e = ((p * cycles) + k / clones) % 1.0
            cxp = px + (tx - px) * _ease_out(e)
            a = 255 if e < .75 else int(255 * (1 - (e - .75) / .25))
            _person(d, cxp, py, int(r * (1 - .25 * e)), alpha=a)
        pulse = max(0.0, 1 - ((p * cycles) % (1 / clones)) * clones * 2)
        _chip(d, int(W * .62) * SS, py, int(H * .26) * SS, "AI", glow=pulse)
        if label:
            _label(d, int(W * .40) * SS, int(H * .90) * SS, label, 44)
        _finish(img, W, H, out, i, "clone")
    return {"pattern": str(out / "clone_%05d.png"), "fps": fps, "w": W, "h": H, "frames": n}


def build_sticker(spec: dict, outdir: str) -> dict:
    t = spec.get("type")
    fn = {"counter": make_counter, "text": make_text, "ring": make_progress_ring,
          "loop": make_loop, "flow": make_flow, "clone": make_clone}.get(t)
    if not fn:
        raise ValueError(f"未知貼圖類型: {t}")
    return fn(spec, outdir)
