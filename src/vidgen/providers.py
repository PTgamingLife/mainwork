"""
可插拔的外部能力 provider。

兩種能力:
  · VoiceProvider —— 文字轉成「你的聲音」(商用 voice-clone API)。
  · BrollProvider —— 文字/圖片轉成 B-roll 影片片段。

每種都有:
  · 一個抽象基底(定義 pipeline 依賴的介面)
  · 一個 Mock 實作(用 ffmpeg 產生佔位素材,沒有 API key 也能跑完整流程、驗證合成)
  · 真實實作(ElevenLabs 語音已實作;B-roll 留清楚的接點)

透過環境變數選擇:
  VIDGEN_VOICE_PROVIDER = mock | elevenlabs
  VIDGEN_BROLL_PROVIDER = mock | http
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod

import requests

from . import ffmpeg_utils as ff
from .schema import Shot, Storyboard

# 依語速估算 mock 旁白長度(中文約每秒 4.5 字),也用來給真實 provider 當參考。
CHARS_PER_SEC = 4.5
MIN_SHOT_SEC = 1.5


# =========================================================================
# 語音 provider
# =========================================================================
class VoiceProvider(ABC):
    """把一段文字念成你的聲音,輸出音檔路徑。"""

    @abstractmethod
    def synthesize(self, text: str, emotion: str, out_path: str) -> str:
        """產生音檔,回傳實際路徑。"""


class MockVoiceProvider(VoiceProvider):
    """產生與字數等長的靜音 wav,讓 pipeline 在無 API key 下跑通並驗證時間軸。"""

    def synthesize(self, text: str, emotion: str, out_path: str) -> str:
        seconds = max(MIN_SHOT_SEC, len(text.strip()) / CHARS_PER_SEC)
        ff.run([
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", f"anullsrc=channel_layout=stereo:sample_rate=44100",
            "-t", f"{seconds:.2f}", "-c:a", "pcm_s16le", out_path,
        ])
        return out_path


class ElevenLabsVoiceProvider(VoiceProvider):
    """ElevenLabs voice-clone。需先在 ElevenLabs 用你的乾淨人聲建立 voice,取得 voice_id。

    環境變數:
      ELEVENLABS_API_KEY
      ELEVENLABS_VOICE_ID
      ELEVENLABS_MODEL(預設 eleven_multilingual_v2,支援中文)
    """

    BASE = "https://api.elevenlabs.io/v1"

    # 情緒 → 語音風格參數。voice-clone 的「情緒」主要靠 stability/style 調整,
    # 細緻語氣最終仍取決於你錄製的素材是否涵蓋該情緒。
    _EMOTION_SETTINGS = {
        "neutral":  {"stability": 0.5, "style": 0.0},
        "happy":    {"stability": 0.35, "style": 0.45},
        "excited":  {"stability": 0.25, "style": 0.65},
        "serious":  {"stability": 0.65, "style": 0.1},
        "sad":      {"stability": 0.6, "style": 0.2},
        "angry":    {"stability": 0.3, "style": 0.6},
        "curious":  {"stability": 0.4, "style": 0.4},
    }

    def __init__(self) -> None:
        self.api_key = os.environ["ELEVENLABS_API_KEY"]
        self.voice_id = os.environ["ELEVENLABS_VOICE_ID"]
        self.model = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")

    def synthesize(self, text: str, emotion: str, out_path: str) -> str:
        settings = self._EMOTION_SETTINGS.get(emotion, self._EMOTION_SETTINGS["neutral"])
        resp = requests.post(
            f"{self.BASE}/text-to-speech/{self.voice_id}",
            headers={"xi-api-key": self.api_key, "accept": "audio/mpeg"},
            json={
                "text": text,
                "model_id": self.model,
                "voice_settings": {
                    "stability": settings["stability"],
                    "similarity_boost": 0.85,
                    "style": settings["style"],
                },
            },
            timeout=120,
        )
        resp.raise_for_status()
        # ElevenLabs 回傳 mp3;先存檔,後續合成階段再統一轉碼。
        mp3_path = out_path.rsplit(".", 1)[0] + ".mp3"
        with open(mp3_path, "wb") as f:
            f.write(resp.content)
        return mp3_path


def get_voice_provider() -> VoiceProvider:
    name = os.environ.get("VIDGEN_VOICE_PROVIDER", "mock").lower()
    if name == "elevenlabs":
        return ElevenLabsVoiceProvider()
    if name == "mock":
        return MockVoiceProvider()
    raise ValueError(f"未知的 VIDGEN_VOICE_PROVIDER:{name}")


# =========================================================================
# B-roll provider
# =========================================================================
class BrollProvider(ABC):
    """產生一段指定長度的 B-roll / 背景影片片段,輸出影片路徑。"""

    @abstractmethod
    def make_clip(self, shot: Shot, board: Storyboard, duration: float, out_path: str) -> str:
        ...


class MockBrollProvider(BrollProvider):
    """用 ffmpeg 產生純色 + 鏡頭編號的佔位影片,驗證合成與時間軸。"""

    def make_clip(self, shot: Shot, board: Storyboard, duration: float, out_path: str) -> str:
        width, height = _resolution(board.aspect_ratio)
        color = shot.color if shot.visual_kind == "color" else "#12203a"
        ff.run([
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", f"color=c={color}:s={width}x{height}:r=30",
            "-t", f"{duration:.2f}",
            "-vf", f"drawtext=text='shot {shot.index}':fontcolor=white:fontsize=48:"
                   f"x=(w-text_w)/2:y=(h-text_h)/2",
            *ff.HQ_VIDEO_ARGS, out_path,
        ])
        return out_path


class HttpBrollProvider(BrollProvider):
    """通用 HTTP 接點:給 Seedance / Higgsfield 等 text-to-video API 用。

    這裡留成需要你填上實際 API 規格的接點(各家 request/poll 流程不同)。
    填好 _submit() 與 _download() 即可。Mock 之外要真生成 B-roll,就實作這個。
    """

    def __init__(self) -> None:
        self.endpoint = os.environ.get("VIDGEN_BROLL_ENDPOINT", "")
        self.api_key = os.environ.get("VIDGEN_BROLL_API_KEY", "")

    def make_clip(self, shot: Shot, board: Storyboard, duration: float, out_path: str) -> str:
        if shot.visual_kind == "background" and shot.background_ref:
            # 你提供的背景圖 → 用 ffmpeg 做成靜態/緩動的片段(不需呼叫外部 API)。
            return _still_image_clip(shot.background_ref, board.aspect_ratio, duration, out_path)
        raise NotImplementedError(
            "HttpBrollProvider 尚未接上實際的 text-to-video API。\n"
            "請實作對 Seedance / Higgsfield 等服務的提交與下載流程,"
            "把生成的影片存到 out_path。提示詞用 shot.broll_prompt,"
            "長度盡量貼近 duration(秒)。"
        )


def get_broll_provider() -> BrollProvider:
    name = os.environ.get("VIDGEN_BROLL_PROVIDER", "mock").lower()
    if name == "http":
        return HttpBrollProvider()
    if name == "mock":
        return MockBrollProvider()
    raise ValueError(f"未知的 VIDGEN_BROLL_PROVIDER:{name}")


# =========================================================================
# 共用工具
# =========================================================================
def _resolution(aspect_ratio: str) -> tuple[int, int]:
    return {
        "9:16": (1080, 1920),
        "16:9": (1920, 1080),
        "1:1": (1080, 1080),
        "4:5": (1080, 1350),
    }.get(aspect_ratio, (1080, 1920))


def _still_image_clip(image_path: str, aspect_ratio: str, duration: float, out_path: str) -> str:
    """把一張背景圖做成指定長度的影片片段(置中裁切到目標比例)。"""
    width, height = _resolution(aspect_ratio)
    ff.run([
        "ffmpeg", "-y", "-loop", "1", "-i", image_path,
        "-t", f"{duration:.2f}",
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,"
               f"crop={width}:{height},fps=30",
        *ff.HQ_VIDEO_ARGS, out_path,
    ])
    return out_path
