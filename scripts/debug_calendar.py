"""Debug: list all Google Calendar calendars and tomorrow's events."""
import os, sys, json
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

TZ = ZoneInfo("Asia/Taipei")
tomorrow = datetime.now(TZ) + timedelta(days=1)
start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=0)

print(f"查詢日期：{start.strftime('%Y-%m-%d')} (台灣時間)")

creds_data = json.loads(os.environ["GOOGLE_CREDENTIALS_JSON"])
creds = Credentials(
    token=creds_data.get("token", ""),
    refresh_token=creds_data["refresh_token"],
    token_uri=creds_data.get("token_uri", "https://oauth2.googleapis.com/token"),
    client_id=creds_data["client_id"],
    client_secret=creds_data["client_secret"],
    scopes=creds_data.get("scopes"),
)
if creds.expired or not creds.valid:
    creds.refresh(Request())

service = build("calendar", "v3", credentials=creds, cache_discovery=False)

cal_list = service.calendarList().list().execute()
items = cal_list.get("items", [])
print(f"\n找到 {len(items)} 個 Google 日曆：")

for cal in items:
    cal_id = cal["id"]
    name = cal.get("summary", cal_id)
    try:
        result = service.events().list(
            calendarId=cal_id,
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        events = result.get("items", [])
        if events:
            print(f"\n✅ [{name}]")
            for e in events:
                t = e["start"].get("dateTime", e["start"].get("date", ""))
                print(f"   {t}  {e.get('summary', '無標題')}")
        else:
            print(f"   [{name}] → 無行程")
    except Exception as ex:
        print(f"   [{name}] ❌ {ex}")
