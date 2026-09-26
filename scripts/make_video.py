#!/usr/bin/env python3
"""
CLI:把文稿做成口播影片(第一階段:旁白 + 字幕 + B-roll)。

範例:
  # 無 API key,純 Mock,驗證流程能跑出一支示範 mp4
  python scripts/make_video.py --script my_script.txt --title "我的第一支" --no-llm

  # 接上真實 provider(先設好對應環境變數)
  VIDGEN_VOICE_PROVIDER=elevenlabs VIDGEN_BROLL_PROVIDER=http \
  python scripts/make_video.py --script my_script.txt --title "正式版"

背景圖:--bg 可重複指定多張,導演層會在合適段落使用。
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from vidgen.pipeline import build_video  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="文稿轉口播影片")
    parser.add_argument("--script", required=True, help="文稿檔路徑(.txt)")
    parser.add_argument("--title", default="未命名")
    parser.add_argument("--workdir", default="out", help="產出目錄")
    parser.add_argument("--style", default="cinematic, soft natural lighting, shallow depth of field",
                        help="整體視覺風格(影響所有 B-roll)")
    parser.add_argument("--aspect", default="9:16", choices=["9:16", "16:9", "1:1", "4:5"])
    parser.add_argument("--bg", action="append", default=[], help="背景圖路徑,可重複")
    parser.add_argument("--music", default=None, help="背景配樂路徑(可選)")
    parser.add_argument("--no-llm", action="store_true", help="不使用 LLM 導演層,改用規則切句")
    args = parser.parse_args()

    with open(args.script, encoding="utf-8") as f:
        script = f.read()

    final = build_video(
        script=script,
        title=args.title,
        workdir=args.workdir,
        visual_style=args.style,
        aspect_ratio=args.aspect,
        background_refs=args.bg,
        music_path=args.music,
        use_llm=False if args.no_llm else None,
    )
    print(f"完成:{final}")


if __name__ == "__main__":
    main()
