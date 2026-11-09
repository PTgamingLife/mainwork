"""lf_ 匯入 LINE 官方「傳送聊天記錄」的 txt(中文/英文版)。"""
import re

from lf_db import lf_exec, lf_save_messages, lf_upsert_friend
from lf_parse import lf_combine, lf_parse_clock

_re_head = [re.compile(r"\[LINE\]\s*與(.+?)的聊天(記錄|紀錄)"),
            re.compile(r"\[LINE\]\s*Chat history with (.+)"),
            re.compile(r"\[LINE\]\s*(.+?)的聊天(記錄|紀錄)")]
_re_date = re.compile(r"^(\d{4})[/.](\d{1,2})[/.](\d{1,2})")
_re_msg = re.compile(r"^((?:上午|下午|中午|凌晨|晚上)?\s*\d{1,2}:\d{2}(?:\s*[AP]M)?)\t([^\t]*)\t?(.*)$")


def lf_parse_export(text: str, fallback_name: str = "") -> tuple[str, list[dict]]:
    text = text.lstrip("﻿")
    lines = text.splitlines()
    name = ""
    for ln in lines[:3]:
        for rx in _re_head:
            m = rx.search(ln)
            if m:
                name = m.group(1).strip()
                break
        if name:
            break
    name = name or fallback_name.strip()
    import datetime as _dt
    cur_date, msgs = None, []
    for ln in lines:
        m = _re_date.match(ln.strip())
        if m and "\t" not in ln:
            try:
                cur_date = _dt.date(int(m[1]), int(m[2]), int(m[3]))
            except ValueError:
                pass
            continue
        m = _re_msg.match(ln)
        if m:
            sender, content = m[2].strip(), m[3].strip().strip('"')
            msgs.append({"sent_at": lf_combine(cur_date, lf_parse_clock(m[1])),
                         "sender": "them" if sender == name else "me",
                         "content": content or "[非文字訊息]", "_who": sender})
        elif msgs and ln.strip() and cur_date:
            msgs[-1]["content"] += "\n" + ln.strip()  # 多行訊息
    if not name:
        others = [m["_who"] for m in msgs]
        name = max(set(others), key=others.count) if others else ""
        for m in msgs:
            m["sender"] = "them" if m["_who"] == name else "me"
    return name, msgs


def lf_import_text(text: str, filename: str = "", keep: int = 200) -> dict:
    fallback = re.sub(r"(\[LINE\]|與|的聊天(記錄|紀錄)|\.txt$)", "", filename or "").strip()
    name, msgs = lf_parse_export(text, fallback)
    if not name:
        raise ValueError("讀不到好友名稱,請確認是 LINE 匯出的聊天記錄 txt")
    if not msgs:
        raise ValueError("檔案裡沒有可解析的訊息")
    fid = lf_upsert_friend(name)
    keep = max(10, min(int(keep), 2000))
    lf_exec("UPDATE lf_friends SET keep_n=MAX(COALESCE(keep_n,0),?) WHERE id=?", (keep, fid))
    n = lf_save_messages(fid, msgs[-keep:], keep=keep, source="txt")
    from lf_rules import lf_run_rules
    lf_run_rules([fid])
    return {"lf_friend_id": fid, "lf_name": name, "lf_parsed": len(msgs), "lf_kept": n}
