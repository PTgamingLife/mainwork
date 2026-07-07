"""
Setup script: Initialize Supabase tables and storage bucket.

Step 1: Run the SQL below in your Supabase SQL Editor
        (https://supabase.com/dashboard/project/hhcubvixldieuwdeqnwc/sql)
Step 2: Run this script: python scripts/setup_db.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "config" / ".env")

from src.image_generator import ensure_bucket
from src.database import init_tables_sql, set_config, get_config
from src.line_sender import verify_token


SETUP_SQL = """
-- 複製這段 SQL 到 Supabase SQL Editor 執行：
-- https://supabase.com/dashboard/project/hhcubvixldieuwdeqnwc/sql

CREATE TABLE IF NOT EXISTS daily_messages (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    day_number INTEGER NOT NULL,
    text_content TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'sent',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO bot_config (key, value) VALUES ('day_counter', '1')
ON CONFLICT (key) DO NOTHING;
"""


def main():
    print("=" * 50)
    print("  AI健康管理室機器人 - 初始化設定")
    print("=" * 50)

    # Print SQL for manual execution
    print("\n【第一步】請先在 Supabase SQL Editor 執行以下 SQL：")
    print(SETUP_SQL)
    print("-" * 50)

    input("完成後按 Enter 繼續...")

    # Create storage bucket
    print("\n[1/3] 建立 Supabase Storage bucket...")
    try:
        ensure_bucket()
        print("    ✅ Storage bucket 就緒")
    except Exception as e:
        print(f"    ⚠️  {e}")

    # Test DB connection
    print("\n[2/3] 測試資料庫連線...")
    try:
        val = get_config("day_counter", None)
        if val is not None:
            print(f"    ✅ 資料庫連線成功，當前天數：第 {val} 天")
        else:
            print("    ⚠️  請確認已執行上方 SQL 建立 bot_config 資料表")
    except Exception as e:
        print(f"    ❌ 資料庫連線失敗：{e}")

    # Test LINE token
    print("\n[3/3] 測試 LINE Channel Access Token...")
    if verify_token():
        print("    ✅ LINE Token 有效")
    else:
        print("    ❌ LINE Token 無效，請確認 config/.env 設定")

    print("\n" + "=" * 50)
    print("  初始化完成！")
    print("\n接下來的步驟：")
    print("1. 確保你的 LINE 帳號已加入「AI健康管理室」為好友")
    print("2. 執行: python scripts/webhook_server.py")
    print("   然後對 bot 傳送任意訊息，系統會自動取得你的 User ID")
    print("3. 或手動填入 config/.env 的 LINE_USER_ID")
    print("4. 執行每日測試: python scripts/run_daily.py")
    print("5. 啟動自動排程: python scripts/schedule_runner.py")
    print("=" * 50)


if __name__ == "__main__":
    main()
