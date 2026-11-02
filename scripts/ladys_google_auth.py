"""
LadyS — 一次性 Google 日曆授權(寫入權限,跟既有每日推播的唯讀 token 分開,互不影響)

使用方式(Windows PowerShell,在 repo 根目錄):
  1. pip install google-auth-oauthlib
  2. 把 Google Cloud Console 下載的 OAuth 用戶端(桌面應用程式)JSON 存成 credentials.json,
     放在 scripts/credentials.json(.gitignore 已排除,不會被 commit)
  3. python scripts/ladys_google_auth.py
  4. 瀏覽器登入「建立 LadyS 家庭日曆的那個 Google 帳號」並同意
  5. 複製輸出的那一行 JSON → Supabase → Edge Functions → Secrets
     名稱 LADYS_GOOGLE_CREDENTIALS_JSON,值貼上。不要貼到聊天或 commit。
"""
import json
import sys
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    print("請先安裝:pip install google-auth-oauthlib")
    sys.exit(1)

LADYS_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
here = Path(__file__).resolve().parent
ladys_creds = here / "credentials.json"
if not ladys_creds.exists():
    print("找不到 scripts/credentials.json")
    sys.exit(1)

flow = InstalledAppFlow.from_client_secrets_file(str(ladys_creds), LADYS_SCOPES)
# prompt=consent 確保一定拿到 refresh_token
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
if not creds.refresh_token:
    print("沒有拿到 refresh_token,請到 https://myaccount.google.com/permissions 移除此應用程式的授權後重跑")
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ 授權成功。把下面這一行貼到 Supabase Secret:LADYS_GOOGLE_CREDENTIALS_JSON")
print("=" * 60)
print(json.dumps({"client_id": creds.client_id, "client_secret": creds.client_secret, "refresh_token": creds.refresh_token}))
print("=" * 60)
