"""lf_ 規則分類:關鍵字規則 + 沉睡判斷 + 關鍵字標籤。

規則語法(逗號分隔多個):一般詞 = 不分大小寫的包含比對;
以 re: 開頭 = 正規表示式(區分大小寫,可用 (?i) 關閉),例如 re:(?<![A-Za-z])AI(?![A-Za-z])
"""
import datetime as _dt
import re

from lf_db import lf_exec, lf_get_messages, lf_get_setting, lf_lock, lf_conn, lf_rows, lf_set_category_auto


def lf_split_patterns(raw: str) -> list[str]:
    """re: 規則可能含逗號,所以 re: 只能單獨一條,或放在最後。"""
    raw = raw or ""
    if "re:" in raw:
        head, _, rx = raw.partition("re:")
        return [p.strip() for p in head.split(",") if p.strip()] + ["re:" + rx.strip()]
    return [p.strip() for p in raw.split(",") if p.strip()]


def lf_match(patterns: list[str], hay: str) -> bool:
    for p in patterns:
        if p.startswith("re:"):
            try:
                if re.search(p[3:], hay):
                    return True
            except re.error:
                continue
        elif p.lower() in hay.lower():
            return True
    return False


def lf_rule_category(friend: dict, msgs: list[dict], rules: list[dict], dormant_days: int) -> str:
    last = friend.get("last_chat_at")
    if last:
        try:
            if _dt.datetime.now() - _dt.datetime.fromisoformat(last[:19]) > _dt.timedelta(days=dormant_days):
                return "沉睡"
        except ValueError:
            pass
    text_msg = "\n".join(m["content"] for m in msgs if m.get("content"))
    fields = {"name": friend.get("name") or "", "status": friend.get("status_msg") or "",
              "message": text_msg}
    for r in rules:
        if not r["enabled"]:
            continue
        hay = fields["name"] + "\n" + fields["status"] + "\n" + text_msg if r["field"] == "any" \
            else fields.get(r["field"], "")
        if lf_match(lf_split_patterns(r["pattern"]), hay):
            return r["category"]
    return ""


def lf_apply_keyword_tags(fid: int, friend: dict, msgs: list[dict], tags: list[dict]) -> None:
    hay = "\n".join([friend.get("name") or "", friend.get("status_msg") or "",
                     *[m["content"] for m in msgs]])
    with lf_lock, lf_conn() as c:
        for t in tags:
            if t["rule_type"] != "keyword" or not t["rule_value"].strip():
                continue
            if lf_match(lf_split_patterns(t["rule_value"]), hay):
                c.execute("INSERT OR IGNORE INTO lf_friend_tags(friend_id,tag_id,source) "
                          "VALUES(?,?,'rule')", (fid, t["id"]))


def lf_run_rules(fids: list[int] | None = None) -> int:
    """對指定(或全部)好友跑規則分類,回傳處理人數。"""
    rules = lf_rows("SELECT * FROM lf_rules ORDER BY id")
    tags = lf_rows("SELECT * FROM lf_tags")
    days = int(lf_get_setting("lf_dormant_days", "365") or 365)
    if fids is None:
        friends = lf_rows("SELECT id,name,status_msg,last_chat_at FROM lf_friends")
    else:
        if not fids:
            return 0
        friends = lf_rows(
            f"SELECT id,name,status_msg,last_chat_at FROM lf_friends WHERE id IN "
            f"({','.join('?' * len(fids))})", fids)
    for f in friends:
        msgs = lf_get_messages(f["id"], 50)
        cat = lf_rule_category(f, msgs, rules, days)
        lf_set_category_auto(f["id"], rule_cat=cat)
        lf_apply_keyword_tags(f["id"], f, msgs, tags)
    return len(friends)


def lf_clear_rule_tags() -> None:
    lf_exec("DELETE FROM lf_friend_tags WHERE source='rule'")
