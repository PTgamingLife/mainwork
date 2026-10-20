"""
vidgen — 文稿轉口播影片的生成 pipeline(第一階段)

第一階段範圍:文稿 →(你的聲音）旁白 + 自動字幕 + B-roll → 合成成片。
口播臉(對嘴）暫不包含,之後再以新的 provider 接上。

設計原則:
  · 導演層(director）用 LLM 把文稿切成「分鏡表」(storyboard)。
  · 語音、B-roll 都是可插拔的 provider,沒有 API key 時用 Mock 也能跑完整流程。
  · 合成(assemble）一律走 FFmpeg,微表情/細節相關的壓縮設定集中在這裡控制。
"""

from .schema import Shot, Storyboard
from .pipeline import build_video

__all__ = ["Shot", "Storyboard", "build_video"]
