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
YUNET = str(Path(__file__).parent / "assets" / "yunet.onnx")


def _face_window(video, samples, card_w, card_h, sub_top=0.86, headroom=0.42):
    """用 YuNet 偵測講者人臉 → 算出『卡片比例、臉置於 headroom 高度、底部切掉燒死字幕』
    的裁切窗 (w,h,x,y);偵不到臉或無 cv2 時回 None(呼叫端 fallback 舊 bias 裁切)。
    OpenCV 在 Windows 讀不了中文路徑 → 模型複製到 ASCII 暫存、影格用 imdecode 繞過。"""
    try:
        import cv2, numpy as np, tempfile, shutil
        if not Path(YUNET).exists():
            return None
        tmp = Path(tempfile.gettempdir()) / "yunet.onnx"
        if not tmp.exists() or tmp.stat().st_size != Path(YUNET).stat().st_size:
            shutil.copyfile(YUNET, tmp)
        det = cv2.FaceDetectorYN_create(str(tmp), "", (320, 320), score_threshold=0.6)
        wkf = Path(tempfile.mkdtemp(prefix="face_"))
        cxs, cys, sw, sh = [], [], None, None
        for i, t in enumerate(samples):
            fp = wkf / f"s{i}.png"
            subprocess.run([FFMPEG, "-y", "-ss", str(t), "-i", video, "-frames:v", "1",
                            str(fp)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if not fp.exists():
                continue
            im = cv2.imdecode(np.fromfile(str(fp), dtype=np.uint8), cv2.IMREAD_COLOR)
            if im is None:
                continue
            sh, sw = im.shape[:2]
            det.setInputSize((sw, sh))
            _, faces = det.detect(im)
            if faces is None or not len(faces):
                continue
            b = max(faces, key=lambda f: f[2] * f[3])
            cxs.append(b[0] + b[2] / 2); cys.append(b[1] + b[3] / 2)
        shutil.rmtree(wkf, ignore_errors=True)
        if not cxs or sw is None:
            return None
        cxs.sort(); cys.sort()
        cx, cy = cxs[len(cxs) // 2], cys[len(cys) // 2]        # 取中位數(抗離群)
        r = card_w / card_h
        sub_y = sub_top * sh
        win_h = min(cy / headroom, (sub_y - cy) / (1 - headroom), sh, sw / r)
        win_h = max(1.0, win_h); win_w = win_h * r
        x = min(max(cx - win_w / 2, 0), sw - win_w)
        y = min(max(cy - headroom * win_h, 0), sh - win_h)
        return (int(win_w), int(win_h), int(x), int(y))
    except Exception as e:
        print(f"[luxe][face] 偵測略過:{e}")
        return None
INK = (34, 30, 26); MUTE = (150, 142, 128); GOLD = (176, 138, 74)
ANIM_Y = {"chart": 230, "coin": 190, "swap": 300, "cta": 430, "app_ui": 170,
          "title": 220, "free": 210, "words": 150, "logos": 300, "list": 150,
          "smash": 130, "handoff": 230, "counter": 300, "ring": 260,
          "clone": 250, "flow": 220}
ANIM_FN = {"chart": "line_chart", "coin": "coin_rain", "swap": "text_swap",
           "cta": "cta", "app_ui": "app_ui", "title": "title_card",
           "free": "free_card", "words": "word_cloud", "logos": "logos", "list": "list_card",
           "smash": "word_smash", "handoff": "handoff", "counter": "make_counter2",
           "ring": "make_progress_ring", "clone": "clone", "flow": "flow"}
# 主題:cream 米白奢華 / dark 深色珊瑚(Case #3)
THEMES = {
    "cream": {"bg": "0xF3EEE5", "ink": (34, 30, 26), "stroke": (243, 238, 229), "border": (176, 138, 74)},
    "dark":  {"bg": "0x121113", "ink": (245, 242, 238), "stroke": (18, 17, 19), "border": (217, 119, 87)},
}
TH = THEMES["cream"]
# 講者直式卡(比例貼近來源,cover 不裁臉、盡量帶肩)
CARD_X, CARD_Y, CARD_W, CARD_H = 200, 955, 680, 900
SUB_Y = 792                       # 字幕(逐句精確)疊在卡片上方
FADE_START, FADE_FULL = 0.74, 0.85   # 卡片底部漸層(蓋燒死字幕)起點/全不透明點


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
    m = Image.new("L", (CARD_W, CARD_H), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, CARD_W, CARD_H], radius=40, fill=255)
    m.save(wk / "mask.png")
    b = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    ImageDraw.Draw(b).rounded_rectangle(
        [CARD_X, CARD_Y, CARD_X + CARD_W, CARD_Y + CARD_H], radius=40,
        outline=TH["border"] + (255,), width=4)
    b.save(wk / "border.png")
    # 卡片底部柔化漸層:蓋掉來源燒死字幕(我的乾淨字幕在卡片上方,不受影響)
    hexbg = TH["bg"].replace("0x", "").replace("#", "")
    bg = tuple(int(hexbg[i:i + 2], 16) for i in (0, 2, 4))
    f = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
    px = f.load()
    y0, y1 = int(CARD_H * FADE_START), int(CARD_H * FADE_FULL)
    for y in range(y0, CARD_H):
        a = 255 if y >= y1 else int(255 * (y - y0) / max(1, y1 - y0))
        for x in range(CARD_W):
            px[x, y] = bg + (a,)
    f.save(wk / "fade.png")


def _sub_png(text, path):
    """逐句精確字幕(中文,秀氣描邊,置中);過長自動縮字級。顏色依主題。"""
    im = Image.new("RGBA", (1080, 110), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    size = 54
    while size > 30:
        f = ImageFont.truetype(CJKB, size)
        if d.textlength(text, font=f) <= 1000:
            break
        size -= 2
    d.text((540, 55), text, font=ImageFont.truetype(CJKB, size),
           fill=TH["ink"] + (255,), anchor="mm", stroke_width=4, stroke_fill=TH["stroke"])
    im.save(path)


def _load_cards(plan: dict, fixes: dict) -> list[dict]:
    """逐句字幕來源:plan['subtitles'] 明確列表,或 plan['transcript'] 指向 segments.json。"""
    cards = plan.get("subtitles")
    if not cards and plan.get("transcript"):
        seg = json.loads(Path(plan["transcript"]).read_text(encoding="utf-8"))
        cards = seg["segments"][0]["cards"]
    cards = cards or []
    out = []
    for c in cards:
        t = c.get("text", "")
        for bad, good in fixes.items():
            t = t.replace(bad, good)
        out.append({"start": c["start"], "end": c["end"], "text": t.strip()})
    return out


def _scenes_to_beats(scenes: list[dict], cards: list[dict], t1: float, dur: float) -> list[dict]:
    """把『錨點句 → 動畫』解析成 beats:每個動畫起點=該句在原片的時間,
    終點=下一個場景起點。節點=你原始影片的字句段落。"""
    resolved = []
    for sc in scenes:
        st = sc.get("start")
        anchor = sc.get("anchor")
        if st is None and anchor:
            for c in cards:
                if anchor in c["text"]:
                    st = c["start"]; break
            if st is None:
                print(f"[luxe][warn] 找不到錨點句:{anchor!r} — 此動畫略過")
                continue
        resolved.append({**sc, "_start": max(float(st if st is not None else t1), t1)})
    resolved.sort(key=lambda r: r["_start"])
    beats = []
    for i, r in enumerate(resolved):
        s = r["_start"]
        e = s + float(r.get("dur", 4.0))          # 錨點句起點 + 動畫時長
        if i + 1 < len(resolved):                 # 不超過下一個場景
            e = min(e, resolved[i + 1]["_start"])
        e = min(e, dur)
        if r.get("anim") and e > s:
            beats.append({"start": s, "end": e, "anim": r["anim"],
                          "params": r.get("params", {})})
    return beats


def render_luxe(plan_path: str, output: str) -> None:
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    global TH
    TH = THEMES.get(plan.get("theme", "cream"), THEMES["cream"])
    video = plan["video"]; dur = float(plan["duration"])
    t1 = float(plan.get("split_start", 4.3)); bias = float(plan.get("face_bias", 0.60))
    wk = Path(tempfile.mkdtemp(prefix="luxe_")); _mask_border(wk)

    # 1) partA 全屏原畫面
    print("[luxe] partA 全屏第一句 ...")
    _run([FFMPEG, "-y", "-i", video, "-t", str(t1),
          "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
          "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
          "-preset", "veryfast", "-c:a", "aac", "-ar", "48000", "-ac", "2", str(wk / "A.mp4")])
    # 2) partB 米白上下分割(講者直式卡:自動人臉置中,底部切掉燒死字幕)
    print("[luxe] partB 上下分割 ...")
    if plan.get("face_center", True):
        smp = [t1 + (dur - t1) * f for f in (0.15, 0.35, 0.55, 0.75, 0.9)]
        fw = _face_window(video, smp, CARD_W, CARD_H,
                          sub_top=float(plan.get("burned_sub_top", 0.86)),
                          headroom=float(plan.get("head_room", 0.42)))
    else:
        fw = None
    if fw:
        w0, h0, x0, y0 = fw
        print(f"[luxe] 人臉置中窗 {w0}x{h0}+{x0}+{y0}")
        spk = (f"[0:v]crop={w0}:{h0}:{x0}:{y0},"
               f"scale={CARD_W}:{CARD_H},setsar=1[spk0];")
    else:
        print("[luxe] 偵不到臉 → 用固定 bias 裁切")
        spk = (f"[0:v]crop=iw:ih*0.74:0:0,"
               f"scale={CARD_W}:{CARD_H}:force_original_aspect_ratio=increase,"
               f"crop={CARD_W}:{CARD_H}:(iw-{CARD_W})/2:(ih-{CARD_H})*{bias},setsar=1[spk0];")
    b_in = [FFMPEG, "-y", "-ss", str(t1), "-i", video,
            "-f", "lavfi", "-i", f"color=c={TH['bg']}:s=1080x1920:r=30",
            "-i", str(wk / "mask.png")]
    if plan.get("card_fade", False):      # 卡片底部漸層蓋燒死字幕(輸入 3)
        b_in += ["-loop", "1", "-i", str(wk / "fade.png")]
        spk += "[spk0][3:v]overlay=0:0[spk];"
    else:
        spk += "[spk0]null[spk];"
    b_filt = (spk + f"[spk]format=rgba[sr];[sr][2:v]alphamerge[sm];"
              f"[1:v][sm]overlay={CARD_X}:{CARD_Y}[bg]")
    _run([*b_in, "-filter_complex", b_filt,
          "-map", "[bg]", "-map", "0:a", "-shortest", "-r", "30", "-c:v", "libx264",
          "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "veryfast",
          "-c:a", "aac", "-ar", "48000", "-ac", "2", str(wk / "B.mp4")])
    # 3) concat
    (wk / "c.txt").write_text("file 'A.mp4'\nfile 'B.mp4'\n", encoding="utf-8")
    _run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(wk / "c.txt"),
          "-c", "copy", str(wk / "base.mp4")])

    # 4) 疊 金框 + 動畫 + 逐句精確字幕
    print("[luxe] 合成動畫+精確字幕 ...")
    inputs = ["-i", str(wk / "base.mp4"), "-loop", "1", "-i", str(wk / "border.png")]
    filt = ["[0:v]null[v0]", f"[v0][1:v]overlay=0:0:enable='between(t,{t1},{dur})'[v1]"]
    base = "[v1]"; idx = 2; n = 2
    # 字幕來源(可為修好的 plan['subtitles']);錨點解析另用原片精準轉錄
    fixes = plan.get("text_fixes", {})
    cards = _load_cards(plan, fixes)
    if plan.get("scenes"):
        anchor_cards = cards
        if plan.get("transcript"):     # 動畫錨點永遠對原片精準時間
            anchor_cards = _load_cards({"transcript": plan["transcript"]}, fixes)
        beats = _scenes_to_beats(plan["scenes"], anchor_cards, t1, dur)
    else:
        beats = plan.get("beats", [])
    for bi, bt in enumerate(beats):
        anim = bt.get("anim")
        if not anim:
            continue
        s, e = float(bt["start"]), float(bt["end"])
        if anim == "clip":     # AI 生成影片:疊進上方動畫區(縮成上半的直式卡)
            inputs += ["-i", bt["params"]["file"]]
            filt.append(f"[{idx}:v]scale=-2:760,setpts=PTS-STARTPTS+{s}/TB[an{idx}]")
            filt.append(f"{base}[an{idx}]overlay=x=(W-w)/2:y=70:"
                        f"enable='between(t,{s},{e})'[v{n}]")
            base = f"[v{n}]"; n += 1; idx += 1
            continue
        info = getattr(L, ANIM_FN[anim])(str(wk / f"a{bi}"),
                                         **{"dur": e - s, **bt.get("params", {})})
        inputs += ["-framerate", str(info["fps"]), "-i", info["pattern"]]
        x = (1080 - info["w"]) // 2; y = ANIM_Y[anim]
        filt.append(f"[{idx}:v]setpts=PTS-STARTPTS+{s}/TB[an{idx}]")
        filt.append(f"{base}[an{idx}]overlay={x}:{y}:enable='between(t,{s},{e})'[v{n}]")
        base = f"[v{n}]"; n += 1; idx += 1
    # 逐句精確字幕(用原片轉錄 cards;分割段才疊,全屏段沿用原燒字幕)
    for ci, c in enumerate(cards):
        s = max(float(c["start"]), t1); e = float(c["end"])
        txt = c["text"]
        if s >= e or not txt:
            continue
        # 跳過英文/ASCII 主導的卡(借用素材的英文轉錄常黏成亂碼,不疊字幕)
        cjk = sum(1 for ch in txt if "一" <= ch <= "鿿")
        if cjk < max(2, len(txt.replace(" ", "")) * 0.4):
            continue
        sp = wk / f"sub{ci}.png"; _sub_png(c["text"], sp)
        inputs += ["-loop", "1", "-i", str(sp)]
        filt.append(f"{base}[{idx}:v]overlay=0:{SUB_Y}:enable='between(t,{s},{e})'[v{n}]")
        base = f"[v{n}]"; n += 1; idx += 1

    _run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filt),
          "-map", base, "-map", "0:a?", "-t", f"{dur}",
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
          "-preset", "veryfast", "-c:a", "aac", output])
    print(f"\n✅ luxe 成品輸出: {output}")


if __name__ == "__main__":
    render_luxe(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "luxe_out.mp4")
