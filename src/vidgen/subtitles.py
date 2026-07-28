"""
字幕產生。

第一階段用「鏡頭級」字幕:每個 shot 的旁白整段顯示,起訖時間用各 shot 的實際音檔長度
累加得到。等之後接上能回傳字級時間戳(word-level timestamps)的語音 API,
再把這裡升級成逐字字幕即可,pipeline 介面不變。
"""
from __future__ import annotations

from .schema import Storyboard


def _fmt_ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(board: Storyboard) -> str:
    """依各 shot 的 duration_sec 累加,輸出 SRT 字串。需先跑完語音合成回填 duration。"""
    lines: list[str] = []
    cursor = 0.0
    for i, shot in enumerate(board.shots, start=1):
        start, end = cursor, cursor + shot.duration_sec
        lines.append(str(i))
        lines.append(f"{_fmt_ts(start)} --> {_fmt_ts(end)}")
        lines.append(shot.text.strip())
        lines.append("")
        cursor = end
    return "\n".join(lines)


def write_srt(board: Storyboard, path: str) -> str:
    with open(path, "w", encoding="utf-8") as f:
        f.write(build_srt(board))
    return path
