"""
端到端 pipeline:文稿 → 成片。

流程:
  1. 導演層:文稿 → 分鏡表(有 OPENAI_API_KEY 用 LLM,否則規則切分)
  2. 語音:每個 shot 旁白 → 你的聲音音檔,量測長度回填 duration
  3. 視覺:每個 shot → B-roll / 背景圖片段(長度對齊旁白)
  4. 合成:逐鏡頭 mux → 串接 → 燒字幕 →(可選）配樂 → 輸出
所有產出(分鏡表 JSON、字幕、各鏡頭素材、成片)都落在 workdir,方便檢查與重跑。
"""
from __future__ import annotations

import os

from . import assemble, director, subtitles
from . import ffmpeg_utils as ff
from .providers import get_broll_provider, get_voice_provider
from .schema import Storyboard, VISUAL_BACKGROUND


def build_video(
    script: str,
    title: str = "未命名",
    workdir: str = "out",
    visual_style: str = "cinematic, soft natural lighting, shallow depth of field",
    aspect_ratio: str = "9:16",
    background_refs: list[str] | None = None,
    music_path: str | None = None,
    use_llm: bool | None = None,
) -> str:
    """跑完整 pipeline,回傳成片路徑。"""
    ff.ensure_ffmpeg()
    os.makedirs(workdir, exist_ok=True)

    # --- 1. 導演層 ---
    if use_llm is None:
        use_llm = bool(os.environ.get("OPENAI_API_KEY"))
    if use_llm:
        board = director.script_to_storyboard(
            script, title=title, visual_style=visual_style,
            aspect_ratio=aspect_ratio, background_refs=background_refs,
        )
    else:
        board = director.rule_based_storyboard(
            script, title=title, visual_style=visual_style, aspect_ratio=aspect_ratio,
        )
    _save(os.path.join(workdir, "storyboard.json"), board.to_json())

    voice = get_voice_provider()
    broll = get_broll_provider()

    # --- 2. 語音(回填每個 shot 的 duration)---
    for shot in board.shots:
        audio_raw = os.path.join(workdir, f"shot_{shot.index:03d}_voice")
        shot.audio_path = voice.synthesize(shot.text, shot.emotion, audio_raw + ".wav")
        shot.duration_sec = ff.probe_duration(shot.audio_path)

    # --- 3. 視覺(長度對齊旁白)---
    for shot in board.shots:
        visual_out = os.path.join(workdir, f"shot_{shot.index:03d}_visual.mp4")
        shot.visual_path = broll.make_clip(shot, board, shot.duration_sec, visual_out)

    # --- 4a. 逐鏡頭 mux ---
    clip_paths: list[str] = []
    for shot in board.shots:
        clip_out = os.path.join(workdir, f"shot_{shot.index:03d}_clip.mp4")
        shot.clip_path = assemble.mux_shot(shot.visual_path, shot.audio_path, clip_out)
        clip_paths.append(shot.clip_path)

    # --- 4b. 串接 ---
    stitched = assemble.concat_clips(clip_paths, os.path.join(workdir, "stitched.mp4"))

    # --- 4c. 字幕(用回填後的 duration 對齊)---
    srt_path = subtitles.write_srt(board, os.path.join(workdir, "subtitles.srt"))
    subtitled = assemble.burn_subtitles(stitched, srt_path, os.path.join(workdir, "subtitled.mp4"))

    # --- 4d. 配樂(可選)---
    final_path = os.path.join(workdir, "final.mp4")
    if music_path:
        assemble.add_background_music(subtitled, music_path, final_path)
    else:
        os.replace(subtitled, final_path)

    # 落地一份回填過 duration 的分鏡表,方便對照
    _save(os.path.join(workdir, "storyboard.resolved.json"), board.to_json())
    return final_path


def _save(path: str, text: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
