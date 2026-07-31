# -*- coding: utf-8 -*-
"""米白奢華動畫庫:折線圖(數字)/撒錢(感覺)/刪字蓋字(改變認知)/CTA。
輸出透明 PNG 序列,供疊在米白畫布上。"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

CJKB = "C:/Windows/Fonts/msjhbd.ttc"
SS = 2
GOLD = (176, 138, 74)
INK = (34, 30, 26)
MUTE = (150, 142, 128)
LINEBG = (214, 203, 184)
CREAM = (243, 238, 229)


def _cv(w, h):
    im = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def _save(im, w, h, out, i, pre):
    im.resize((w, h), Image.LANCZOS).save(out / f"{pre}_{i:05d}.png")


def _ease(p):
    return 1 - (1 - p) ** 3


def line_chart(out, dur=2.5, fps=30, canvas=(900, 430)):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    pn = [(0.02, .14), (0.20, .30), (0.38, .24), (0.56, .54), (0.74, .68), (0.96, .95)]
    P = [(x * W * SS, (H - y * H) * SS) for x, y in pn]
    for i in range(n):
        t = (i + 1) / fps
        p = _ease(min(t / 1.8, 1.0))          # 1.8 秒畫完,之後定住
        im, d = _cv(W, H)
        for k in range(4):                                  # 基準格線
            yy = (H - k * H / 3) * SS
            d.line([0, yy, W * SS, yy], fill=LINEBG + (255,), width=2 * SS)
        # 依進度畫到某點
        prog = p * (len(P) - 1)
        seg = int(prog); frac = prog - seg
        drawn = P[:seg + 1]
        if seg < len(P) - 1:
            a, b = P[seg], P[seg + 1]
            drawn = drawn + [(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac)]
        if len(drawn) >= 2:
            area = drawn + [(drawn[-1][0], H * SS), (drawn[0][0], H * SS)]
            ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
            ImageDraw.Draw(ov).polygon(area, fill=(176, 138, 74, 46))
            im.alpha_composite(ov); d = ImageDraw.Draw(im)
            d.line(drawn, fill=GOLD + (255,), width=8 * SS, joint="curve")
        for q in drawn[:-1] if seg < len(P) - 1 else drawn:
            if q in P[:seg + 1]:
                d.ellipse([q[0] - 9 * SS, q[1] - 9 * SS, q[0] + 9 * SS, q[1] + 9 * SS],
                          fill=CREAM + (255,), outline=GOLD + (255,), width=5 * SS)
        if p > .98:                                         # 末端強調 + 箭頭
            ex, ey = P[-1]
            d.ellipse([ex - 16 * SS, ey - 16 * SS, ex + 16 * SS, ey + 16 * SS], fill=GOLD + (255,))
            d.polygon([(ex + 34 * SS, ey - 46 * SS), (ex + 14 * SS, ey - 30 * SS),
                       (ex + 40 * SS, ey - 22 * SS)], fill=GOLD + (255,))
        _save(im, W, H, out, i, "chart")
    return {"pattern": str(out / "chart_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def coin_rain(out, dur=2.5, fps=30, canvas=(900, 500), coins=14):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    import random; random.seed(7)
    C = [(random.uniform(.08, .92), random.uniform(-.6, .1), random.uniform(.7, 1.3),
          random.uniform(.8, 1.2)) for _ in range(coins)]
    r0 = 30 * SS
    for i in range(n):
        p = (i + 1) / n
        im, d = _cv(W, H)
        for (cx, cy0, spd, sz) in C:
            yy = (cy0 + p * spd * 1.5) % 1.15
            x = cx * W * SS
            y = yy * H * SS
            rr = r0 * sz
            wob = abs(math.sin((p * spd * 6 + cx * 10))) * 0.7 + 0.3   # 假旋轉(寬度變化)
            d.ellipse([x - rr * wob, y - rr, x + rr * wob, y + rr],
                      fill=(198, 160, 86, 255), outline=(150, 116, 52, 255), width=3 * SS)
            if wob > .55:
                f = ImageFont.truetype(CJKB, int(rr * 1.1))
                d.text((x, y), "$", font=f, fill=(120, 92, 40, 255), anchor="mm")
        _save(im, W, H, out, i, "coin")
    return {"pattern": str(out / "coin_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def text_swap(out, old, new, dur=3.0, fps=30, canvas=(940, 300)):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    fo = ImageFont.truetype(CJKB, 76 * SS)
    for i in range(n):
        t = (i + 1) / fps                             # 絕對秒數分階段,長段落就定住新字
        im, d = _cv(W, H)
        cx, cy = W // 2 * SS, H // 2 * SS
        if t < 1.5:                                   # 舊字 + 劃線掃過 + 淡出
            fade = max(0.0, (t - 1.0) / 0.5)
            col = tuple(int(INK[k] + (MUTE[k] - INK[k]) * fade) for k in range(3))
            a = int(255 * (1 - 0.5 * fade))
            d.text((cx, cy), old, font=fo, fill=col + (a,), anchor="mm")
            tw = d.textlength(old, font=fo)
            x1 = cx - tw / 2; x2 = x1 + tw * min(t / 1.0, 1)
            d.line([x1, cy, x2, cy], fill=GOLD + (255,), width=9 * SS)
        else:                                         # 新字淡入放大,之後定住
            q = _ease(min((t - 1.5) / 0.7, 1.0))
            sc = 0.7 + 0.3 * q
            f = ImageFont.truetype(CJKB, int(84 * SS * sc))
            d.text((cx, cy), new, font=f, fill=GOLD + (int(255 * q),), anchor="mm")
        _save(im, W, H, out, i, "swap")
    return {"pattern": str(out / "swap_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def cta(out, text="留言「免費」", dur=2.2, fps=30, canvas=(760, 200)):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    f = ImageFont.truetype(CJKB, 60 * SS)
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        s = _ease(min(t / 0.4, 1.0))                 # 彈入
        pulse = 1 + 0.03 * math.sin(t * 6)           # 脈動
        cx, cy = W // 2 * SS, H // 2 * SS
        pw = (W * 0.9 * s * pulse) * SS
        ph = (H * 0.62 * s) * SS
        d.rounded_rectangle([cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2],
                            radius=ph / 2, fill=GOLD + (255,))
        if s > 0.6:
            d.text((cx, cy), text, font=f, fill=(255, 250, 244, int(255 * s)), anchor="mm")
        _save(im, W, H, out, i, "cta")
    return {"pattern": str(out / "cta_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}
