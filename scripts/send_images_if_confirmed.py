"""
Phase 2 — Image sender (runs every 2 minutes via Task Scheduler).
Checks for LINE group confirmation, then generates + sends each image one-by-one.
Images are sent to LINE immediately as each one is generated (reveal effect).
"""
import os
import sys
import io
import time
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

from src.database import (
    load_morning_cache, clear_morning_cache, check_confirmation_today,
    mark_images_sent, increment_day, get_line_target, save_message_log
)
from src.image_generator import _generate_one, _upload
from src.line_sender import _push, _broadcast, _image_msg

LOCK_FILE = ROOT / "config" / "generating.lock"

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "images.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


def _acquire_lock() -> bool:
    """Return True if lock acquired. False if already locked (or stale)."""
    if LOCK_FILE.exists():
        age_seconds = time.time() - LOCK_FILE.stat().st_mtime
        if age_seconds < 900:  # 15 min - still running
            return False
        LOCK_FILE.unlink()  # stale lock
    LOCK_FILE.write_text(datetime.now().isoformat(), encoding="utf-8")
    return True


def _release_lock():
    if LOCK_FILE.exists():
        LOCK_FILE.unlink()


def run():
    # --- Guard 1: Check pending cache ---
    cache = load_morning_cache()
    if not cache:
        return  # Nothing pending today

    day = cache["day_number"]
    text = cache["text"]
    prompts = cache.get("prompts", [])

    # --- Guard 2: Check confirmation ---
    if not check_confirmation_today(day):
        return  # Not confirmed yet

    # --- Guard 3: Prevent double execution ---
    if not _acquire_lock():
        log.info("已在生成中，略過本次排程")
        return

    today = datetime.now().strftime("%Y-%m-%d")
    log.info("=" * 50)
    log.info(f"Phase 2 — 收到確認！開始生成 6 張輪播圖 [Day {day}]")
    log.info("=" * 50)

    target = get_line_target()
    today_fmt = datetime.now().strftime("%Y%m%d")
    image_urls = []

    try:
        for i, prompt in enumerate(prompts, start=1):
            log.info(f"生成 Slide {i}/6...")
            try:
                img_bytes = _generate_one(prompt)
                file_path = f"carousel/day_{day:04d}_{today_fmt}_slide{i}.png"
                url = _upload(img_bytes, file_path)
                image_urls.append(url)
                log.info(f"Slide {i} 上傳完成，發送到 LINE...")

                # Send this slide immediately
                msg = [_image_msg(url)]
                if target:
                    _push(target, msg)
                else:
                    _broadcast(msg)
                log.info(f"Slide {i}/6 已送出 ✅")

            except Exception as e:
                log.error(f"Slide {i} 失敗: {e}")
                image_urls.append(None)

        success = sum(1 for u in image_urls if u)
        log.info(f"完成！{success}/6 張輪播圖已發送到 LINE")

        # Send closing summary
        summary = f"🎉 今日 6 張輪播圖發送完畢！\n\n存起來慢慢看 💾\n私訊「課程」了解更多 📩"
        msg_summary = [{"type": "text", "text": summary}]
        try:
            if target:
                _push(target, msg_summary)
            else:
                _broadcast(msg_summary)
        except Exception:
            pass

        # Update state
        mark_images_sent(day)
        save_message_log(today, day, text, ",".join(u or "" for u in image_urls), "sent")
        increment_day()
        clear_morning_cache()
        log.info(f"天數更新 → Day {day + 1}")

    finally:
        _release_lock()


if __name__ == "__main__":
    run()
