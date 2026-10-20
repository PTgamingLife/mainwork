# -*- coding: utf-8 -*-
"""Linux 版 runner(對應 make_broll.ps1 的第 3、4 步)。
與 Windows 版差異:
  1. 字型改用系統的 WenQuanYi Zen Hei(Windows 的 msjhbd 在這裡不存在)
  2. 找不到的 B-roll 檔案會被跳過(沙箱擋掉 cloudfront 下載時仍能出片)
MarginV/Fontsize 是 ASS 的 PlayRes 單位不是像素(1 單位 ≈ 4.9px);
填成像素值會把字幕推出畫面,而且輸出檔跟沒字幕時一模一樣、不報錯。
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.environ["AE_SCRIPTS"])

from autoedit.common import CONFIG
from autoedit import stickers

FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
stickers.FONT_CJK = FONT
stickers.FONT_NUM = FONT

CONFIG["enh_skin"] = ""          # smartblur 磨皮在 1080p 極慢,關掉
CONFIG["sub_style"] = ("Fontname=WenQuanYi Zen Hei,Fontsize=15,Bold=1,Outline=1.5,"
                       "Shadow=0,MarginV=60,Alignment=2,"
                       "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000")

plan_path, output = sys.argv[1], sys.argv[2]
nosub = "--nosub" in sys.argv[3:]        # 原片已有燒死字幕時,不要再疊一層
plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
if nosub:
    plan["burn_subtitles"] = False
kept = []
for ov in plan.get("overlays", []):
    if ov.get("type") == "broll" and not Path(ov["clip"]).exists():
        print(f"[run_render] 跳過缺檔的 B-roll:{ov['clip']}")
        continue
    kept.append(ov)
plan["overlays"] = kept
Path("_plan_effective.json").write_text(
    json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

from autoedit import render
render("_plan_effective.json", output)
