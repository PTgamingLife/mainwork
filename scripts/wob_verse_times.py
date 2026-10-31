"""wob_verse_times：用語音辨識抓《Wheels on the Bus》每段歌詞的開始時間。

在自己電腦執行（Windows PowerShell）：
    pip install faster-whisper
    python scripts/wob_verse_times.py "C:\\路徑\\The_Wheels_On_The_Bus.mp3"

    # 想快一點可換小模型（較快、較不準）
    python scripts/wob_verse_times.py "歌.mp3" --model small.en

第一次執行會自動下載模型（medium.en 約 1.5GB）。
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


def wob_hit(text):
    """回傳 (key, 是否完整句)。同時命中多個時取最先出現的關鍵字；
    完整句 = 關鍵字後面還有動作（go/goes/say…），不是只有一句「the wheels on the bus」。"""
    low = text.lower()
    hits = []
    for key, pat in WOB_KEYWORDS:
        m = re.search(pat, low)
        if m:
            hits.append((m.start(), key))
    if not hits:
        return None, False
    key = min(hits)[1]
    # 模型常在間奏幻聽出「the wheels on the bus」，只有主詞沒有動作的不算數
    bare = re.fullmatch(r"\W*the \w+ on the bus\W*", low) is not None
    return key, not bare


def wob_lines(words, gap=1.2):
    """words: [(start, end, word)] → 依句尾標點或停頓切成一行一行 [(start, end, text)]。"""
    lines, cur = [], []
    for i, (start, end, word) in enumerate(words):
        cur.append((start, end, word))
        nxt = words[i + 1][0] if i + 1 < len(words) else None
        # 「…on the bus, the horn on the bus…」：前半是幻聽的殘句，從第二個 the 另起一行
        restart = (nxt is not None and word.strip().lower() == "bus,"
                   and words[i + 1][2].strip().lower() == "the")
        if re.search(r"[.!?]$", word.strip()) or nxt is None or nxt - end > gap or restart:
            lines.append((cur[0][0], cur[-1][1], "".join(w for _, _, w in cur).strip()))
            cur = []
    return lines


def wob_find_verses(lines):
    """lines: [(start, end, text)]。關鍵字換了就算新的一段；
    沒有關鍵字的句子（例如 all through the town）跟著前一段。"""
    verses = []
    current = None
    for start, _end, text in lines:
        key, full = wob_hit(text)
        if not key or not full or key == current:
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
        vad_filter=False, word_timestamps=True, condition_on_previous_text=False,
    )
    words = [(w.start, w.end, w.word) for s in segs for w in (s.words or [])]
    return wob_lines(words), info.duration


def main():
    ap = argparse.ArgumentParser(description="抓 Wheels on the Bus 段落時間")
    ap.add_argument("audio", help="歌曲音檔路徑（mp3/m4a/wav）")
    ap.add_argument("--model", default="medium.en", help="tiny.en / base.en / small.en / medium.en")
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
