"""
一次性授權腳本 — 取得 Google Calendar refresh token。
執行一次後，把輸出的 JSON 存到 GitHub Secrets 的 GOOGLE_CREDENTIALS_JSON。

使用方式：
  1. 把從 Google Cloud Console 下載的 credentials.json 放到這個腳本同目錄
  2. 執行：python scripts/google_auth_setup.py
  3. 瀏覽器會自動開啟，登入你的 Google 帳號並授權
  4. 複製輸出的 JSON，貼到 GitHub Secrets → GOOGLE_CREDENTIALS_JSON
"""
import json
import sys
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    print("請先安裝：pip install google-auth-oauthlib")
    sys.exit(1)

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
CREDS_FILE = Path(__file__).parent / "credentials.json"

if not CREDS_FILE.exists():
    CREDS_FILE = Path(__file__).parent.parent / "credentials.json"

if not CREDS_FILE.exists():
    print("找不到 credentials.json！請把從 Google Cloud Console 下載的檔案放到 scripts/ 資料夾")
    sys.exit(1)

print("正在開啟瀏覽器進行 Google 授權...")
flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
creds = flow.run_local_server(port=0)

output = {
    "token": creds.token,
    "refresh_token": creds.refresh_token,
    "token_uri": creds.token_uri,
    "client_id": creds.client_id,
    "client_secret": creds.client_secret,
    "scopes": list(creds.scopes),
}

print("\n" + "=" * 60)
print("✅ 授權成功！複製以下 JSON 到 GitHub Secrets (GOOGLE_CREDENTIALS_JSON):")
print("=" * 60)
print(json.dumps(output, ensure_ascii=False))
print("=" * 60)
