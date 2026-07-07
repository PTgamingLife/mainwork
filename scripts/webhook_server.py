"""
LINE Webhook Server — captures your personal LINE User ID.

Usage:
  1. python scripts/webhook_server.py
  2. Use ngrok to expose: ngrok http 5000
  3. Set the webhook URL in LINE Developers Console:
     https://developers.line.biz/console/
     Webhook URL: https://YOUR_NGROK_URL/webhook
  4. Send any message to the bot from your personal LINE
  5. Your User ID will be saved automatically and shown in the terminal
"""
import os
import sys
import hashlib
import hmac
import base64
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from flask import Flask, request, abort
from src.database import set_line_user_id, get_line_user_id

app = Flask(__name__)
CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET", "")


def verify_signature(body: bytes, signature: str) -> bool:
    hash_val = hmac.new(
        CHANNEL_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).digest()
    expected = base64.b64encode(hash_val).decode("utf-8")
    return hmac.compare_digest(expected, signature)


@app.route("/webhook", methods=["POST"])
def webhook():
    body = request.get_data()
    signature = request.headers.get("X-Line-Signature", "")

    if not verify_signature(body, signature):
        abort(400, "Invalid signature")

    events = json.loads(body).get("events", [])
    for event in events:
        source = event.get("source", {})
        user_id = source.get("userId")

        if user_id:
            existing = get_line_user_id()
            if existing != user_id:
                set_line_user_id(user_id)
                print(f"\n{'='*50}")
                print(f"✅ 已取得你的 LINE User ID！")
                print(f"   User ID: {user_id}")
                print(f"   已自動儲存到資料庫")
                print(f"{'='*50}\n")
            else:
                print(f"[Webhook] User ID 已存在: {user_id[:8]}...")

    return "OK", 200


@app.route("/health", methods=["GET"])
def health():
    uid = get_line_user_id()
    return {
        "status": "running",
        "line_user_id": uid[:8] + "..." if uid else "未設定",
        "channel_secret": "已設定" if CHANNEL_SECRET else "未設定"
    }


if __name__ == "__main__":
    print("=" * 50)
    print("  LINE Webhook Server 啟動中")
    print("=" * 50)
    uid = get_line_user_id()
    if uid:
        print(f"  目前已儲存的 User ID: {uid[:8]}...")
    else:
        print("  尚未取得 User ID")
    print("\n  步驟：")
    print("  1. 另開終端機執行: ngrok http 5000")
    print("  2. 複製 ngrok HTTPS URL")
    print("  3. 到 LINE Developers Console 設定 Webhook URL：")
    print("     https://YOUR_NGROK_URL/webhook")
    print("  4. 從你的個人 LINE 傳訊息給 AI健康管理室")
    print("  5. 看到 User ID 後即可關閉此 server")
    print("=" * 50)
    app.run(port=5000, debug=False)
