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


# ═════════ 深色珊瑚主題(Case #3:App-UI mockup / 標題卡 / 吉祥物)═════════
DARK = (18, 17, 19)
PANEL = (30, 29, 33)
CORAL = (217, 119, 87)      # Claude 品牌色 #D97757
WHT2 = (245, 242, 238)
MUTE2 = (140, 138, 142)
GREEN = (86, 196, 130)
LINE2 = (48, 46, 52)


def mascot(d, cx, cy, s, col=CORAL):
    """Claude 像素吉祥物(橘色方頭機器人)。"""
    u = s / 6
    d.rounded_rectangle([cx - 3*u, cy - 3*u, cx + 3*u, cy + 1.6*u], radius=u*0.7, fill=col)
    for ex in (-1.4, 1.4):                                   # 眼睛
        d.line([cx + ex*u, cy - 1.4*u, cx + ex*u, cy - 0.2*u], fill=DARK, width=int(u*0.9))
    for lx in (-2, 0, 2):                                    # 腳
        d.rectangle([cx + lx*u - u*0.4, cy + 1.6*u, cx + lx*u + u*0.4, cy + 3*u], fill=col)


def app_ui(out, outdir=None, dur=4.5, fps=30, canvas=(920, 560), files=None):
    """擬真 Claude Code agent 面板:逐列出現的檔案 diff。"""
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    files = files or [("components/LoginForm.tsx", 86, 4),
                      ("api/auth.ts", 52, 8), ("styles/login.css", 31, 2)]
    fh = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 26*SS)
    fs = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 22*SS)
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        d.rounded_rectangle([0, 0, W*SS, H*SS], radius=24*SS, fill=PANEL+(255,), outline=LINE2+(255,), width=2*SS)
        d.ellipse([34*SS-7*SS, 42*SS-7*SS, 34*SS+7*SS, 42*SS+7*SS], fill=CORAL+(255,))
        d.text((58*SS, 42*SS), "Agent · Autonomous run", font=fs, fill=WHT2+(255,), anchor="lm")
        d.text((34*SS, 96*SS), "▸ REVIEWING", font=fs, fill=CORAL+(255,), anchor="lm")
        y0 = 150*SS
        for k, (name, add, sub) in enumerate(files):
            appear = _ease(min(max(t - 0.5 - k*0.7, 0)/0.5, 1))  # 逐列彈入
            if appear <= 0:
                continue
            yy = y0 + k*82*SS + int((1-appear)*20*SS)
            a = int(255*appear)
            d.rounded_rectangle([28*SS, yy-6*SS, W*SS-28*SS, yy+56*SS], radius=10*SS, fill=(40,39,44,a))
            # 綠勾
            cx = 58*SS; cyy = yy+25*SS
            d.line([cx-8*SS, cyy, cx-2*SS, cyy+7*SS], fill=GREEN+(a,), width=5*SS)
            d.line([cx-2*SS, cyy+7*SS, cx+9*SS, cyy-7*SS], fill=GREEN+(a,), width=5*SS)
            d.text((92*SS, cyy), name, font=fh, fill=WHT2+(a,), anchor="lm")
            d.text((W*SS-160*SS, cyy), f"+{add}", font=fh, fill=GREEN+(a,), anchor="lm")
            d.text((W*SS-70*SS, cyy), f"-{sub}", font=fh, fill=CORAL+(a,), anchor="lm")
        _save(im, W, H, out, i, "ui")
    return {"pattern": str(out / "ui_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def title_card(out, outdir=None, label="SKILL 1", ghost="Find Skills", main="第一個 Find Skills",
               dur=3.0, fps=30, canvas=(940, 460)):
    """動態字標題卡:小珊瑚標籤 + 大 ghost 疊影 + 粗體主標。"""
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    flab = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 34*SS)
    fgh = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 130*SS)
    fmn = ImageFont.truetype(CJKB, 68*SS)
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        cx = W*SS//2
        d.text((cx, 70*SS), "  ".join(label), font=flab, fill=CORAL+(255,), anchor="mm")
        gy = 235*SS - int(_ease(min(t/0.6,1))*20*SS)
        ga = int(70*_ease(min(t/0.6,1)))
        d.text((cx, gy), ghost, font=fgh, fill=WHT2+(ga,), anchor="mm")   # ghost 疊影
        ma = int(255*_ease(min(max(t-0.3,0)/0.6,1)))
        d.text((cx, 300*SS), main, font=fmn, fill=WHT2+(ma,), anchor="mm")
        _save(im, W, H, out, i, "title")
    return {"pattern": str(out / "title_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


# ═════════ 6 組程式動畫(深色珊瑚):FREE / 英文單字群 / 雙logo / 課程清單 ═════════
def free_card(out, outdir=None, dur=2.0, fps=30, canvas=(900, 440)):
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    fbig = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 200 * SS)
    fsub = ImageFont.truetype(CJKB, 56 * SS)
    for i in range(n):
        t = (i + 1) / fps
        s = _ease(min(t / 0.35, 1.0))
        im, d = _cv(W, H)
        cx, cy = W * SS // 2, int(H * 0.42) * SS
        for k in range(12):                                   # 珊瑚放射線
            a = math.radians(k * 30 + t * 40)
            r1, r2 = 150 * SS, (150 + 40 * abs(math.sin(t*4))) * SS
            d.line([cx + r1*math.cos(a), cy + r1*math.sin(a),
                    cx + r2*math.cos(a), cy + r2*math.sin(a)],
                   fill=CORAL + (int(200*s),), width=5 * SS)
        f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(200 * SS * (0.5 + 0.5*s)))
        d.text((cx, cy), "FREE", font=f, fill=WHT2 + (int(255*s),), anchor="mm",
               stroke_width=6 * SS, stroke_fill=DARK + (255,))
        d.text((cx, int(H * 0.86) * SS), "免費送", font=fsub, fill=CORAL + (int(255*s),), anchor="mm")
        _save(im, W, H, out, i, "free")
    return {"pattern": str(out / "free_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def word_cloud(out, outdir=None, dur=2.0, fps=30, canvas=(980, 620), words=None):
    words = words or ["Prompt", "Agent", "Context", "Token", "Workflow", "Skills",
                      "Model", "API", "Output", "Vector", "Embedding", "Autonomous"]
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    import random; random.seed(11)
    place = [(random.uniform(.1, .9), random.uniform(.12, .9),
              random.uniform(.8, 1.5), random.random()) for _ in words]
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        for k, w in enumerate(words):
            px, py, sz, delay = place[k]
            ap = _ease(min(max(t - delay * 0.9, 0) / 0.35, 1.0))
            if ap <= 0:
                continue
            fs = int(38 * SS * sz)
            f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", fs)
            col = CORAL if k % 4 == 0 else WHT2
            aa = int((120 if col == WHT2 else 230) * ap)
            d.text((px * W * SS, py * H * SS), w, font=f, fill=col + (aa,), anchor="mm")
        _save(im, W, H, out, i, "words")
    return {"pattern": str(out / "words_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def logos(out, outdir=None, dur=2.0, fps=30, canvas=(760, 360),
          asset="C:/Users/nancy/OneDrive/桌面/AI_use/claudeskill/code/scripts/autoedit/luxe/assets/google_claude.png"):
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    lg = Image.open(asset).convert("RGBA")
    for i in range(n):
        t = (i + 1) / fps
        s = _ease(min(t / 0.4, 1.0))
        im = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
        w2 = int(W * SS * 0.9 * s); h2 = int(w2 * lg.height / lg.width)
        if w2 > 4:
            r = lg.resize((w2, h2), Image.LANCZOS)
            im.alpha_composite(r, ((W * SS - w2) // 2, (H * SS - h2) // 2))
        im.resize((W, H), Image.LANCZOS).save(out / f"logo_{i:05d}.png")
    return {"pattern": str(out / "logo_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def list_card(out, outdir=None, dur=4.4, fps=30, canvas=(940, 640), title="課程內容", items=None):
    items = items or ["認識你的 AI 新同事", "AI 溝通密碼",
                      "Projects、Artifacts 與 Skills", "工作流整合", "深度加速器"]
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    ft = ImageFont.truetype(CJKB, 40 * SS)
    fi = ImageFont.truetype(CJKB, 42 * SS)
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        d.rounded_rectangle([0, 0, W*SS, H*SS], radius=26*SS, fill=PANEL+(255,), outline=LINE2+(255,), width=2*SS)
        d.rounded_rectangle([36*SS, 34*SS, 36*SS+d.textlength(title, font=ft)+44*SS, 34*SS+66*SS],
                            radius=33*SS, fill=CORAL+(255,))
        d.text((58*SS, 67*SS), title, font=ft, fill=DARK+(255,), anchor="lm")
        y0 = 150 * SS
        for k, it in enumerate(items):
            ap = _ease(min(max(t - 0.4 - k*0.55, 0) / 0.4, 1.0))
            if ap <= 0:
                continue
            yy = y0 + k * 90 * SS + int((1-ap)*18*SS); a = int(255*ap)
            d.polygon([(52*SS, yy-10*SS), (52*SS, yy+10*SS), (68*SS, yy)], fill=CORAL+(a,))  # ▸
            d.text((92*SS, yy), it, font=fi, fill=WHT2+(a,), anchor="lm")
        _save(im, W, H, out, i, "list")
    return {"pattern": str(out / "list_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


# ═════════ 扁平風人偶動畫(深色):被單字砸 / 交錢 ═════════
def _person(d, cx, cy, r, color=WHT2, alpha=255):
    col = tuple(color) + (alpha,)
    d.ellipse([cx - r*.42, cy - r, cx + r*.42, cy - r*.16], fill=col)          # 頭
    d.pieslice([cx - r*.72, cy - r*.1, cx + r*.72, cy + r*1.5], 180, 360, fill=col)  # 身


def word_smash(out, outdir=None, dur=2.2, fps=30, canvas=(980, 680), words=None):
    """一堆英文單字掉下來砸到一個小人,小人被砸到最後垂頭(放棄)。"""
    words = words or ["English", "Prompt", "Token", "Context", "Skills",
                      "API", "Model", "Agent", "Syntax", "Output", "Async", "Vector"]
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    import random; random.seed(5)
    ws = [(random.uniform(.12, .88), random.uniform(0, .5), random.uniform(.9, 1.5),
           random.uniform(.7, 1.2)) for _ in words]
    px, py = W // 2 * SS, int(H * 0.80) * SS
    for i in range(n):
        t = (i + 1) / fps
        p = t / (dur)
        im, d = _cv(W, H)
        hits = 0
        for k, w in enumerate(words):
            x0, delay, spd, sz = ws[k]
            prog = max(0, (p - delay) * spd * 2.4)
            if prog <= 0:
                continue
            land = min(prog, 1)
            y = (0.05 + land * 0.70) * H * SS
            if land >= 1:
                hits += 1
            f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(34 * SS * sz))
            col = CORAL if k % 3 == 0 else WHT2
            d.text((x0 * W * SS, y), w, font=f, fill=col + (220,), anchor="mm")
        # 小人:被砸越多越垂頭
        droop = min(hits / 8, 1) * _ease(min(max(p-0.5,0)/0.5,1))
        shake = int(math.sin(t * 40) * 6 * SS * (1 - droop)) if hits else 0
        r = int(52 * SS * (1 - 0.15 * droop))
        _person(d, px + shake, py + int(30 * SS * droop), r, color=WHT2)
        if droop > 0.4:                                       # 放棄:頭上冒 …
            fz = ImageFont.truetype(CJKB, 40 * SS)
            d.text((px + 70*SS, py - 60*SS), "…", font=fz, fill=MUTE2 + (int(255*droop),), anchor="mm")
        _save(im, W, H, out, i, "smash")
    return {"pattern": str(out / "smash_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def handoff(out, outdir=None, dur=4.0, fps=30, canvas=(980, 560), coins=2):
    """左邊小人把錢($)交給右邊小人(分享/交付)。"""
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    lx, rx, cy = int(W*0.22)*SS, int(W*0.78)*SS, int(H*0.52)*SS
    r = 60 * SS
    fc = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 40 * SS)
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        bobL = int(math.sin(t*4) * 5 * SS); bobR = int(math.sin(t*4+1) * 5 * SS)
        _person(d, lx, cy + bobL, r, color=WHT2)
        _person(d, rx, cy + bobR, r, color=CORAL)
        for c in range(coins):                                # 錢幣一枚枚飛過去
            e = ((t / dur) * coins - c) % 1.0 if (t/dur)*coins >= c else -1
            if e < 0:
                continue
            ee = _ease(e)
            cx = lx + r + (rx - r - lx - r) * ee
            cyy = cy - int(math.sin(ee * math.pi) * 90 * SS)
            d.ellipse([cx-26*SS, cyy-26*SS, cx+26*SS, cyy+26*SS],
                      fill=(214, 170, 92, 255), outline=(150, 116, 52, 255), width=4*SS)
            d.text((cx, cyy), "$", font=fc, fill=(90, 68, 30, 255), anchor="mm")
        _save(im, W, H, out, i, "hand")
    return {"pattern": str(out / "hand_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


# ═════════ 補:圓環進度(N%)/ 數字飆升(深色珊瑚)═════════
def make_progress_ring(out, outdir=None, dur=3.5, fps=30, canvas=(640, 640), pct=90, label=""):
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    cx, cy, r = W*SS//2, H*SS//2, int(min(W, H)*0.36)*SS
    for i in range(n):
        p = _ease((i+1)/n); im, d = _cv(W, H)
        d.arc([cx-r, cy-r, cx+r, cy+r], 0, 360, fill=(255, 255, 255, 45), width=16*SS)
        if p > .01:
            d.arc([cx-r, cy-r, cx+r, cy+r], -90, -90+360*(pct/100)*p, fill=CORAL+(255,), width=16*SS)
        f = ImageFont.truetype(CJKB, 120*SS)
        d.text((cx, cy-10*SS), f"{int(round(pct*p))}%", font=f, fill=WHT2+(255,), anchor="mm",
               stroke_width=4*SS, stroke_fill=DARK+(255,))
        if label:
            fl = ImageFont.truetype(CJKB, 46*SS)
            d.text((cx, cy+r+50*SS), label, font=fl, fill=MUTE2+(255,), anchor="mm")
        _save(im, W, H, out, i, "ring")
    return {"pattern": str(out / "ring_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def make_counter2(out, outdir=None, dur=4.0, fps=30, canvas=(760, 380), label="", **kw):
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    a, b = float(kw.get("from", 0)), float(kw.get("to", 100))
    fnum = ImageFont.truetype(CJKB, 150*SS)
    for i in range(n):
        p = _ease((i+1)/n); val = a+(b-a)*p; im, d = _cv(W, H)
        txt = f"{val/10000:.1f}萬" if val >= 10000 else f"{int(round(val))}"
        d.text((W*SS//2, int(H*0.42)*SS), txt, font=fnum, fill=CORAL+(255,), anchor="mm",
               stroke_width=6*SS, stroke_fill=DARK+(255,))
        if label:
            fl = ImageFont.truetype(CJKB, 48*SS)
            d.text((W*SS//2, int(H*0.82)*SS), label, font=fl, fill=WHT2+(255,), anchor="mm")
        _save(im, W, H, out, i, "cnt2")
    return {"pattern": str(out / "cnt2_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def clone(out, outdir=None, dur=3.0, fps=30, canvas=(900, 500), clones=3, label=""):
    """中央一個小人 → 複製成多個分身向外展開(認識很多同好/技能複製放大)。"""
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    cx, cy, r = W*SS//2, int(H*0.44)*SS, 62*SS
    span = int(W*0.30)*SS
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        for k in range(clones):
            off = (k - (clones-1)/2) / max((clones-1)/2, 1)      # -1..1
            delay = abs(off) * 0.5
            ap = _ease(min(max(t - delay, 0)/0.5, 1.0))
            if ap <= 0:
                continue
            x = cx + int(off * span * ap)
            col = WHT2 if k == (clones-1)//2 else CORAL
            _person(d, x, cy, r, color=col, alpha=int(255*ap))
        if label:
            fl = ImageFont.truetype(CJKB, 46*SS)
            d.text((cx, int(H*0.88)*SS), label, font=fl, fill=WHT2+(255,), anchor="mm")
        _save(im, W, H, out, i, "clone")
    return {"pattern": str(out / "clone_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}


def flow(out, outdir=None, dur=3.5, fps=30, canvas=(980, 560), items=4, label=""):
    """幾張經驗卡由左飛入、疊成一疊 → 匯入右側 AI 方塊(經驗灌進 AI 當教練)。"""
    out = Path(outdir or out); out.mkdir(parents=True, exist_ok=True)
    W, H = canvas; n = max(int(dur * fps), 1)
    cw, ch = int(W*0.30)*SS, int(H*0.20)*SS
    stackx, stacky = int(W*0.30)*SS, int(H*0.30)*SS
    aix, aiy, air = int(W*0.80)*SS, int(H*0.42)*SS, int(H*0.20)*SS
    fai = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 60*SS)
    for i in range(n):
        t = (i + 1) / fps
        im, d = _cv(W, H)
        # 右側 AI 方塊(目標)
        d.rounded_rectangle([aix-air, aiy-air, aix+air, aiy+air], radius=28*SS,
                            fill=PANEL+(255,), outline=CORAL+(255,), width=4*SS)
        d.text((aix, aiy), "AI", font=fai, fill=CORAL+(255,), anchor="mm")
        for k in range(items):
            delay = k * 0.35
            ap = _ease(min(max(t - delay, 0)/0.5, 1.0))
            if ap <= 0:
                continue
            merge = _ease(min(max(t - delay - 0.6, 0)/0.6, 1.0))   # 疊好後再被吸入 AI
            sx = int(-cw + (stackx + k*10*SS + cw) * ap)           # 由左飛入
            sy = stacky + k*14*SS
            x = int(sx + (aix - sx) * merge); y = int(sy + (aiy - sy) * merge)
            a = int(255 * (1 - 0.8*merge))
            d.rounded_rectangle([x, y, x+cw, y+ch], radius=14*SS,
                                fill=PANEL+(a,), outline=WHT2+(a,), width=3*SS)
            d.line([x+18*SS, y+ch//2, x+cw-18*SS, y+ch//2], fill=CORAL+(a,), width=5*SS)
        if label:
            fl = ImageFont.truetype(CJKB, 44*SS)
            d.text((W*SS//2, int(H*0.90)*SS), label, font=fl, fill=WHT2+(255,), anchor="mm")
        _save(im, W, H, out, i, "flow")
    return {"pattern": str(out / "flow_%05d.png"), "fps": fps, "frames": n, "w": W, "h": H}
