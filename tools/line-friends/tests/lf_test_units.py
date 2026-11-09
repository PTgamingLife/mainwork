"""lf_ 單元測試:日期解析、txt 匯入、規則分類、手動覆寫優先。需設定 LF_DB 指到測試資料庫。"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
assert os.environ.get("LF_DB"), "請設定 LF_DB"

from lf_parse import lf_parse_clock, lf_parse_date, lf_parse_list_time  # noqa: E402

T = dt.date(2026, 11, 9)  # 星期一
assert lf_parse_date("今天", T) == T
assert lf_parse_date("昨天", T) == dt.date(2026, 11, 8)
assert lf_parse_date("2025.10.03 星期五", T) == dt.date(2025, 10, 3)
assert lf_parse_date("11/05(四)", T) == dt.date(2026, 11, 5)
assert lf_parse_date("12/25", T) == dt.date(2025, 12, 25)
assert lf_parse_date("星期六", T) == dt.date(2026, 11, 7)
assert lf_parse_clock("下午 3:12") == (15, 12)
assert lf_parse_clock("上午12:05") == (0, 5)
assert lf_parse_clock("10:05 PM") == (22, 5)
assert lf_parse_list_time("下午 3:12", T) == "2026-11-09T15:12"
assert lf_parse_list_time("昨天", T) == "2026-11-08T00:00"

from lf_db import lf_get_friend, lf_get_messages, lf_init_db, lf_update_friend, lf_set_category_auto  # noqa: E402
from lf_import_txt import lf_import_text  # noqa: E402

lf_init_db()
txt = """﻿[LINE] 與測試阿明的聊天記錄
儲存日期:2026/11/09 10:00

2026/11/01(日)
上午10:00\t測試阿明\t你好
上午10:01\t我自己\t嗨!
下午3:20\t測試阿明\t"第一行
第二行"
2026/11/02(一)
上午9:00\t我自己\t早安
"""
r = lf_import_text(txt, "x.txt")
assert r["lf_name"] == "測試阿明" and r["lf_parsed"] == 4, r
m = lf_get_messages(r["lf_friend_id"])
assert m[0]["sender"] == "them" and m[1]["sender"] == "me", m
assert m[2]["sent_at"] == "2026-11-01T15:20" and "第二行" in m[2]["content"], m[2]
fid = r["lf_friend_id"]
lf_update_friend(fid, {"lf_category": "客戶"})
lf_set_category_auto(fid, ai={"lf_category": "朋友", "lf_summary": "s", "lf_next_action": "n"})
f = lf_get_friend(fid)
assert f["category"] == "客戶" and f["ai_category"] == "朋友", "手動覆寫應優先"
print("lf_test_units: all passed")
