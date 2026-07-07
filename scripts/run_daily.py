"""
Daily bot runner — generates 6-slide IG carousel + text and sends via LINE.
Usage:
  python scripts/run_daily.py          # Full run (generates + sends)
  python scripts/run_daily.py --test   # Preview text only, no LINE send
  python scripts/run_daily.py --day N  # Override day number
"""
import os
import sys
import io
import logging
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

# Fix Windows console encoding for Chinese characters
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from src.content_generator import generate_daily_content, generate_carousel_prompts, get_theme
from src.image_generator import generate_carousel
from src.line_sender import send_carousel
from src.database import get_day_number, increment_day, get_line_user_id, save_message_log

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "bot.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)


def parse_args():
    test = "--test" in sys.argv
    day_override = None
    if "--day" in sys.argv:
        idx = sys.argv.index("--day")
        if idx + 1 < len(sys.argv):
            day_override = int(sys.argv[idx + 1])
    return test, day_override


def run(test_mode: bool = False, day_override: int = None):
    log.info("=" * 45)
    log.info(f"老婆叫我別再跟 AI 聊天 — 每日輪播啟動 {'[TEST]' if test_mode else ''}")
    log.info("=" * 45)

    day_number = day_override or get_day_number()
    today = datetime.now().strftime("%Y-%m-%d")
    theme = get_theme(day_number)

    log.info(f"第 {day_number} 天 ({today}) | 主題：{theme['emoji']} {theme['name']}")

    user_id = get_line_user_id() or os.environ.get("LINE_USER_ID", "").strip() or None

    # Step 1: Generate text content
    log.info("生成今日文字訊息...")
    try:
        text = generate_daily_content(day_number)
        log.info(f"文字完成（{len(text)} 字）")
    except Exception as e:
        log.error(f"文字生成失敗: {e}")
        return

    # Step 2: Generate 6 carousel image prompts
    log.info("建立 6 張輪播圖 prompts...")
    try:
        prompts = generate_carousel_prompts(day_number, text)
        log.info(f"Prompts 就緒（{len(prompts)} 張）")
    except Exception as e:
        log.error(f"Prompt 生成失敗: {e}")
        prompts = []

    # Step 3: Generate and upload 6 images (skip in test mode)
    image_urls = []
    if prompts and not test_mode:
        log.info("開始生成 6 張 AI 圖片（需要約 2-3 分鐘）...")
        image_urls = generate_carousel(prompts, day_number)
        success = sum(1 for u in image_urls if u)
        log.info(f"圖片完成：{success}/6 張上傳成功")

    # Test mode: print preview
    if test_mode:
        print("\n" + "=" * 50)
        print("【預覽 — 不會發送到 LINE，不會生成圖片】")
        print("=" * 50)
        print(text)
        print(f"\n6 張輪播圖 Prompts：")
        for i, p in enumerate(prompts, 1):
            print(f"\n  [Slide {i}]")
            print(f"  {p[:120]}...")
        print("=" * 50)
        return

    # Step 4: Send to LINE
    status = "failed"
    try:
        send_carousel(user_id, text, image_urls)
        status = "sent"
        log.info("LINE 推播成功！")
    except Exception as e:
        log.error(f"LINE 發送失敗: {e}")

    # Step 5: Save log
    save_message_log(today, day_number, text, ",".join(u or "" for u in image_urls), status)

    if status == "sent":
        increment_day()
        log.info(f"天數更新：第 {day_number + 1} 天")

    log.info("本日任務完成。")


if __name__ == "__main__":
    test, day_override = parse_args()
    run(test_mode=test, day_override=day_override)
