# -*- coding: utf-8 -*-
"""斷句對齊:把使用者用「|」重切的逐字稿,對回原片時間(用 char_timeline)。
使用者只改斷句/文字,不碰時間;本工具依字元序列對齊,算每句 start/end。

用法:
  python resegment.py 斷句版.txt char_timeline.json out_subtitles.json
輸出 {"subtitles":[{start,end,text},...]},可直接塞進 luxe plan['subtitles']。
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def _load_segments(txt_path: str) -> list[str]:
    lines = Path(txt_path).read_text(encoding="utf-8").splitlines()
    body = " ".join(l for l in lines if not l.lstrip().startswith("#"))
    return [s.strip() for s in body.split("|") if s.strip()]


def align(segments: list[str], timeline: list[dict]) -> list[dict]:
    orig = [t["ch"] for t in timeline]
    N = len(orig)
    p = 0
    out = []
    for s in segments:
        # 找起點:自 p 起第一個「首字相符且前幾字大致相符」的位置
        idx, k0 = -1, min(3, len(s))
        for i in range(p, N):
            if orig[i] != s[0]:
                continue
            hit = sum(1 for d in range(k0) if i + d < N and orig[i + d] == s[d])
            if hit >= max(1, k0 - 1):
                idx = i
                break
        if idx < 0:                     # 全新文字/找不到 → 接在上一段後
            idx = p
        # 由 idx 逐字消耗(容許跳過原文被刪的字)
        j, k, skip = idx, 0, 0
        while k < len(s) and j < N:
            if orig[j] == s[k]:
                j += 1
                k += 1
            elif skip < 4:              # 原文多出的字(口誤/被改)最多跳 4
                j += 1
                skip += 1
            else:
                break
        end_i = min(j, N) - 1
        out.append({"start": round(timeline[idx]["s"], 2),
                    "end": round(timeline[end_i]["e"], 2), "text": s})
        p = max(j, idx + 1)
    # 保單調遞增(避免對齊回跳)
    for i in range(1, len(out)):
        if out[i]["start"] < out[i - 1]["end"]:
            out[i]["start"] = out[i - 1]["end"]
        if out[i]["end"] <= out[i]["start"]:
            out[i]["end"] = out[i]["start"] + 0.6
    return out


def main():
    segs = _load_segments(sys.argv[1])
    timeline = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    subs = align(segs, timeline)
    out = sys.argv[3] if len(sys.argv) > 3 else "subtitles.json"
    Path(out).write_text(json.dumps({"subtitles": subs}, ensure_ascii=False, indent=1),
                         encoding="utf-8")
    print(f"{len(subs)} 句 → {out}")
    for s in subs[:6]:
        print(f'  {s["start"]:6.1f}-{s["end"]:6.1f}  {s["text"]}')


if __name__ == "__main__":
    main()
