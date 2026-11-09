"""建立假資料供網頁測試用。請設定 LF_DB 指到測試資料庫,不要覆蓋真實資料。

    $env:LF_DB = "$env:TEMP\\lf_test.db"; python tests\\lf_seed_demo.py
"""
import datetime as dt
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
if "LF_DB" not in os.environ:
    sys.exit("請先設定 LF_DB 環境變數(測試資料庫路徑)")

from lf_db import lf_exec, lf_init_db, lf_save_messages, lf_upsert_friend  # noqa: E402
from lf_rules import lf_run_rules  # noqa: E402

random.seed(7)
lf_init_db()
names = ["王小明", "陳媽媽", "林經理", "張老師", "李大華", "黃美玲", "吳建宏", "周小姐",
         "鄭先生", "謝阿姨", "許同學", "劉總監", "楊小芬", "蔡志明", "郭家豪"]
status = ["保險規劃找我", "今天也要加油", "", "AI 課程學員", "業務經理", "退休生活", ""]
texts = ["最近好嗎?", "下週有空喝咖啡嗎", "謝謝你上次的建議", "課程什麼時候開始?",
         "保單的部分我再想想", "好的沒問題", "生日快樂!", "報價單收到了"]
now = dt.datetime.now()
for i, n in enumerate(names):
    last = now - dt.timedelta(days=random.choice([1, 3, 20, 90, 400, 800]))
    fid = lf_upsert_friend(n, status_msg=random.choice(status), in_chatlist=1,
                           last_chat_at=last.isoformat(timespec="minutes"))
    msgs = [{"sent_at": (last - dt.timedelta(hours=h)).isoformat(timespec="minutes"),
             "sender": random.choice(["me", "them"]), "content": random.choice(texts)}
            for h in range(10)]
    lf_save_messages(fid, msgs, keep=10)
lf_exec("INSERT OR IGNORE INTO lf_rules(field,pattern,category) VALUES('name','媽,爸,阿姨','家人')")
lf_exec("INSERT OR IGNORE INTO lf_tags(name,color,rule_type,rule_value) VALUES('保險','#E3C4B8','keyword','保險,保單')")
print("seeded", lf_run_rules())
