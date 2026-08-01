"""
Daily Roast — 每天三條直擊人心的建議，掛在 6AM LINE 提醒的同一個排程。

讀 daily-roast skill 的 SKILL.md 當規則、STATE.md 當事實、LOG.md 當昨天紀錄，
加上 household-finance/data.json 與近 7 天 git log，請 Claude 產出當天三條，
推到 LINE 並把該筆寫回 LOG.md。

用法:
    python scripts/daily_roast.py              # 產生 → 送 LINE → 寫回 LOG.md
    python scripts/daily_roast.py --stdout     # 只印出來，不送 LINE、不寫檔（本機測試）
    python scripts/daily_roast.py --no-log     # 送 LINE 但不寫回 LOG.md
"""
import os
import sys
import io
import argparse
import logging
import subprocess
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

import anthropic

TZ = ZoneInfo("Asia/Taipei")
SKILL_DIR = ROOT / ".claude" / "skills" / "daily-roast"
SKILL_MD = SKILL_DIR / "SKILL.md"
STATE_MD = SKILL_DIR / "STATE.md"
LOG_MD = SKILL_DIR / "LOG.md"
FINANCE_JSON = ROOT / "household-finance" / "data.json"

MODEL = "claude-sonnet-5"
MAX_TOKENS = 1600
LOG_TAIL_CHARS = 4000      # 只餵最近的紀錄，避免整份 LOG 一直長大
GIT_LOG_DAYS = 7

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


def _read(path: Path, tail_chars: int = 0) -> str:
    if not path.exists():
        return f"(檔案不存在: {path.relative_to(ROOT)})"
    text = path.read_text(encoding="utf-8")
    if tail_chars and len(text) > tail_chars:
        return "…(略過較舊的內容)…\n" + text[-tail_chars:]
    return text


def _git_context() -> str:
    """近 N 天的 commit 與被改動的資料夾 — 用來對照『說要做』vs『真的有做』。"""
    def _run(args: list[str]) -> str:
        try:
            return subprocess.run(
                args, cwd=ROOT, capture_output=True, text=True, timeout=30, check=False
            ).stdout.strip()
        except Exception as ex:  # git 不在或 repo 異常都不該擋住當天的建議
            log.warning(f"git 讀取失敗: {ex}")
            return ""

    since = f"--since={GIT_LOG_DAYS} days ago"
    commits = _run(["git", "log", since, "--pretty=%ad|%s", "--date=short"]) or "(近 7 天沒有任何 commit)"
    files = _run(["git", "log", since, "--name-only", "--pretty="])
    dirs: dict[str, int] = {}
    for line in files.splitlines():
        if line.strip():
            dirs[line.split("/")[0]] = dirs.get(line.split("/")[0], 0) + 1
    top = "\n".join(
        f"{n:>5}  {d}" for d, n in sorted(dirs.items(), key=lambda kv: -kv[1])[:15]
    ) or "(無檔案異動)"
    return f"### 近 {GIT_LOG_DAYS} 天 commit\n{commits}\n\n### 近 {GIT_LOG_DAYS} 天改動檔次（依目錄）\n{top}"


def build_prompt(today: str) -> tuple[str, str]:
    system = (
        _read(SKILL_MD)
        + "\n\n---\n"
        "你現在是在**自動排程**裡跑（每天早上 6 點，結果會直接推到使用者的 LINE），"
        "沒有人可以即時回答你的問題。所以：不要反問、不要說『需要你確認』就停住，"
        "拿現有證據直接給出三條。資訊不足的地方就把「去把這件事確認清楚」寫成當天的動作。\n"
        "輸出限制：純文字，不要用 Markdown 標題或程式碼區塊（LINE 不會渲染），"
        "全文 900 字以內，嚴格照 SKILL.md 的四行格式，三條為限。"
    )
    user = f"""今天是 {today}。以下是你能用的全部事實，請據此產出今天的三條。

===== STATE.md（專案 / 商業目標 / 計畫 / 財務現況）=====
{_read(STATE_MD)}

===== LOG.md（最近的每日紀錄，用來驗收昨天那三條）=====
{_read(LOG_MD, tail_chars=LOG_TAIL_CHARS)}

===== household-finance/data.json（財務原始資料）=====
{_read(FINANCE_JSON)}

===== git 活動 =====
{_git_context()}

請輸出：
第一行「📌 今日三箭（{today}）」，接著昨天驗收一行，然後三條（①專案 ②商業 ③財務），
最後一行「最低通關線：第 X 條 —— 理由一句」。
"""
    return system, user


def generate(today: str) -> str:
    system, user = build_prompt(today)
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    resp = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return resp.content[0].text.strip()


def send_line(text: str) -> None:
    from src.database import get_line_target
    from src.line_sender import _push, _broadcast

    msgs = [{"type": "text", "text": text[:4900]}]
    target = get_line_target()
    if target:
        _push(target, msgs)
    else:
        _broadcast(msgs)


def append_log(today: str, text: str) -> None:
    """把當天這筆插在 LOG.md 的『---』分隔線之後（最新的在最上面）。"""
    if not LOG_MD.exists():
        log.warning("LOG.md 不存在，略過寫檔")
        return
    content = LOG_MD.read_text(encoding="utf-8")
    if f"\n## {today}\n" in content:
        log.info(f"{today} 已有紀錄，不重複寫入")
        return
    entry = f"\n## {today}\n\n{text}\n"
    marker = "\n---\n"
    idx = content.find(marker)
    if idx == -1:
        content = content.rstrip() + "\n" + entry
    else:
        cut = idx + len(marker)
        content = content[:cut] + entry + content[cut:]
    LOG_MD.write_text(content, encoding="utf-8")
    log.info(f"已寫入 LOG.md（{today}）")


def run(to_stdout: bool = False, write_log: bool = True) -> None:
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    log.info(f"產生 {today} 的每日三箭...")
    text = generate(today)

    if to_stdout:
        print("\n" + text + "\n")
        return

    send_line(text)
    log.info("已推到 LINE ✅")
    if write_log:
        append_log(today, text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="每日三條 roast 式建議")
    parser.add_argument("--stdout", action="store_true", help="只印出來，不送 LINE、不寫檔")
    parser.add_argument("--no-log", action="store_true", help="不寫回 LOG.md")
    args = parser.parse_args()
    run(to_stdout=args.stdout, write_log=not args.no_log)
