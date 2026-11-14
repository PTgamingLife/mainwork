"""
合成層:把各鏡頭的視覺片段 + 旁白音檔組成單鏡頭片段,再串接、燒字幕、配樂,輸出成片。

所有有損編碼集中在最後一次,中間不反覆轉檔,避免 generation loss 把細節磨掉。
"""
from __future__ import annotations

import os

from . import ffmpeg_utils as ff
from .schema import Storyboard


def mux_shot(visual_path: str, audio_path: str, out_path: str) -> str:
    """把單一鏡頭的視覺與旁白合成一段,影片長度對齊音訊(以旁白為準)。"""
    ff.run([
        "ffmpeg", "-y",
        "-i", visual_path, "-i", audio_path,
        "-map", "0:v:0", "-map", "1:a:0",
        "-shortest",
        *ff.HQ_VIDEO_ARGS, *ff.HQ_AUDIO_ARGS,
        out_path,
    ])
    return out_path


def concat_clips(clip_paths: list[str], out_path: str) -> str:
    """依序串接多個單鏡頭片段。"""
    list_file = out_path + ".concat.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in clip_paths:
            f.write(f"file '{os.path.abspath(p)}'\n")
    ff.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file,
        *ff.HQ_VIDEO_ARGS, *ff.HQ_AUDIO_ARGS, out_path,
    ])
    os.remove(list_file)
    return out_path


def burn_subtitles(video_path: str, srt_path: str, out_path: str) -> str:
    """把 SRT 燒進畫面(硬字幕)。"""
    style = "FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=80"
    ff.run([
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"subtitles='{srt_path}':force_style='{style}'",
        *ff.HQ_VIDEO_ARGS, "-c:a", "copy",
        out_path,
    ])
    return out_path


def add_background_music(video_path: str, music_path: str, out_path: str, music_db: float = -18.0) -> str:
    """混入背景配樂,旁白為主、配樂壓低。music_db 為配樂相對音量(dB)。"""
    ff.run([
        "ffmpeg", "-y",
        "-i", video_path, "-stream_loop", "-1", "-i", music_path,
        "-filter_complex",
        f"[1:a]volume={music_db}dB[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]",
        "-map", "0:v:0", "-map", "[a]",
        *ff.HQ_VIDEO_ARGS, *ff.HQ_AUDIO_ARGS, "-shortest",
        out_path,
    ])
    return out_path
