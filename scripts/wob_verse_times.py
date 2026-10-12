"""wob_verse_times：用語音辨識抓《Wheels on the Bus》每段歌詞的開始時間。

在自己電腦執行（Windows PowerShell）：
    pip install faster-whisper
    python scripts/wob_verse_times.py "C:\\路徑\\The_Wheels_On_The_Bus.mp3"

    # 抓不準時換大一點的模型（較慢、較準）
    python scripts/wob_verse_times.py "歌.mp3" --model medium.en

第一次執行會自動下載模型（small.en 約 500MB）。
輸出最後的「貼給 Claude」那段，複製回對話即可。
"""
import argparse
import json
import re
import sys

# 段落關鍵字 → wob-bus.js 的 key
WOB_KEYWORDS = [
    ("wheels", r"\bwheels?\b"),
    ("wipers", r"\bwipers?\b|\bswish"),
    ("horn", r"\bhorns?\b|\bbeep"),
    ("doors", r"\bdoors?\b"),
    ("babies", r"\bbab(y|ies)\b|\bwah\b"),
    ("mommies", r"\bmomm(y|ies)\b|\bmumm(y|ies)\b|\bmoms?\b|\bshh+\b"),
    ("daddies", r"\bdadd(y|ies)\b|\bdads?\b|\blove you\b"),
    ("driver", r"\bdrivers?\b|\bmove on back\b"),
    ("people", r"\bpeople\b|\bup and down\b"),
    ("money", r"\bmoney\b|\bclink\b"),
    ("animals", r"\b(dogs?|cats?|cows?|ducks?|animals?)\b"),
]

# 給模型的提示，讓它偏向辨識成這首歌的歌詞
WOB_PROMPT = (
    "The wheels on the bus go round and round. The wipers on the bus go swish swish swish. "
    "The horn on the bus goes beep beep beep. The doors on the bus go open and shut. "
    "The babies on the bus go wah wah wah. The mommies on the bus go shh shh shh. "
    "The daddies on the bus say I love you. All through the town."
)


def wob_fmt(sec):
    return f"{int(sec // 60)}:{sec % 60:04.1f}"


def wob_key_of(text):
    """回傳這句歌詞屬於哪一段；同時命中多個時取最先出現的關鍵字。"""
    low = text.lower()
    hits = []
    for key, pat in WOB_KEYWORDS:
        m = re.search(pat, low)
        if m:
            hits.append((m.start(), key))
    return min(hits)[1] if hits else None


def wob_find_verses(segments):
    """segments: [(start, end, text)]。關鍵字換了就算新的一段；
    沒有關鍵字的句子（例如 all through the town）跟著前一段。"""
    verses = []
    current = None
    for start, _end, text in segments:
        key = wob_key_of(text)
        if not key or key == current:
            continue
        verses.append((key, start, text.strip()))
        current = key
    return verses


def wob_transcribe(path, model_name):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("找不到 faster-whisper，請先執行：pip install faster-whisper")
    print(f"載入模型 {model_name}（第一次會下載，請稍候）…", flush=True)
    model = WhisperModel(model_name, device="auto", compute_type="int8")
    print("辨識中…", flush=True)
    segs, info = model.transcribe(
        path, language="en", initial_prompt=WOB_PROMPT,
        vad_filter=False, word_timestamps=False, condition_on_previous_text=True,
    )
    out = [(s.start, s.end, s.text) for s in segs]
    return out, info.duration


def main():
    ap = argparse.ArgumentParser(description="抓 Wheels on the Bus 段落時間")
    ap.add_argument("audio", help="歌曲音檔路徑（mp3/m4a/wav）")
    ap.add_argument("--model", default="small.en", help="tiny.en / base.en / small.en / medium.en")
    args = ap.parse_args()

    segments, duration = wob_transcribe(args.audio, args.model)

    print("\n=== 辨識到的歌詞 ===")
    for start, _end, text in segments:
        print(f"{wob_fmt(start):>7}  {text.strip()}")

    verses = wob_find_verses(segments)
    print("\n=== 判斷出的段落 ===")
    for key, start, text in verses:
        print(f"{wob_fmt(start):>7}  {key:<8}  {text}")

    result = {
        "duration": round(duration, 2),
        "verses": [{"key": k, "t": round(t, 2)} for k, t, _ in verses],
    }
    print("\n=== 貼給 Claude（整段複製）===")
    print(json.dumps(result, ensure_ascii=False))
    print("\n提示：段落看起來不對時，把上面「辨識到的歌詞」也一起貼回來。")


if __name__ == "__main__":
    main()
