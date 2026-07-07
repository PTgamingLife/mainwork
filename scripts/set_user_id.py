"""
快速設定你的 LINE User ID。

取得 User ID 方法：
1. 到 https://developers.line.biz/console/
2. 選擇 Channel → Basic settings → Your user ID (U開頭)

執行：python scripts/set_user_id.py
"""
import os
import sys
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from src.database import set_line_user_id, get_line_user_id

current = get_line_user_id()
print(f"目前儲存的 User ID: {current or '(未設定)'}")
print()

user_id = input("請輸入你的 LINE User ID (U開頭，或按 Enter 跳過): ").strip()

if not user_id:
    print("已跳過。")
    sys.exit(0)

if not re.match(r'^U[a-f0-9]{32}$', user_id):
    print("格式不對，User ID 應為 U 開頭後跟 32 個英數字。")
    sys.exit(1)

set_line_user_id(user_id)
print(f"已儲存 User ID: {user_id}")
print()

# 更新 .env 檔案
env_path = ROOT / "config" / ".env"
content = env_path.read_text(encoding="utf-8")
if "LINE_USER_ID=" in content:
    lines = content.split("\n")
    lines = [f"LINE_USER_ID={user_id}" if l.startswith("LINE_USER_ID=") else l for l in lines]
    env_path.write_text("\n".join(lines), encoding="utf-8")
    print(".env 檔案已更新")

confirm = input("要立即發送測試訊息到你的 LINE 嗎？(y/N): ").strip().lower()
if confirm == "y":
    os.environ["LINE_USER_ID"] = user_id
    from scripts.run_daily import run
    run(test_mode=False)
