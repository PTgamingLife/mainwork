"""
導演層:把一份文稿用 LLM 切成分鏡表(Storyboard)。

這是整個產品的核心——市面上沒有現成 API 做這件事。它決定:
  · 文稿怎麼切段(每段一句旁白)
  · 每段的情緒語氣(給語音 provider 控制 prosody)
  · 每段配什麼畫面(B-roll 生成 prompt,或使用你提供的背景圖)

沒有 OPENAI_API_KEY 時,可改用 rule_based_storyboard() 做最簡單的規則切分,
讓 pipeline 仍能跑通(只是畫面與情緒比較陽春)。
"""
from __future__ import annotations

import json
import os
import re

from openai import OpenAI

from .schema import Shot, Storyboard, EMOTIONS, VISUAL_BROLL

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


_SYSTEM = """你是一位短影音導演,專長把口播文稿轉成分鏡表。
你只輸出 JSON,不輸出任何其他文字。"""


def _build_prompt(script: str, title: str, visual_style: str, background_refs: list[str]) -> str:
    bg_hint = (
        f"\n可用的背景圖(用 visual_kind=\"background\" 並把 background_ref 設成下列其一):\n"
        + "\n".join(f"  - {ref}" for ref in background_refs)
        if background_refs
        else "\n目前沒有提供背景圖,所有畫面都用 visual_kind=\"broll\" 生成。"
    )
    return f"""把下面這份口播文稿切成分鏡表。

標題:{title}
整體視覺風格(所有 B-roll 都要符合):{visual_style}
情緒只能用這些標籤:{", ".join(EMOTIONS)}
{bg_hint}

切分原則:
1. 每個 shot 是「一句話到兩句話」的旁白,長度適合一個鏡頭(約 3–8 秒)。
2. emotion 依該句語氣選最貼切的標籤。
3. 每個 shot 配一個畫面:
   - 預設用 "broll",broll_prompt 寫成具體、可被影片生成模型理解的英文畫面描述,
     並自然帶入整體視覺風格,不要出現文字看板或字幕。
   - 若某句明顯適合用提供的背景圖,才用 "background" 並指定 background_ref。
4. broll_prompt 要描述「畫面內容」而非「旁白內容」,且各 shot 風格一致。

只輸出符合以下 schema 的 JSON:
{{
  "title": "...",
  "shots": [
    {{
      "index": 0,
      "text": "這一段的旁白原文",
      "emotion": "neutral",
      "visual_kind": "broll",
      "broll_prompt": "English visual description ...",
      "background_ref": ""
    }}
  ]
}}

文稿如下:
\"\"\"
{script}
\"\"\""""


def script_to_storyboard(
    script: str,
    title: str = "未命名",
    visual_style: str = "cinematic, soft natural lighting, shallow depth of field",
    aspect_ratio: str = "9:16",
    background_refs: list[str] | None = None,
    model: str | None = None,
) -> Storyboard:
    """用 LLM 把文稿轉成 Storyboard。"""
    model = model or os.environ.get("VIDGEN_DIRECTOR_MODEL", "gpt-4o")
    prompt = _build_prompt(script, title, visual_style, background_refs or [])

    response = get_client().chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.6,
    )
    data = json.loads(response.choices[0].message.content)
    data.setdefault("title", title)
    data["visual_style"] = visual_style
    data["aspect_ratio"] = aspect_ratio

    # 補齊缺漏欄位 + 重新編號,避免 LLM 漏給 index
    for i, shot in enumerate(data.get("shots", [])):
        shot["index"] = i
        shot.setdefault("emotion", "neutral")
        shot.setdefault("visual_kind", VISUAL_BROLL)
        shot.setdefault("broll_prompt", "")
        shot.setdefault("background_ref", "")

    board = Storyboard.from_dict(data)
    board.validate()
    return board


def rule_based_storyboard(
    script: str,
    title: str = "未命名",
    visual_style: str = "cinematic, soft natural lighting, shallow depth of field",
    aspect_ratio: str = "9:16",
) -> Storyboard:
    """不靠 LLM 的 fallback:按標點切句,情緒一律 neutral,畫面用旁白當 prompt。

    品質明顯較差,只用於沒有 OPENAI_API_KEY 時讓 pipeline 跑得起來。
    """
    sentences = [s.strip() for s in re.split(r"(?<=[。!?！？\n])", script) if s.strip()]
    shots = [
        Shot(
            index=i,
            text=sentence,
            emotion="neutral",
            visual_kind=VISUAL_BROLL,
            broll_prompt=f"{visual_style}, abstract ambient b-roll",
        )
        for i, sentence in enumerate(sentences)
    ]
    board = Storyboard(title=title, shots=shots, visual_style=visual_style, aspect_ratio=aspect_ratio)
    board.validate()
    return board
