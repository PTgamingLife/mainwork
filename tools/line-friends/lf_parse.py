"""lf_ 日期/時間解析(LINE 介面與匯出 txt 共用)。"""
import datetime as _dt
import re

LF_WEEK = {"一": 0, "二": 1, "三": 2, "四": 3, "五": 4, "六": 5, "日": 6, "天": 6,
           "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}

_re_ymd = re.compile(r"(\d{4})\s*[./年-]\s*(\d{1,2})\s*[./月-]\s*(\d{1,2})")
_re_md = re.compile(r"(?<!\d)(\d{1,2})\s*[/月]\s*(\d{1,2})(?!\d)")
_re_clock = re.compile(r"(上午|下午|中午|凌晨|晚上|AM|PM|am|pm)?\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?")


def lf_parse_date(text: str, today: _dt.date | None = None) -> _dt.date | None:
    """解析日期分隔線或聊天清單日期:今天/昨天/星期X/M/D/YYYY.MM.DD。"""
    if not text:
        return None
    today = today or _dt.date.today()
    t = text.strip()
    tl = t.lower()
    if "今天" in t or "today" in tl:
        return today
    if "昨天" in t or "yesterday" in tl:
        return today - _dt.timedelta(days=1)
    m = _re_ymd.search(t)
    if m:
        try:
            return _dt.date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            return None
    m = _re_md.search(t)
    if m:
        try:
            d = _dt.date(today.year, int(m[1]), int(m[2]))
            return d.replace(year=today.year - 1) if d > today else d
        except ValueError:
            return None
    for key, wd in LF_WEEK.items():
        hit = tl.startswith(key) if key.isascii() else any(
            (p + key) in t for p in ("星期", "週", "周", "禮拜"))
        if hit:
            delta = (today.weekday() - wd) % 7 or 7
            return today - _dt.timedelta(days=delta)
    return None


def lf_parse_clock(text: str) -> tuple[int, int] | None:
    if not text:
        return None
    m = _re_clock.search(text)
    if not m:
        return None
    h, mi = int(m[2]), int(m[3])
    ap = (m[1] or m[4] or "").lower()
    if ap in ("下午", "晚上", "pm") and h < 12:
        h += 12
    if ap in ("上午", "凌晨", "am") and h == 12:
        h = 0
    if ap == "中午" and h < 11:
        h += 12
    if not (0 <= h < 24 and 0 <= mi < 60):
        return None
    return h, mi


def lf_combine(d: _dt.date | None, clock: tuple[int, int] | None) -> str | None:
    if not d:
        return None
    h, mi = clock or (0, 0)
    return _dt.datetime(d.year, d.month, d.day, h, mi).isoformat(timespec="minutes")


def lf_parse_list_time(text: str, today: _dt.date | None = None) -> str | None:
    """聊天清單右上角時間:只有時間 = 今天,否則是日期。"""
    if not text:
        return None
    today = today or _dt.date.today()
    d = lf_parse_date(text, today)
    c = lf_parse_clock(text)
    if d is None and c is not None:
        d = today
    return lf_combine(d, c)
