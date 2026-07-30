# -*- coding: utf-8 -*-
"""plan 階段:轉錄原片 → 列出所有語音段 + 空白 + 重複/過長標記 + 逐段縮圖。
產出 segments.json(給 render 用)與 segments.md(給人看)。"""
from __future__ import annotations
import json
from pathlib import Path

from .common import (CONFIG, probe_duration, transcribe, split_subtitle,
                     similar, extract_thumb, fmt_ts)


def make_plan(video: str, outdir: str) -> list[dict]:
    out = Path(outdir)
    (out / "thumbs").mkdir(parents=True, exist_ok=True)

    print("\n[plan] 轉錄原片(word 級停頓斷句)...")
    raw = transcribe(video, words=True)
    dur = probe_duration(video)

    segs: list[dict] = []
    prev_end = 0.0
    for i, s in enumerate(raw, 1):
        gap_before = round(s["start"] - prev_end, 2)
        cards = split_subtitle(s["text"], s["start"], s["end"])
        seg = {
            "id": i,
            "start": round(s["start"], 2),
            "end": round(s["end"], 2),
            "dur": round(s["end"] - s["start"], 2),
            "text": s["text"],
            "gap_before": gap_before,
            "long_gap": gap_before >= CONFIG["long_gap_sec"],
            "dup_of": None,
            "cards": [{"start": round(c["start"], 2), "end": round(c["end"], 2),
                       "text": c["text"]} for c in cards],
            "n_cards": len(cards),
        }
        for p in segs:
            if similar(s["text"], p["text"]) >= CONFIG["dup_ratio"]:
                seg["dup_of"] = p["id"]
                break
        segs.append(seg)
        prev_end = s["end"]

    tail_gap = round(dur - prev_end, 2)

    print("[plan] 抽逐段縮圖 ...")
    for seg in segs:
        mid = (seg["start"] + seg["end"]) / 2
        extract_thumb(video, mid, str(out / "thumbs" / f"seg_{seg['id']:02d}.jpg"))

    (out / "segments.json").write_text(
        json.dumps({"video": video, "duration": dur, "tail_gap": tail_gap,
                    "segments": segs}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    _write_md(out / "segments.md", segs, dur, tail_gap)
    _print_summary(segs, dur, tail_gap)
    return segs


def _write_md(path: Path, segs, dur, tail_gap) -> None:
    lines = [f"# 片段清單(原片 {dur:.1f}s)\n",
             "| # | 時間 | 秒 | 前方空白 | 字幕 | 標記 |",
             "|---|------|----|---------|------|------|"]
    for s in segs:
        marks = []
        if s["long_gap"]:
            marks.append(f"⚠️空白{s['gap_before']}s")
        if s["dup_of"]:
            marks.append(f"🔁似#{s['dup_of']}")
        if s["n_cards"] > 1:
            marks.append(f"✂️切{s['n_cards']}卡")
        lines.append(
            f"| {s['id']} | {fmt_ts(s['start'],0)}–{fmt_ts(s['end'],0)} "
            f"| {s['dur']} | {s['gap_before']}s | {s['text']} | {' '.join(marks)} |")
    if tail_gap >= CONFIG["long_gap_sec"]:
        lines.append(f"\n> ⚠️ 結尾還有 {tail_gap}s 空白")
    path.write_text("\n".join(lines), encoding="utf-8")


def _print_summary(segs, dur, tail_gap) -> None:
    longg = [s for s in segs if s["long_gap"]]
    dups = [s for s in segs if s["dup_of"]]
    splits = [s for s in segs if s["n_cards"] > 1]
    print(f"\n✅ plan 完成:{len(segs)} 段語音,原片 {dur:.1f}s")
    print(f"   過長空白 {len(longg)} 處、重複 {len(dups)} 段、需切卡 {len(splits)} 段")
    print("   segments.md / segments.json / thumbs/ 已輸出")
