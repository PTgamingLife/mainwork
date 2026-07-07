"""
Daily Schedule Reminder — runs at 22:00 Taiwan time via GitHub Actions.
Fetches tomorrow's Google Calendar events, generates reminders with GPT-4o,
sends via LINE.
"""
import os
import sys
import io
import json
import logging
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
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


def _get_calendar_service():
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON", "")
    if not creds_json:
        raise ValueError("GOOGLE_CREDENTIALS_JSON 未設定")
    creds_data = json.loads(creds_json)
    creds = Credentials(
        token=creds_data.get("token", ""),
        refresh_token=creds_data["refresh_token"],
        token_uri=creds_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=creds_data["client_id"],
        client_secret=creds_data["client_secret"],
        scopes=creds_data.get("scopes", ["https://www.googleapis.com/auth/calendar.readonly"]),
    )
    if creds.expired or not creds.valid:
        creds.refresh(Request())
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _get_tomorrow_events() -> list[dict]:
    service = _get_calendar_service()
    tomorrow = datetime.now(TZ) + timedelta(days=1)
    start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=0)

    # Fetch from all calendars the user can access
    cal_list = service.calendarList().list().execute()
    cal_ids = [c["id"] for c in cal_list.get("items", [])]

    all_events = []
    seen = set()
    for cal_id in cal_ids:
        try:
            result = service.events().list(
                calendarId=cal_id,
                timeMin=start.isoformat(),
                timeMax=end.isoformat(),
                singleEvents=True,
                orderBy="startTime",
            ).execute()
            for e in result.get("items", []):
                if e["id"] not in seen:
                    seen.add(e["id"])
                    all_events.append(e)
        except Exception:
            pass

    all_events.sort(key=lambda e: e["start"].get("dateTime", e["start"].get("date", "")))
    return all_events


def _format_event(event: dict) -> dict:
    start_raw = event["start"].get("dateTime", event["start"].get("date", ""))
    if "T" in start_raw:
        dt = datetime.fromisoformat(start_raw).astimezone(TZ)
        time_str = dt.strftime("%H:%M")
    else:
        time_str = "全天"
    return {
        "time": time_str,
        "name": event.get("summary", "（無標題）"),
        "location": event.get("location", ""),
        "description": (event.get("description", "") or "")[:150],
    }


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
        raw = _get_tomorrow_events()
        events = [_format_event(e) for e in raw]
        log.info(f"取得 {len(events)} 個行程")

        reminder = _generate_reminder(events)
        log.info("提醒文字生成完成")

        target = get_line_target()
        msgs = [{"type": "text", "text": reminder}]
        if target:
            _push(target, msgs)
        else:
            _broadcast(msgs)

        log.info(f"行程提醒已發送 ✅")

    except Exception as e:
        log.error(f"發送失敗: {e}")
        raise


if __name__ == "__main__":
    run()
