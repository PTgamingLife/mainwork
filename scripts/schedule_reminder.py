"""
Daily Schedule Reminder — runs at 22:00 Taiwan time via GitHub Actions.
Fetches tomorrow's iCloud (CalDAV) events, generates reminders with GPT-4o,
sends via LINE.
"""
import os
import sys
import io
import logging
from pathlib import Path
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

import caldav
from openai import OpenAI
from src.database import get_line_target
from src.line_sender import _push, _broadcast

TZ = ZoneInfo("Asia/Taipei")

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "reminder.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


def _get_tomorrow_events() -> list[dict]:
    apple_id = os.environ["APPLE_ID"]
    app_password = os.environ["APPLE_APP_PASSWORD"]

    tomorrow = datetime.now(TZ) + timedelta(days=1)
    start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=0)

    client = caldav.DAVClient(
        url="https://caldav.icloud.com",
        username=apple_id,
        password=app_password,
    )
    principal = client.principal()
    calendars = principal.calendars()
    log.info(f"找到 {len(calendars)} 個日曆")

    all_events = []
    seen = set()
    for cal in calendars:
        try:
            events = cal.search(start=start, end=end, event=True, expand=True)
            for e in events:
                summary = str(e.vobject_instance.vevent.summary.value) if hasattr(e.vobject_instance.vevent, "summary") else "（無標題）"
                vevent = e.vobject_instance.vevent

                dtstart = vevent.dtstart.value
                if isinstance(dtstart, datetime):
                    dtstart = dtstart.astimezone(TZ)
                    time_str = dtstart.strftime("%H:%M")
                else:
                    time_str = "全天"

                location = str(vevent.location.value) if hasattr(vevent, "location") else ""
                description = str(vevent.description.value)[:150] if hasattr(vevent, "description") else ""

                uid = str(vevent.uid.value) if hasattr(vevent, "uid") else summary
                if uid not in seen:
                    seen.add(uid)
                    all_events.append({
                        "time": time_str,
                        "name": summary,
                        "location": location,
                        "description": description,
                        "_sort": dtstart if isinstance(dtstart, datetime) else datetime.combine(dtstart, datetime.min.time(), tzinfo=TZ),
                    })
        except Exception as ex:
            log.warning(f"日曆讀取失敗: {ex}")

    all_events.sort(key=lambda e: e["_sort"])
    return all_events


def _generate_reminder(events: list[dict]) -> str:
    tomorrow = (datetime.now(TZ) + timedelta(days=1)).strftime("%m/%d (%a)")

    if not events:
        return (
            f"📅 明天行程提醒（{tomorrow}）\n"
            "━━━━━━━━━━━━━━\n"
            "明天沒有行程安排 🎉\n"
            "可以好好休息，或提前規劃下週！"
        )

    events_text = "\n".join([
        f"• {e['time']}  {e['name']}"
        + (f"  📍{e['location']}" if e["location"] else "")
        + (f"\n  備註：{e['description']}" if e["description"] else "")
        for e in events
    ])

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    prompt = f"""明天（{tomorrow}）的行程：
{events_text}

請以下面格式整理，繁體中文，簡潔實用：

📅 明天行程提醒（{tomorrow}）
━━━━━━━━━━━━━━
（逐條列出每個行程的時間、名稱，並給 1-2 條具體注意事項，例如：提前幾分鐘出門、要帶什麼、要確認什麼）
━━━━━━━━━━━━━━
（一句簡短的加油語）

規則：每條注意事項不超過 25 字，總字數不超過 350 字，實用不廢話。"""

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.6,
    )
    return resp.choices[0].message.content.strip()


def run():
    log.info("開始撈取明天行程...")
    try:
        events = _get_tomorrow_events()
        log.info(f"取得 {len(events)} 個行程")

        reminder = _generate_reminder(events)
        log.info("提醒文字生成完成")

        target = get_line_target()
        msgs = [{"type": "text", "text": reminder}]
        if target:
            _push(target, msgs)
        else:
            _broadcast(msgs)

        log.info("行程提醒已發送 ✅")

    except Exception as e:
        log.error(f"發送失敗: {e}")
        raise


if __name__ == "__main__":
    run()
