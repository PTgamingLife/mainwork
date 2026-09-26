"""
FFmpeg 薄封裝。

微表情/畫質相關的「壓縮別吃掉細節」設定集中在這裡(高碼率、yuv420p/10-bit、
避免重複轉檔),pipeline 其他地方不直接呼叫 ffmpeg,方便日後統一調整品質策略。
"""
from __future__ import annotations

import json
import shutil
import subprocess


def ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise RuntimeError(
            "找不到 ffmpeg / ffprobe,請先安裝(例如 `apt-get install ffmpeg`)。"
        )


def run(cmd: list[str]) -> None:
    """執行 ffmpeg 指令,失敗時把 stderr 一併拋出方便除錯。"""
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg 失敗(exit {proc.returncode}):\n命令:{' '.join(cmd)}\n{proc.stderr[-2000:]}"
        )


def probe_duration(path: str) -> float:
    """回傳媒體長度(秒)。"""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "json", path,
        ],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise RuntimeError(f"ffprobe 失敗:{out.stderr}")
    return float(json.loads(out.stdout)["format"]["duration"])


# 高品質輸出參數:保留高頻細節,避免微表情被壓縮抹平。
# 對 B-roll/合成中間檔,寧可檔案大也不要反覆有損壓縮(generation loss)。
HQ_VIDEO_ARGS = [
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "16",            # 低 CRF = 高品質
    "-pix_fmt", "yuv420p",   # 相容性;若全程 10-bit 可改 yuv420p10le
]
HQ_AUDIO_ARGS = ["-c:a", "aac", "-b:a", "256k"]
