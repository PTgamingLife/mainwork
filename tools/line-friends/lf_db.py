"""lf_ SQLite 資料層。所有資料只存在本機 lf_data/。"""
import datetime as _dt
import sqlite3
import threading

from lf_config import LF_DATA, LF_DB_PATH, LF_DEFAULT_CATEGORIES, LF_DEFAULT_SETTINGS

lf_lock = threading.RLock()

LF_SCHEMA = """
CREATE TABLE IF NOT EXISTS lf_friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mid TEXT,
  name TEXT NOT NULL,
  orig_name TEXT,
  custom_name TEXT,
  status_msg TEXT DEFAULT '',
  last_chat_at TEXT,
  last_preview TEXT DEFAULT '',
  in_chatlist INTEGER DEFAULT 0,
  has_unread INTEGER DEFAULT 0,
  msg_count INTEGER DEFAULT 0,
  keep_n INTEGER,
  rule_category TEXT,
  ai_category TEXT,
  ai_summary TEXT,
  ai_next_action TEXT,
  ai_at TEXT,
  ai_input_sig TEXT,
  category TEXT,
  manual_override INTEGER DEFAULT 0,
  note TEXT DEFAULT '',
  list_synced_at TEXT,
  msg_synced_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS lf_idx_friend_mid ON lf_friends(mid) WHERE mid IS NOT NULL;
CREATE INDEX IF NOT EXISTS lf_idx_friend_name ON lf_friends(name);
CREATE TABLE IF NOT EXISTS lf_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER NOT NULL REFERENCES lf_friends(id) ON DELETE CASCADE,
  sent_at TEXT,
  sender TEXT CHECK(sender IN ('me','them')),
  content TEXT,
  source TEXT DEFAULT 'sync',
  UNIQUE(friend_id, sent_at, sender, content)
);
CREATE INDEX IF NOT EXISTS lf_idx_msg_friend ON lf_messages(friend_id, sent_at);
CREATE TABLE IF NOT EXISTS lf_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#CFCFCF',
  rename_prefix TEXT DEFAULT '',
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lf_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#B8C5D6',
  rule_type TEXT DEFAULT 'none' CHECK(rule_type IN ('none','keyword','ai')),
  rule_value TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS lf_friend_tags (
  friend_id INTEGER REFERENCES lf_friends(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES lf_tags(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'manual',
  PRIMARY KEY(friend_id, tag_id)
);
CREATE TABLE IF NOT EXISTS lf_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field TEXT DEFAULT 'any' CHECK(field IN ('name','status','message','any')),
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS lf_settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS lf_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER REFERENCES lf_friends(id) ON DELETE CASCADE,
  instruction TEXT,
  result TEXT,
  model TEXT,
  msg_used INTEGER,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS lf_renames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER REFERENCES lf_friends(id) ON DELETE CASCADE,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK(status IN ('pending','confirmed','done','failed','cancelled')),
  error TEXT,
  created_at TEXT,
  confirmed_at TEXT,
  done_at TEXT
);
"""


def lf_now() -> str:
    return _dt.datetime.now().isoformat(timespec="seconds")


def lf_conn() -> sqlite3.Connection:
    LF_DATA.mkdir(parents=True, exist_ok=True)
    LF_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(LF_DB_PATH, check_same_thread=False, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    c.execute("PRAGMA journal_mode=WAL")
    return c


def lf_init_db() -> None:
    with lf_lock, lf_conn() as c:
        old = c.execute("SELECT sql FROM sqlite_master WHERE name='lf_friends'").fetchone()
        if old and "mid TEXT" not in old["sql"]:
            # 舊版結構(以名稱為唯一鍵):空表直接重建,有資料則補欄位
            if c.execute("SELECT COUNT(*) FROM lf_friends").fetchone()[0] == 0:
                c.execute("DROP TABLE lf_friends")
            else:
                c.execute("ALTER TABLE lf_friends ADD COLUMN mid TEXT")
        c.executescript(LF_SCHEMA)
        if not c.execute("SELECT 1 FROM lf_categories LIMIT 1").fetchone():
            c.executemany(
                "INSERT INTO lf_categories(name,color,rename_prefix,sort) VALUES(?,?,?,?)",
                [(n, col, p, i) for i, (n, col, p) in enumerate(LF_DEFAULT_CATEGORIES)],
            )
        for k, v in LF_DEFAULT_SETTINGS.items():
            c.execute("INSERT OR IGNORE INTO lf_settings(key,value) VALUES(?,?)", (k, v))


def lf_rows(sql: str, args=()) -> list[dict]:
    with lf_lock, lf_conn() as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]


def lf_one(sql: str, args=()) -> dict | None:
    r = lf_rows(sql, args)
    return r[0] if r else None


def lf_exec(sql: str, args=()) -> int:
    with lf_lock, lf_conn() as c:
        cur = c.execute(sql, args)
        return cur.lastrowid or cur.rowcount


# ---------- settings ----------
def lf_get_settings() -> dict:
    return {r["key"]: r["value"] for r in lf_rows("SELECT key,value FROM lf_settings")}


def lf_get_setting(key: str, default: str = "") -> str:
    r = lf_one("SELECT value FROM lf_settings WHERE key=?", (key,))
    return r["value"] if r else default


def lf_set_settings(data: dict) -> None:
    with lf_lock, lf_conn() as c:
        for k, v in data.items():
            if k.startswith("lf_"):
                c.execute("INSERT OR REPLACE INTO lf_settings(key,value) VALUES(?,?)", (k, str(v)))


# ---------- friends ----------
def lf_upsert_friend(name: str, mid: str | None = None, **fields) -> int:
    """依 LINE mid(沒有就用名稱)新增或更新好友;回傳 id。只更新有給的欄位。"""
    name = (name or "").strip()
    mid = (mid or "").strip() or None
    if not name:
        raise ValueError("lf_name 不可空白")
    allowed = {"status_msg", "last_chat_at", "last_preview", "in_chatlist",
               "has_unread", "list_synced_at", "custom_name"}
    upd = {k: v for k, v in fields.items() if k in allowed and v is not None}
    with lf_lock, lf_conn() as c:
        row = None
        if mid:
            row = c.execute("SELECT id FROM lf_friends WHERE mid=?", (mid,)).fetchone()
            if row:
                upd["name"] = name  # LINE 上名稱變了就跟著更新
            else:  # 先前用名稱建立(例如 txt 匯入)的好友,補上 mid
                row = c.execute("SELECT id FROM lf_friends WHERE name=? AND mid IS NULL",
                                (name,)).fetchone()
                if row:
                    upd["mid"] = mid
        else:
            row = c.execute("SELECT id FROM lf_friends WHERE name=? ORDER BY id LIMIT 1",
                            (name,)).fetchone()
        if row:
            if upd:
                sets = ",".join(f"{k}=?" for k in upd)
                c.execute(f"UPDATE lf_friends SET {sets},updated_at=? WHERE id=?",
                          (*upd.values(), lf_now(), row["id"]))
            return row["id"]
        cols = ["name", "orig_name", "mid", "updated_at", *upd.keys()]
        vals = [name, name, mid, lf_now(), *upd.values()]
        cur = c.execute(
            f"INSERT INTO lf_friends({','.join(cols)}) VALUES({','.join('?' * len(cols))})", vals)
        return cur.lastrowid


def lf_get_friend(fid: int) -> dict | None:
    f = lf_one("SELECT * FROM lf_friends WHERE id=?", (fid,))
    if f:
        f["tags"] = lf_friend_tags(fid)
    return f


def lf_friend_tags(fid: int) -> list[dict]:
    return lf_rows(
        "SELECT t.id,t.name,t.color,ft.source FROM lf_friend_tags ft "
        "JOIN lf_tags t ON t.id=ft.tag_id WHERE ft.friend_id=? ORDER BY t.name", (fid,))


def lf_query_friends(q="", category="", tag_id=0, since="", until="", todo="",
                     sort="last_chat_at", page=1, per=50) -> dict:
    where, args = ["1=1"], []
    if q:
        where.append("(f.name LIKE ? OR f.status_msg LIKE ? OR f.note LIKE ? OR f.ai_summary LIKE ?)")
        args += [f"%{q}%"] * 4
    if category == "__none__":
        where.append("(f.category IS NULL OR f.category='')")
    elif category:
        where.append("f.category=?")
        args.append(category)
    if tag_id:
        where.append("EXISTS(SELECT 1 FROM lf_friend_tags x WHERE x.friend_id=f.id AND x.tag_id=?)")
        args.append(int(tag_id))
    if since:
        where.append("f.last_chat_at>=?")
        args.append(since)
    if until:
        where.append("(f.last_chat_at<=? OR f.last_chat_at IS NULL)")
        args.append(until)
    if todo == "uncategorized":
        where.append("(f.category IS NULL OR f.category='' OR f.category='不認識')")
    elif todo == "stale":
        days = int(lf_get_setting("lf_dormant_days", "365"))
        cut = (_dt.datetime.now() - _dt.timedelta(days=days)).isoformat()
        where.append("(f.last_chat_at IS NOT NULL AND f.last_chat_at<?)")
        args.append(cut)
    elif todo == "prospect":
        where.append("(f.category='潛在客戶' OR f.ai_category='潛在客戶')")
    order = {
        "last_chat_at": "f.last_chat_at IS NULL, f.last_chat_at DESC",
        "last_chat_asc": "f.last_chat_at IS NULL, f.last_chat_at ASC",
        "name": "f.name COLLATE NOCASE",
        "msg_count": "f.msg_count DESC",
    }.get(sort, "f.last_chat_at DESC")
    w = " AND ".join(where)
    total = lf_one(f"SELECT COUNT(*) n FROM lf_friends f WHERE {w}", args)["n"]
    per = max(1, min(int(per), 500))
    off = (max(1, int(page)) - 1) * per
    rows = lf_rows(
        f"SELECT f.id,f.name,f.status_msg,f.last_chat_at,f.msg_count,f.category,f.ai_category,"
        f"f.ai_summary,f.ai_next_action,f.manual_override,f.note,f.has_unread,f.msg_synced_at "
        f"FROM lf_friends f WHERE {w} ORDER BY {order} LIMIT ? OFFSET ?", (*args, per, off))
    if rows:
        ids = [r["id"] for r in rows]
        tagrows = lf_rows(
            f"SELECT ft.friend_id,t.id,t.name,t.color FROM lf_friend_tags ft JOIN lf_tags t "
            f"ON t.id=ft.tag_id WHERE ft.friend_id IN ({','.join('?' * len(ids))})", ids)
        bymap: dict[int, list] = {}
        for t in tagrows:
            bymap.setdefault(t["friend_id"], []).append(
                {"id": t["id"], "name": t["name"], "color": t["color"]})
        for r in rows:
            r["tags"] = bymap.get(r["id"], [])
    return {"lf_total": total, "lf_page": int(page), "lf_per": per, "lf_rows": rows}


def lf_update_friend(fid: int, data: dict) -> None:
    sets, args = [], []
    if "lf_category" in data:
        cat = (data["lf_category"] or "").strip() or None
        sets += ["category=?", "manual_override=?"]
        args += [cat, 1 if cat else 0]
    if "lf_note" in data:
        sets.append("note=?")
        args.append(str(data["lf_note"])[:5000])
    if sets:
        lf_exec(f"UPDATE lf_friends SET {','.join(sets)},updated_at=? WHERE id=?",
                (*args, lf_now(), fid))


def lf_set_category_auto(fid: int, rule_cat: str | None = None, ai: dict | None = None) -> None:
    """寫入規則/AI 分類;手動覆寫過的好友不改動 category。"""
    with lf_lock, lf_conn() as c:
        f = c.execute("SELECT manual_override,rule_category,ai_category FROM lf_friends WHERE id=?",
                      (fid,)).fetchone()
        if not f:
            return
        if rule_cat is not None:
            c.execute("UPDATE lf_friends SET rule_category=? WHERE id=?", (rule_cat or None, fid))
        if ai is not None:
            c.execute(
                "UPDATE lf_friends SET ai_category=?,ai_summary=?,ai_next_action=?,ai_at=?,"
                "ai_input_sig=? WHERE id=?",
                (ai.get("lf_category"), ai.get("lf_summary"), ai.get("lf_next_action"),
                 lf_now(), ai.get("lf_sig"), fid))
        if not f["manual_override"]:
            cur = c.execute("SELECT rule_category,ai_category FROM lf_friends WHERE id=?",
                            (fid,)).fetchone()
            # 規則中的「沉睡」優先;其餘以 AI 為主,AI 沒結果才用規則
            eff = cur["rule_category"] if cur["rule_category"] == "沉睡" else (
                cur["ai_category"] or cur["rule_category"])
            c.execute("UPDATE lf_friends SET category=? WHERE id=?", (eff, fid))


# ---------- messages ----------
def lf_save_messages(fid: int, msgs: list[dict], keep: int, source="sync") -> int:
    """寫入訊息並只保留最近 keep 則。msgs: [{sent_at, sender, content}]"""
    with lf_lock, lf_conn() as c:
        for m in msgs:
            if m.get("sender") not in ("me", "them") or not m.get("content"):
                continue
            c.execute(
                "INSERT OR IGNORE INTO lf_messages(friend_id,sent_at,sender,content,source) "
                "VALUES(?,?,?,?,?)",
                (fid, m.get("sent_at"), m["sender"], str(m["content"])[:4000], source))
        f = c.execute("SELECT keep_n FROM lf_friends WHERE id=?", (fid,)).fetchone()
        keep = max(int(keep), int(f["keep_n"] or 0)) if f else int(keep)
        c.execute(
            "DELETE FROM lf_messages WHERE friend_id=? AND id NOT IN ("
            "SELECT id FROM lf_messages WHERE friend_id=? ORDER BY sent_at DESC, id DESC LIMIT ?)",
            (fid, fid, keep))
        n = c.execute("SELECT COUNT(*) n, MAX(sent_at) m FROM lf_messages WHERE friend_id=?",
                      (fid,)).fetchone()
        c.execute(
            "UPDATE lf_friends SET msg_count=?, last_chat_at=COALESCE(?, last_chat_at),"
            "msg_synced_at=?, updated_at=? WHERE id=?",
            (n["n"], n["m"], lf_now(), lf_now(), fid))
        return n["n"]


def lf_get_messages(fid: int, limit=200) -> list[dict]:
    rows = lf_rows("SELECT sent_at,sender,content FROM lf_messages WHERE friend_id=? "
                   "ORDER BY sent_at DESC, id DESC LIMIT ?", (fid, limit))
    return list(reversed(rows))


def lf_next_batch(n: int) -> list[dict]:
    """下一批要抓訊息的好友:有聊天、沒抓過的優先,再來是最久沒更新的。"""
    return lf_rows(
        "SELECT id,mid,name,has_unread FROM lf_friends WHERE in_chatlist=1 "
        "ORDER BY msg_synced_at IS NOT NULL, msg_synced_at ASC, last_chat_at DESC LIMIT ?",
        (int(n),))


def lf_stats() -> dict:
    r = lf_one(
        "SELECT COUNT(*) total, SUM(in_chatlist) chats, "
        "SUM(CASE WHEN msg_synced_at IS NOT NULL THEN 1 ELSE 0 END) synced, "
        "SUM(CASE WHEN category IS NULL OR category='' THEN 1 ELSE 0 END) uncategorized, "
        "SUM(CASE WHEN ai_at IS NOT NULL THEN 1 ELSE 0 END) ai_done FROM lf_friends")
    return {k: (v or 0) for k, v in r.items()}
