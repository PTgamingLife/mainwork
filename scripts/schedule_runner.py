"""
Continuous scheduler — runs the daily bot at the configured time.

Usage: python scripts/schedule_runner.py

Keep this running in the background (or use Windows Task Scheduler instead).
Windows Task Scheduler setup: see README at the bottom of this file.
"""
import os
import sys
import schedule
import time
import logging
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "scheduler.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)

SEND_HOUR = int(os.environ.get("BOT_SEND_HOUR", "8"))
SEND_MINUTE = int(os.environ.get("BOT_SEND_MINUTE", "0"))
SEND_TIME = f"{SEND_HOUR:02d}:{SEND_MINUTE:02d}"


def run_job():
    log.info(f"Scheduled job triggered at {datetime.now().strftime('%H:%M:%S')}")
    from scripts.run_daily import run
    try:
        run(test_mode=False)
    except Exception as e:
        log.error(f"Job failed: {e}", exc_info=True)


def main():
    log.info("=" * 50)
    log.info(f"  排程啟動 - 每天 {SEND_TIME} 發送")
    log.info("=" * 50)

    schedule.every().day.at(SEND_TIME).do(run_job)

    log.info(f"下次發送時間: {schedule.next_run()}")
    log.info("按 Ctrl+C 停止排程")

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()


# ============================================================
# Windows Task Scheduler 設定方式（替代方案）
# ============================================================
#
# 如果想用 Windows 內建排程器（更穩定），執行以下步驟：
#
# 1. 開啟「工作排程器」(Task Scheduler)
# 2. 點選「建立基本工作」
# 3. 名稱：AI健康管理室每日發送
# 4. 觸發條件：每天
# 5. 開始時間：08:00
# 6. 動作：啟動程式
# 7. 程式：python
# 8. 引數：C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code\scripts\run_daily.py
# 9. 完成
#
# 或在 PowerShell 執行以下命令自動建立：
#
# $action = New-ScheduledTaskAction -Execute "python" `
#     -Argument "C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code\scripts\run_daily.py"
# $trigger = New-ScheduledTaskTrigger -Daily -At "08:00AM"
# Register-ScheduledTask -TaskName "AI健康管理室" -Action $action -Trigger $trigger
# ============================================================
