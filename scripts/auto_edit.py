#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
auto_edit.py — 口播影片自動剪輯 + B-roll 流水線 (可重複使用)

三個階段,分開跑,中間可插入 AI 生成 B-roll:

  1) cut      自動砍靜音/停頓 + 轉逐字稿 + 產出 B-roll 計畫草稿
              python auto_edit.py cut  我的口播.mp4 -o out/

  2) (人工/MCP) 依 out/broll_plan.json 的 prompt 用 Higgsfield 生成 B-roll
              把生成的影片檔填回 plan 裡每個項目的 "clip" 欄位

  3) overlay  把 B-roll 疊回精剪影片的對應時間點 + (可選)燒字幕
              python auto_edit.py overlay out/cut.mp4 out/broll_plan.json -o 成品.mp4

設定值在下方 CONFIG 區塊,直接改數字即可。
相依: ffmpeg(自動偵測)、auto-editor、faster-whisper。
"""
from __future__ import annotations
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Windows 主控台預設 cp950,強制 stdout/stderr 走 utf-8 避免 emoji/中文崩潰
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ──────────────────────────── CONFIG ────────────────────────────
CONFIG = {
    # --- 精剪 (auto-editor 29) ---
    "silent_threshold": 0.04,   # 音量低於此值視為靜音 (0~1),越大砍越多
    "margin": "0.2s",           # 靜音前後保留時間,避免切太死 (可用 "6" 影格 或 "0.2s")

    # --- 轉錄 (faster-whisper) ---
    "whisper_model": "small",   # tiny/base/small/medium/large-v3,越大越準越慢
    "language": "zh",           # 口播語言;None=自動偵測

    # --- B-roll 計畫 ---
    "broll_every_sec": 18,      # 大約每隔幾秒安排一段 B-roll
    "broll_len": 4.0,           # 每段 B-roll 顯示秒數
    "broll_min_gap": 8,         # 兩段 B-roll 至少間隔秒數

    # --- 字幕 ---
    "burn_subtitles": True,     # overlay 階段是否燒上字幕
    "sub_fontsize": 16,

    # --- 質感優化 (enhance 階段) ---
    "enh_denoise": "hqdn3d=2:1.5:3:3",     # 降噪;設 "" 關閉
    "enh_skin": "smartblur=4:0.4:-0.3",    # 輕度磨皮(邊緣保留);ls大=磨更兇,lt負=只磨平坦區護五官
    "enh_eq": "eq=contrast=1.07:saturation=1.12:brightness=0.02:gamma=0.98",  # 調色
    "enh_warm": "colortemperature=temperature=5200",  # 暖色電影感;設 "" 關閉
    "enh_sharpen": "unsharp=5:5:0.8:5:5:0.0",  # 救回銳利度(磨皮後必留)
    "enh_vignette": "",         # 暗角,例 "vignette=PI/5";預設關
}
# ─────────────────────────────────────────────────────────────────


def find_ffmpeg(name: str) -> str:
    """先找 PATH,再找 winget 安裝路徑。"""
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


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    print("  $", " ".join(str(c) for c in cmd[:6]), "..." if len(cmd) > 6 else "")
    return subprocess.run(cmd, check=True, **kw)


def video_size(path: str) -> tuple[int, int]:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split("x")
    return int(w), int(h)


def fmt_ts(sec: float) -> str:
    h = int(sec // 3600); m = int((sec % 3600) // 60)
    s = int(sec % 60); ms = int((sec - int(sec)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ─────────────────────────── STAGE 1: cut ───────────────────────────
def stage_cut(video: str, outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    cut_mp4 = outdir / "cut.mp4"

    # iPhone MOV 常含多條 metadata/data 軌會讓 auto-editor 解碼失敗;先只留主視訊+主音軌
    clean = outdir / "_clean.mp4"
    print("\n[0/3] 清理多餘軌道 (只留主視訊+主音軌) ...")
    run([FFMPEG, "-y", "-i", video, "-map", "0:v:0", "-map", "0:a:0",
         "-c", "copy", str(clean)])
    video = str(clean)

    print("\n[1/3] auto-editor 自動砍靜音/停頓 ...")
    run([sys.executable, "-m", "auto_editor", video,
         "--edit", f"audio:threshold={CONFIG['silent_threshold']}",
         "--margin", str(CONFIG["margin"]),
         "--no-open", "-o", str(cut_mp4)])

    print("\n[2/3] faster-whisper 轉逐字稿 (精剪後的時間軸) ...")
    from faster_whisper import WhisperModel
    model = WhisperModel(CONFIG["whisper_model"], device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        str(cut_mp4), language=CONFIG["language"], vad_filter=True)
    segs = [{"start": float(s.start), "end": float(s.end), "text": s.text.strip()}
            for s in segments]

    (outdir / "transcript.json").write_text(
        json.dumps(segs, ensure_ascii=False, indent=2), encoding="utf-8")

    srt = "\n".join(
        f"{i}\n{fmt_ts(s['start'])} --> {fmt_ts(s['end'])}\n{s['text']}\n"
        for i, s in enumerate(segs, 1))
    (outdir / "transcript.srt").write_text(srt, encoding="utf-8")

    print("\n[3/3] 產出 B-roll 計畫草稿 ...")
    plan = build_broll_plan(segs)
    (outdir / "broll_plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n✅ 完成。精剪影片: {cut_mp4}")
    print(f"   逐字稿:   {outdir/'transcript.srt'}")
    print(f"   B-roll計畫: {outdir/'broll_plan.json'}  ({len(plan)} 段)")
    print("\n下一步:依 broll_plan.json 的 prompt 生成 B-roll,把檔案路徑填回每段的 \"clip\",")
    print("再跑:  python auto_edit.py overlay", cut_mp4, outdir / "broll_plan.json", "-o 成品.mp4")


def build_broll_plan(segs: list[dict]) -> list[dict]:
    """依時間間隔挑句子,產出 B-roll 提示草稿(prompt 之後可由人/AI 精修)。"""
    plan: list[dict] = []
    last = -CONFIG["broll_min_gap"]
    for s in segs:
        if s["start"] - last < max(CONFIG["broll_every_sec"], CONFIG["broll_min_gap"]):
            continue
        if not s["text"]:
            continue
        last = s["start"]
        plan.append({
            "start": round(s["start"], 2),
            "end": round(s["start"] + CONFIG["broll_len"], 2),
            "based_on": s["text"],
            "prompt": f"B-roll cinematic footage illustrating: {s['text']}",
            "clip": "",   # ← 生成後把 B-roll 影片路徑填這裡
        })
    return plan


# ─────────────────────────── STAGE 3: overlay ───────────────────────────
def stage_overlay(cut_mp4: str, plan_path: str, output: str) -> None:
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    items = [p for p in plan if p.get("clip") and Path(p["clip"]).exists()]
    missing = [p for p in plan if not (p.get("clip") and Path(p["clip"]).exists())]
    if missing:
        print(f"[!] {len(missing)} 段尚未填入有效 clip,將略過。")
    W, H = video_size(cut_mp4)

    inputs = ["-i", cut_mp4]
    for it in items:
        inputs += ["-i", it["clip"]]

    filters, base = [], "[0:v]"
    for idx, it in enumerate(items, start=1):
        s, e = float(it["start"]), float(it["end"])
        filters.append(
            f"[{idx}:v]scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},setpts=PTS-STARTPTS+{s}/TB[b{idx}]")
        out = f"[v{idx}]"
        filters.append(
            f"{base}[b{idx}]overlay=enable='between(t,{s},{e})'{out}")
        base = out

    vchain = base
    srt = str(Path(plan_path).with_name("transcript.srt"))
    if CONFIG["burn_subtitles"] and Path(srt).exists():
        srt_esc = srt.replace("\\", "/").replace(":", "\\:")
        filters.append(
            f"{base}subtitles='{srt_esc}':force_style="
            f"'Fontsize={CONFIG['sub_fontsize']}'[vout]")
        vchain = "[vout]"

    if not filters:  # 沒有 B-roll 也沒字幕
        run([FFMPEG, "-y", "-i", cut_mp4, "-c", "copy", output])
        print(f"✅ (無 B-roll) 直接輸出: {output}")
        return

    cmd = [FFMPEG, "-y", *inputs,
           "-filter_complex", ";".join(filters),
           "-map", vchain, "-map", "0:a?",
           "-c:v", "libx264", "-crf", "20", "-preset", "medium",
           "-c:a", "aac", output]
    print(f"\n疊上 {len(items)} 段 B-roll" +
          (" + 燒字幕" if vchain == "[vout]" else "") + " ...")
    run(cmd)
    print(f"\n✅ 成品輸出: {output}")


# ─────────────────────────── STAGE: enhance ───────────────────────────
def stage_enhance(video: str, output: str) -> None:
    """本機調色 + 輕度磨皮 + 銳化,順序:降噪→磨皮→調色→暖色→銳化→暗角。"""
    chain = [CONFIG[k] for k in
             ("enh_denoise", "enh_skin", "enh_eq", "enh_warm",
              "enh_sharpen", "enh_vignette") if CONFIG[k]]
    if not chain:
        sys.exit("[ERROR] enhance 全部關閉,沒東西可做(檢查 CONFIG enh_*)")
    vf = ",".join(chain)
    print("質感優化 filter:", vf)
    run([FFMPEG, "-y", "-i", video, "-vf", vf,
         "-c:v", "libx264", "-crf", "19", "-preset", "medium",
         "-c:a", "copy", output])
    print(f"\n✅ 優化輸出: {output}")


# ─────────────────────────────── CLI ───────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="口播影片自動剪輯 + B-roll 流水線")
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("cut", help="砍靜音 + 轉錄 + 產 B-roll 計畫")
    c.add_argument("video")
    c.add_argument("-o", "--outdir", default="out")

    o = sub.add_parser("overlay", help="疊 B-roll + 燒字幕")
    o.add_argument("cut_mp4")
    o.add_argument("plan")
    o.add_argument("-o", "--output", default="final.mp4")

    e = sub.add_parser("enhance", help="調色 + 磨皮 + 銳化 質感優化")
    e.add_argument("video")
    e.add_argument("-o", "--output", default="enhanced.mp4")

    args = ap.parse_args()
    if args.cmd == "cut":
        stage_cut(args.video, Path(args.outdir))
    elif args.cmd == "overlay":
        stage_overlay(args.cut_mp4, args.plan, args.output)
    elif args.cmd == "enhance":
        stage_enhance(args.video, args.output)


if __name__ == "__main__":
    main()
