"""
分鏡表資料模型。

一個 Storyboard 由多個 Shot 組成。每個 Shot 是「一段旁白 + 對應畫面」:
  · 旁白文字交給語音 provider 念成你的聲音。
  · 畫面可以是 B-roll(生成）、你提供的背景圖,或純色底。

第一階段沒有口播臉,所以每個 Shot 的視覺都是 B-roll / 背景,旁白只出現在聲音與字幕。
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict

# 視覺種類
VISUAL_BROLL = "broll"            # 用文字 prompt 生成 B-roll
VISUAL_BACKGROUND = "background"  # 用你提供的背景圖(image → video / 靜態）
VISUAL_COLOR = "color"            # 純色底(最低成本的 fallback)

# 允許的情緒標籤(對應語音 provider 的語氣控制；可自由擴充)
EMOTIONS = ("neutral", "happy", "excited", "serious", "sad", "angry", "curious")


@dataclass
class Shot:
    """單一鏡頭:一段旁白搭配一個畫面。"""

    index: int
    text: str                          # 這段要念出來的旁白(TTS 輸入)
    emotion: str = "neutral"           # 語氣標籤,影響語音 prosody
    visual_kind: str = VISUAL_BROLL    # broll | background | color
    broll_prompt: str = ""             # visual_kind == broll 時的畫面提示詞
    background_ref: str = ""           # visual_kind == background 時的背景圖路徑/識別碼
    color: str = "#0a0a1a"             # visual_kind == color 時的底色

    # 以下由 pipeline 執行時回填,不需在導演層產生
    duration_sec: float = 0.0          # 實際旁白音檔長度(由語音 provider 量測)
    audio_path: str = ""               # 旁白音檔路徑
    visual_path: str = ""              # 該鏡頭視覺片段路徑
    clip_path: str = ""                # 視覺 + 音訊合成後的單鏡頭片段

    def validate(self) -> None:
        if self.emotion not in EMOTIONS:
            raise ValueError(
                f"Shot {self.index} 的 emotion '{self.emotion}' 不在允許清單 {EMOTIONS}"
            )
        if self.visual_kind not in (VISUAL_BROLL, VISUAL_BACKGROUND, VISUAL_COLOR):
            raise ValueError(f"Shot {self.index} 的 visual_kind 不合法:{self.visual_kind}")
        if not self.text.strip():
            raise ValueError(f"Shot {self.index} 的旁白文字不可為空")


@dataclass
class Storyboard:
    """整支影片的分鏡表。"""

    title: str
    shots: list[Shot] = field(default_factory=list)
    # 全域風格,讓 B-roll 維持一致調性(色調、畫風關鍵字)
    visual_style: str = "cinematic, soft natural lighting, shallow depth of field"
    aspect_ratio: str = "9:16"         # 預設直式,適合短影音

    def validate(self) -> None:
        if not self.shots:
            raise ValueError("Storyboard 至少要有一個 Shot")
        for shot in self.shots:
            shot.validate()

    @property
    def total_duration(self) -> float:
        return sum(s.duration_sec for s in self.shots)

    # ---- 序列化:導演層輸出/落地存檔都用這組 ----

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)

    @classmethod
    def from_dict(cls, data: dict) -> "Storyboard":
        shots = [Shot(**s) for s in data.get("shots", [])]
        return cls(
            title=data["title"],
            shots=shots,
            visual_style=data.get("visual_style", cls.visual_style),
            aspect_ratio=data.get("aspect_ratio", "9:16"),
        )

    @classmethod
    def from_json(cls, text: str) -> "Storyboard":
        return cls.from_dict(json.loads(text))
