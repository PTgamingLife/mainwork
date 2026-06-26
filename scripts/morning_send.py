"""
Phase 1 — Morning text sender (runs at 7:00 AM via Task Scheduler).
Generates today's content, sends text to LINE group, saves cache for Phase 2.
"""
import os
import sys
import io
import logging
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from src.content_generator import generate_daily_content, generate_carousel_prompts, get_theme
from src.database import get_day_number, get_line_target, save_morning_cache, load_morning_cache
from src.line_sender import _push, _broadcast

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "morning.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


def run():
    today = datetime.now().strftime("%Y-%m-%d")
    log.info("=" * 50)
    log.info(f"Phase 1 — 早安推播 [{today}]")
    log.info("=" * 50)

    # Skip if already sent today
    existing = load_morning_cache()
    if existing and existing.get("status") == "pending":
        log.info(f"今天（{today}）已發送過文字，等待確認中，跳過重複發送")
        return

    day = get_day_number()
    theme = get_theme(day)
    target = get_line_target()
    log.info(f"Day {day} | 主題：{theme['emoji']} {theme['name']} | 目標：{target[:8] if target else 'None'}...")

    # Step 1: Generate text
    log.info("生成今日文字...")
    try:
        text = generate_daily_content(day)
        log.info(f"文字完成（{len(text)} 字）")
    except Exception as e:
        log.error(f"文字生成失敗: {e}")
        return

    # Step 2: Pre-generate prompts (no API cost, fast)
    try:
        prompts = generate_carousel_prompts(day, text)
        log.info(f"Prompts 就緒（{len(prompts)} 張）")
    except Exception as e:
        log.error(f"Prompt 生成失敗: {e}")
        prompts = []

    # Step 3: Send text to LINE
    # Append instruction at the end
    full_text = text + "\n\n---\n回覆「確認」即可發送 6 張輪播圖 ✅"
    msgs = [{"type": "text", "text": full_text}]
    try:
        if target:
            _push(target, msgs)
        else:
            _broadcast(msgs)
        log.info("LINE 文字推播成功 ✅")
    except Exception as e:
        log.error(f"LINE 發送失敗: {e}")
        return

    # Step 4: Save cache for Phase 2
    save_morning_cache(day, text, prompts)
    log.info(f"暫存完成（等待群組確認）→ config/morning_cache.json")


if __name__ == "__main__":
    run()
