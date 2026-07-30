# -*- coding: utf-8 -*-
"""analyze 階段:抽逐字稿 + 抽字幕/字卡樣張,餵給 Reels 模型(reels-script skill)分析。
本階段只負責『取素材』,實際歸因分析與模型更新由 Claude 依 reels-script SKILL 執行。"""
from __future__ import annotations
import json
from pathlib import Path

from .common import transcribe, probe_duration, extract_thumb


def make_analysis_material(video: str, outdir: str, n_frames: int = 8) -> dict:
    out = Path(outdir)
    (out / "caption_frames").mkdir(parents=True, exist_ok=True)

    print("\n[analyze] 轉錄文字內容 ...")
    segs = transcribe(video)
    dur = probe_duration(video)
    full_text = " ".join(s["text"] for s in segs)

    print("[analyze] 抽字幕/字卡樣張 ...")
    frames = []
    for i in range(n_frames):
        t = dur * (i + 0.5) / n_frames
        p = out / "caption_frames" / f"cap_{i:02d}.jpg"
        extract_thumb(video, t, str(p), width=360)
        frames.append(str(p))

    material = {"video": video, "duration": round(dur, 1),
                "full_text": full_text, "segments": segs, "frames": frames}
    (out / "analysis_material.json").write_text(
        json.dumps(material, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ analyze 取材完成:{len(segs)} 句、{n_frames} 張樣張")
    print("   → 由 Claude 依 reels-script 學習模式做歸因分析並回報")
    return material
