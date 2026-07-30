#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""ae.py — 影片編輯流水線 CLI(貼圖 / B-roll / 調色;字幕驅動,已移除自動剪輯)。

  分析分支(學習參考影片):
    python ae.py analyze 影片 -o out/

  編輯分支:
    python ae.py plan   影片 -o out/ [--fix counter=Claude]   # 抓字幕列句
    (人工挑句 → 產生 edit_plan.json)
    python ae.py render out/edit_plan.json -o 成品.mp4         # 疊貼圖/B-roll/字幕
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from autoedit import make_plan, render, make_analysis_material  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="影片編輯流水線(貼圖/B-roll/調色)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("analyze", help="分析分支:抽逐字稿+字卡樣張")
    a.add_argument("video"); a.add_argument("-o", "--outdir", default="out")

    p = sub.add_parser("plan", help="編輯①:抓字幕列句")
    p.add_argument("video"); p.add_argument("-o", "--outdir", default="out")
    p.add_argument("--fix", action="append", default=[],
                   help="轉錄錯字修正,格式 bad=good,可重複(例 --fix counter=Claude)")

    r = sub.add_parser("render", help="編輯②:疊貼圖/B-roll/字幕")
    r.add_argument("plan"); r.add_argument("-o", "--output", default="final.mp4")

    args = ap.parse_args()
    if args.cmd == "analyze":
        make_analysis_material(args.video, args.outdir)
    elif args.cmd == "plan":
        if args.fix:
            from autoedit.common import CONFIG
            CONFIG["text_fixes"].update(
                dict(f.split("=", 1) for f in args.fix if "=" in f))
        make_plan(args.video, args.outdir)
    elif args.cmd == "render":
        render(args.plan, args.output)


if __name__ == "__main__":
    main()
