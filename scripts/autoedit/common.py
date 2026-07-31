# -*- coding: utf-8 -*-
"""autoedit 共用工具:ffmpeg 偵測、轉錄、字幕斷句、縮圖。"""
from __future__ import annotations
import os
import shutil
import subprocess
import sys
import tempfile
from difflib import SequenceMatcher
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

CONFIG = {
    # 轉錄
    "whisper_model": "small",   # 記憶體不足會自動降級 small→base→tiny
    "language": "zh",
    # 空白/重複判定 (plan 階段)
    "pause_split_sec": 0.6,     # 字與字間隔大於此秒數 → 視為斷句/新語音段
    "long_gap_sec": 1.2,        # 大於此秒數的空白標為「過長空白」建議砍
    "dup_ratio": 0.86,          # 文字相似度高於此值標為「重複」
    "text_fixes": {},           # 轉錄錯字修正 {"counter":"Claude"};plan 前套用
    # 字幕斷句 (一行放不下就切兩段)
    "max_chars_per_line": 16,
    # 調色/磨皮 (enhance)
    "enh_scale": "-2:1920",     # 縮到 1080p 直式;"" = 不縮
    "enh_denoise": "hqdn3d=2:1.5:3:3",
    "enh_skin": "smartblur=4:0.4:-0.3",
    "enh_eq": "eq=contrast=1.07:saturation=1.12:brightness=0.02:gamma=0.98",
    "enh_warm": "colortemperature=temperature=5200",
    "enh_sharpen": "unsharp=5:5:0.8:5:5:0.0",
    # 字幕樣式 (直式1080)
    "sub_style": ("Fontsize=14,Bold=1,Outline=2,Shadow=0,MarginV=140,"
                  "Alignment=2,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000"),
    # 貼圖
    "sticker_width_ratio": 0.32,
    "sticker_margin_top": 120,
}


def find_ffmpeg(name: str) -> str:
    exe = shutil.which(name)
    if exe:
        return exe
    base = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    if base.exists():
        for hit in base.rglob(f"{name}.exe"):
            return str(hit)
    sys.exit(f"[ERROR] 找不到 {name},請先安裝 ffmpeg (winget install Gyan.FFmpeg)")


FFMPEG = find_ffmpeg("ffmpeg")
FFPROBE = find_ffmpeg("ffprobe")


def run(cmd, **kw):
    print("  $", " ".join(str(c) for c in cmd[:5]), "...")
    return subprocess.run(cmd, check=True, **kw)


def probe_duration(path: str) -> float:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def video_size(path: str) -> tuple[int, int]:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height", "-of", "csv=p=0:s=x", path],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split("x")
    return int(w), int(h)


def fmt_ts(sec: float, comma=True) -> str:
    h = int(sec // 3600); m = int((sec % 3600) // 60)
    s = int(sec % 60); ms = int(round((sec - int(sec)) * 1000))
    sep = "," if comma else "."
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def transcribe(video: str, words: bool = False) -> list[dict]:
    """抽乾淨單聲道音軌再轉錄(避開 iPhone 多軌解碼問題)。
    words=False → whisper 原始 segment;words=True → 依真實停頓重新斷句。
    記憶體不足(mkl_malloc)時自動降級 small→base→tiny。"""
    from faster_whisper import WhisperModel
    tmp = Path(tempfile.gettempdir()) / f"_ae_{os.getpid()}.wav"
    run([FFMPEG, "-y", "-i", video, "-map", "0:a:0", "-ac", "1", "-ar",
         "16000", "-vn", str(tmp)])
    raw, last, tried = None, None, []
    for mdl in (CONFIG["whisper_model"], "base", "tiny"):
        if mdl in tried:
            continue
        tried.append(mdl)
        try:
            model = WhisperModel(mdl, device="cpu", compute_type="int8")
            gen, _ = model.transcribe(str(tmp), language=CONFIG["language"],
                                      vad_filter=True, word_timestamps=words)
            raw = list(gen)     # 強制求值,讓錯誤在此拋出以便降級
            break
        except (RuntimeError, MemoryError) as ex:
            last = ex
            print(f"[transcribe] 模型 {mdl} 失敗:{ex};降級重試 ...")
    if raw is None:
        raise RuntimeError(f"whisper 全部模型失敗:{last}")
    if not words:
        out = [{"start": float(s.start), "end": float(s.end),
                "text": _fix(s.text.strip())} for s in raw if s.text.strip()]
    else:
        allw = [{"start": float(w.start), "end": float(w.end), "w": w.word}
                for s in raw for w in (s.words or [])]
        out = words_to_segments(allw)
    try:
        tmp.unlink()
    except Exception:
        pass
    return out


def _fix(text: str) -> str:
    for bad, good in CONFIG["text_fixes"].items():
        text = text.replace(bad, good)
    return text


def words_to_segments(words: list[dict]) -> list[dict]:
    """依字間停頓(pause_split_sec)把逐字切成語音段;段間間隔即『空白』。"""
    thr = CONFIG["pause_split_sec"]
    segs, cur = [], []
    for w in words:
        if cur and w["start"] - cur[-1]["end"] >= thr:
            segs.append(_mk_seg(cur))
            cur = []
        cur.append(w)
    if cur:
        segs.append(_mk_seg(cur))
    return segs


def _mk_seg(ws: list[dict]) -> dict:
    text = _fix("".join(w["w"] for w in ws).strip())
    return {"start": ws[0]["start"], "end": ws[-1]["end"], "text": text}


def _visible_len(text: str) -> int:
    """中文字算 1,ASCII 算 0.5,忽略空白。"""
    n = 0.0
    for ch in text:
        if ch.isspace():
            continue
        n += 0.5 if ord(ch) < 128 else 1.0
    return round(n)


def split_subtitle(text: str, start: float, end: float,
                   max_chars: int | None = None) -> list[dict]:
    """字幕過長 → 切成連續字卡(時間依字數比例分)。不會變成兩行。"""
    max_chars = max_chars or CONFIG["max_chars_per_line"]
    if _visible_len(text) <= max_chars:
        return [{"start": start, "end": end, "text": text}]
    puncts = "，,、。！？!?；;：: "
    mid = len(text) // 2
    best, bestd = mid, len(text)
    for i, ch in enumerate(text):
        if ch in puncts and abs(i - mid) < bestd:
            best, bestd = i + 1, abs(i - mid)
    if best <= 0 or best >= len(text):
        best = mid
    left = text[:best].strip("，,、。！？!?；;：: ")
    right = text[best:].strip("，,、。！？!?；;：: ")
    if not left or not right:
        return [{"start": start, "end": end, "text": text}]
    ratio = _visible_len(left) / max(_visible_len(left) + _visible_len(right), 1)
    split_t = start + (end - start) * ratio
    # 左右兩半都要遞迴切(否則無標點長句的左半會留成巨卡)
    return (split_subtitle(left, start, split_t, max_chars)
            + split_subtitle(right, split_t, end, max_chars))


def similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def extract_thumb(video: str, t: float, out_png: str, width: int = 300) -> None:
    run([FFMPEG, "-y", "-ss", f"{t}", "-i", video, "-frames:v", "1",
         "-vf", f"scale={width}:-1", out_png])
