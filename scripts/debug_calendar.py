"""Debug: list all iCloud calendars and tomorrow's events."""
import os, sys
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

import caldav

TZ = ZoneInfo("Asia/Taipei")
tomorrow = datetime.now(TZ) + timedelta(days=1)
start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=0)

print(f"查詢日期：{start.strftime('%Y-%m-%d')} (台灣時間)")

client = caldav.DAVClient(
    url="https://caldav.icloud.com",
    username=os.environ["APPLE_ID"],
    password=os.environ["APPLE_APP_PASSWORD"],
)
principal = client.principal()
calendars = principal.calendars()
print(f"\n找到 {len(calendars)} 個日曆：")

for i, cal in enumerate(calendars):
    try:
        name = cal.name or f"日曆{i}"
        print(f"\n[{i+1}] {name}")
        events = cal.search(start=start, end=end, event=True, expand=True)
        if events:
            for e in events:
                v = e.vobject_instance.vevent
                summary = str(v.summary.value) if hasattr(v, "summary") else "無標題"
                dtstart = v.dtstart.value
                print(f"    ✅ {dtstart} — {summary}")
        else:
            print("    （無行程）")
    except Exception as ex:
        print(f"    ❌ 錯誤: {ex}")
