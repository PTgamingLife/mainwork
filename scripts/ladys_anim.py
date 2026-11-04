"""LadyS 卡片動畫產生器(APNG,配色 B,扁平風)。
用法:python scripts/ladys_anim.py  → 輸出到 ladys/anim/
- 4 張橫幅 hero(720x240,3:1):morning / night / update / menu
- 6 個大圓圖示(240x240,透明底、白色線條):calendar / list / money / goals / todos / settings
LINE 動畫圖限制:APNG、單檔 ≤ 300KB,這裡會自動檢查。
"""
import math
import os
import sys

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "ladys", "anim")
SS = 2  # 先畫 2 倍再縮小 → 反鋸齒
C = {
    "husband": (108, 142, 191), "wife": (212, 165, 165), "both": (154, 143, 176),
    "bg": (245, 245, 247), "ink": (46, 46, 51), "white": (255, 255, 255),
    "sky": (220, 230, 243), "night1": (46, 46, 51), "night2": (70, 66, 96),
}
FRAMES, FPS = 24, 12  # 2 秒循環


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def canvas(w, h, top=None, bottom=None):
    if top is None:
        return Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    im = Image.new("RGBA", (w * SS, h * SS))
    d = ImageDraw.Draw(im)
    for y in range(h * SS):
        d.line([(0, y), (w * SS, y)], fill=lerp(top, bottom, y / (h * SS)) + (255,))
    return im


def circ(d, x, y, r, fill=None, outline=None, width=0):
    d.ellipse([(x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS], fill=fill, outline=outline, width=width * SS)


def line(d, pts, fill, width):
    d.line([(x * SS, y * SS) for x, y in pts], fill=fill, width=width * SS, joint="curve")
    for x, y in (pts[0], pts[-1]):
        circ(d, x, y, width / 2, fill=fill)


def rrect(d, box, r, fill=None, outline=None, width=0):
    d.rounded_rectangle([v * SS for v in box], radius=r * SS, fill=fill, outline=outline, width=width * SS)


def cloud(d, x, y, s, fill):
    for dx, dy, r in ((0, 0, 22), (24, -10, 26), (50, 0, 20), (25, 8, 22)):
        circ(d, x + dx * s, y + dy * s, r * s, fill=fill)


def star(d, x, y, r, fill):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.35
        pts.append(((x + rr * math.cos(a)) * SS, (y + rr * math.sin(a)) * SS))
    d.polygon(pts, fill=fill)


# ---------- 橫幅 ----------
def hero_morning(t):
    im = canvas(720, 240, C["sky"], C["bg"])
    d = ImageDraw.Draw(im)
    sy = 175 - 75 * (0.5 - 0.5 * math.cos(2 * math.pi * t))  # 緩緩升起再落下,首尾銜接
    for k, a in ((70, 40), (52, 90)):
        circ(d, 360, sy, k, fill=C["wife"] + (a,))
    circ(d, 360, sy, 40, fill=(232, 178, 150, 255))
    for i, (bx, by, s) in enumerate(((90, 70, 1.0), (540, 55, 0.8), (300, 150, 0.7))):
        x = (bx + 720 * t * (0.6 + 0.2 * i)) % 860 - 80
        cloud(d, x, by, s, C["white"] + (235,))
    d.rectangle([0, 205 * SS, 720 * SS, 240 * SS], fill=C["bg"] + (255,))
    return im


def hero_night(t):
    im = canvas(720, 240, C["night1"], C["night2"])
    d = ImageDraw.Draw(im)
    for i, (x, y, r) in enumerate(((80, 50, 7), (170, 120, 5), (260, 40, 6), (470, 70, 8), (560, 150, 5),
                                   (640, 45, 6), (120, 180, 4), (600, 200, 4), (330, 190, 5))):
        a = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(2 * math.pi * (t + i / 9)))
        star(d, x, y, r * (0.8 + 0.4 * a), C["white"] + (int(255 * a),))
    my = 120 + 6 * math.sin(2 * math.pi * t)
    circ(d, 360, my, 60, fill=C["bg"] + (40,))
    circ(d, 360, my, 46, fill=(245, 236, 210, 255))
    circ(d, 382, my - 12, 44, fill=lerp(C["night1"], C["night2"], my / 240) + (255,))
    return im


def hero_update(t):
    im = canvas(720, 240, C["bg"], C["sky"])
    d = ImageDraw.Draw(im)
    circ(d, 360, 120, 78, fill=C["husband"] + (255,))
    p = ease(min(1, t * 2.2))
    a, b, c = (322, 122), (350, 152), (402, 92)
    if p > 0:
        if p < 0.4:
            q = p / 0.4
            line(d, [a, (a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q)], C["white"], 14)
        else:
            q = (p - 0.4) / 0.6
            line(d, [a, b, (b[0] + (c[0] - b[0]) * q, b[1] + (c[1] - b[1]) * q)], C["white"], 14)
    for i, (x, y) in enumerate(((240, 60), (480, 60), (220, 170), (500, 180), (300, 30), (430, 210))):
        s = max(0.0, math.sin(math.pi * ((t * 2 - 0.45 - i * 0.08) % 2)))
        if s > 0:
            star(d, x, y, 14 * s, (C["wife"] if i % 2 else C["both"]) + (255,))
    return im


def hero_menu(t):
    im = canvas(720, 240, C["bg"], C["sky"])
    d = ImageDraw.Draw(im)
    cols = (C["husband"], C["wife"], C["both"])
    for i in range(12):
        x = 40 + i * 60 + 12 * math.sin(2 * math.pi * (t + i / 5))
        y = 260 - ((t + (i * 7 % 12) / 12) % 1) * 300
        r = 10 + (i * 7) % 18
        circ(d, x, y, r, fill=cols[i % 3] + (170,))
        circ(d, x - r * 0.35, y - r * 0.35, r * 0.25, fill=C["white"] + (160,))
    return im


# ---------- 大圓圖示(白色) ----------
W = C["white"] + (255,)


def icon_calendar(t):
    im = canvas(240, 240)
    d = ImageDraw.Draw(im)
    rrect(d, (40, 50, 200, 200), 18, outline=W, width=10)
    d.rectangle([40 * SS, 50 * SS, 200 * SS, 92 * SS], fill=W)
    for x in (80, 160):
        line(d, [(x, 32), (x, 64)], W, 10)
    flip = abs(math.cos(math.pi * ease(t)))  # 翻頁:頁面上下壓扁再展開
    h = 80 * flip
    rrect(d, (66, 146 - h / 2 + 2, 174, 146 + h / 2 + 2), 8, fill=C["white"] + (int(110 + 145 * flip),))
    return im


def icon_list(t):
    im = canvas(240, 240)
    d = ImageDraw.Draw(im)
    for i, y in enumerate((70, 120, 170)):
        rrect(d, (40, y - 16, 72, y + 16), 7, outline=W, width=7)
        line(d, [(92, y), (200, y)], W, 10)
        if t * 4 > i + 0.5:
            line(d, [(46, y), (55, y + 9), (70, y - 12)], W, 7)
    return im


def icon_money(t):
    im = canvas(240, 240)
    d = ImageDraw.Draw(im)
    h = abs(math.sin(math.pi * t * 2))  # 彈兩下
    y = 150 - 60 * h
    sq = 1 - 0.15 * (1 - h) ** 6
    d.ellipse([80 * SS, 196 * SS, 160 * SS, 210 * SS], fill=C["white"] + (int(60 + 80 * (1 - h)),))
    d.ellipse([(120 - 52 / sq) * SS, (y - 52 * sq) * SS, (120 + 52 / sq) * SS, (y + 52 * sq) * SS], outline=W, width=10 * SS)
    d.text((0, 0), "")
    line(d, [(140, y - 22), (104, y - 22), (104, y), (136, y), (136, y + 22), (100, y + 22)], W, 9)
    line(d, [(120, y - 38), (120, y + 38)], W, 7)
    return im


def icon_goals(t):
    im = canvas(240, 240)
    d = ImageDraw.Draw(im)
    p = ease(min(1, t * 2.5))
    shake = 4 * math.sin(t * 60) * max(0, 1 - (t - 0.4) * 4) if t > 0.4 else 0
    cx = 110 + shake
    for r in (78, 52, 26):
        circ(d, cx, 125, r, outline=W, width=9)
    circ(d, cx, 125, 9, fill=W)
    tip = (cx + 200 * (1 - p), 125 - 80 * (1 - p))
    tail = (tip[0] + 78, tip[1] - 32)
    line(d, [tip, tail], W, 8)
    for dy in (-14, 14):
        line(d, [(tail[0] - 4, tail[1]), (tail[0] + 14, tail[1] + dy - 6)], W, 6)
    return im


def icon_todos(t):
    im = canvas(240, 240)
    d = ImageDraw.Draw(im)
    rrect(d, (50, 50, 190, 190), 26, outline=W, width=11)
    p = ease(min(1, t * 2))
    a, b, c = (80, 122), (110, 152), (162, 92)
    if p < 0.4:
        line(d, [a, (a[0] + (b[0] - a[0]) * p / 0.4, a[1] + (b[1] - a[1]) * p / 0.4)], W, 13)
    else:
        q = (p - 0.4) / 0.6
        line(d, [a, b, (b[0] + (c[0] - b[0]) * q, b[1] + (c[1] - b[1]) * q)], W, 13)
    return im


def icon_settings(t):
    im = canvas(240, 240)
    d = ImageDraw.Draw(im)
    rot = 2 * math.pi * t / 8  # 8 齒 → 轉 1/8 圈即無縫循環
    pts = []
    for i in range(48):
        a = rot + 2 * math.pi * i / 48
        r = 84 if (i % 6) in (0, 1, 2) else 64
        pts.append(((120 + r * math.cos(a)) * SS, (120 + r * math.sin(a)) * SS))
    d.polygon(pts, fill=W)
    circ(d, 120, 120, 26, fill=(0, 0, 0, 0))
    return im


def render(name, fn, size):
    frames = [fn(i / FRAMES).resize(size, Image.LANCZOS) for i in range(FRAMES)]
    if name.startswith("hero"):  # 不透明橫幅:全部影格共用一組 64 色調色盤,檔案小很多
        rgb = [f.convert("RGB") for f in frames]
        sheet = Image.new("RGB", (size[0], size[1] * 4))
        for k in range(4):
            sheet.paste(rgb[k * FRAMES // 4], (0, size[1] * k))
        pal = sheet.quantize(64, method=Image.Quantize.MEDIANCUT)
        frames = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in rgb]
    path = os.path.join(OUT, f"{name}.png")
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=int(1000 / FPS), loop=0,
                   optimize=True, disposal=0 if name.startswith("hero") else 1, blend=0)
    kb = os.path.getsize(path) / 1024
    print(f"{name}.png {kb:.0f}KB" + ("  ⚠ 超過 300KB" if kb > 300 else ""))
    return kb <= 300


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ok = True
    for n, f in (("hero-morning", hero_morning), ("hero-night", hero_night), ("hero-update", hero_update), ("hero-menu", hero_menu)):
        ok &= render(n, f, (720, 240))
    for n, f in (("icon-calendar", icon_calendar), ("icon-list", icon_list), ("icon-money", icon_money),
                 ("icon-goals", icon_goals), ("icon-todos", icon_todos), ("icon-settings", icon_settings)):
        ok &= render(n, f, (240, 240))
    sys.exit(0 if ok else 1)
