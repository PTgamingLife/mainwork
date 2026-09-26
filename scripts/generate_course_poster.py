#!/usr/bin/env python3
"""Generate an AI course promotional poster via OpenAI gpt-image-2.

Local Python counterpart of the `course-poster` Supabase Edge Function
(supabase/functions/course-poster/index.ts). Saves the result as a PNG.

Usage:
    OPENAI_API_KEY=sk-... python scripts/generate_course_poster.py \
        --title "AI 應用實戰班" \
        --subtitle "8 週掌握生成式 AI" \
        --out poster.png
"""
import argparse
import base64
import os
import sys

import requests

DEFAULT_HIGHLIGHTS = ["實戰專案導向", "業界講師親授", "結業作品集", "小班互動教學"]


def build_prompt(args: argparse.Namespace) -> str:
    if args.prompt:
        return args.prompt.strip()

    highlights = args.highlight or DEFAULT_HIGHLIGHTS
    return "\n".join([
        "設計一張直式的線上課程宣傳海報（poster），主題為人工智慧 / AI 課程。",
        f"主標題文字：「{args.title}」，置於視覺中心、字體粗大醒目。",
        f"副標題文字：「{args.subtitle}」。",
        f"重點賣點（以條列或圖示呈現）：{'、'.join(highlights)}。",
        f"目標客群：{args.audience}。",
        f"視覺風格：{args.style}。",
        "包含與 AI 相關的意象（神經網路、晶片、資料流、機器人或抽象幾何）。",
        "排版整潔、層次分明、留有可閱讀的文字空間，色彩對比清楚，適合社群媒體與印刷宣傳。",
        "中文文字需正確、清晰、無錯字。",
    ])


def generate_png(prompt: str, size: str, quality: str, api_key: str) -> bytes:
    resp = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": "gpt-image-2", "prompt": prompt, "n": 1, "size": size, "quality": quality},
        timeout=180,
    )
    resp.raise_for_status()
    item = resp.json()["data"][0]
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"])
    if item.get("url"):
        img = requests.get(item["url"], timeout=60)
        img.raise_for_status()
        return img.content
    raise ValueError("No image data returned from OpenAI")


def main() -> int:
    p = argparse.ArgumentParser(description="Generate an AI course promo poster.")
    p.add_argument("--title", default="AI 應用實戰班")
    p.add_argument("--subtitle", default="從零開始，8 週掌握生成式 AI")
    p.add_argument("--audience", default="適合上班族與學生")
    p.add_argument("--style", default="現代科技感、深藍與霓虹漸層、簡潔留白、專業排版")
    p.add_argument("--highlight", action="append", help="repeatable selling point")
    p.add_argument("--prompt", help="full prompt override")
    p.add_argument("--size", default="1024x1536")
    p.add_argument("--quality", default="high", choices=["low", "medium", "high"])
    p.add_argument("--out", default="course_poster.png")
    args = p.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY is not set", file=sys.stderr)
        return 1

    print("[Poster] Generating with gpt-image-2 ...", file=sys.stderr)
    png = generate_png(build_prompt(args), args.size, args.quality, api_key)
    with open(args.out, "wb") as f:
        f.write(png)
    print(f"[Poster] Saved {len(png)} bytes -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
