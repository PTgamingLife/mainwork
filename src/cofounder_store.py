"""AI 創業合夥人 — Supabase 讀寫層(合夥人專用的新專案)。

沿用 src/database.py 的形狀:requests + _url/_headers(prefer),每個呼叫 try/except + timeout,
Supabase 掛掉時回落到 repo 裡的 cofounder/data.json,讓階段 1 的資料無縫延續。

環境變數(刻意跟現有 SUPABASE_* 分開,合夥人用的是另一個專案):
    COFOUNDER_SUPABASE_URL
    COFOUNDER_SUPABASE_SERVICE_ROLE_KEY
"""
import json
import os
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
DATA_FILE = ROOT / "cofounder" / "data.json"
TIMEOUT = 10


def _configured() -> bool:
    return bool(os.environ.get("COFOUNDER_SUPABASE_URL")
                and os.environ.get("COFOUNDER_SUPABASE_SERVICE_ROLE_KEY"))


def _url(table: str) -> str:
    return f"{os.environ['COFOUNDER_SUPABASE_URL']}/rest/v1/{table}"


def _headers(prefer: str = "") -> dict:
    key = os.environ["COFOUNDER_SUPABASE_SERVICE_ROLE_KEY"]
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


# ---------- 本地檔案(後備 + 儀表板的資料來源) ----------

def load_local() -> dict:
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_local(data: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


# ---------- Supabase ----------

def get_member(line_user_id: str | None = None) -> dict | None:
    """取得成員。不給 line_user_id 就取第一個啟用的成員(單人階段)。"""
    if not _configured():
        return None
    params = {"select": "id,line_user_id,display_name", "is_active": "eq.true", "limit": "1"}
    if line_user_id:
        params["line_user_id"] = f"eq.{line_user_id}"
    try:
        resp = requests.get(_url("cofounder_members"), headers=_headers(),
                            params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as exc:
        print(f"[store] get_member failed: {exc}")
        return None


def get_state(member_id: str) -> dict:
    if not _configured():
        return load_local()
    try:
        resp = requests.get(_url("cofounder_state"), headers=_headers(),
                            params={"member_id": f"eq.{member_id}", "select": "data"},
                            timeout=TIMEOUT)
        resp.raise_for_status()
        rows = resp.json()
        return rows[0]["data"] if rows else {}
    except Exception as exc:
        print(f"[store] get_state failed, falling back to data.json: {exc}")
        return load_local()


def set_state(member_id: str, data: dict) -> bool:
    if not _configured():
        return False
    try:
        resp = requests.post(
            _url("cofounder_state"),
            headers=_headers("resolution=merge-duplicates,return=minimal"),
            params={"on_conflict": "member_id"},
            json={"member_id": member_id, "data": data},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        print(f"[store] set_state failed: {exc}")
        return False


def get_daily(member_id: str, limit: int = 30) -> list[dict]:
    if not _configured():
        return load_local().get("daily", [])[-limit:]
    try:
        resp = requests.get(_url("cofounder_daily"), headers=_headers(),
                            params={"member_id": f"eq.{member_id}",
                                    "order": "action_date.desc", "limit": str(limit)},
                            timeout=TIMEOUT)
        resp.raise_for_status()
        return list(reversed(resp.json()))
    except Exception as exc:
        print(f"[store] get_daily failed: {exc}")
        return load_local().get("daily", [])[-limit:]


def get_revenue(member_id: str, limit: int = 200) -> list[dict]:
    if not _configured():
        return load_local().get("revenue", [])
    try:
        resp = requests.get(_url("cofounder_revenue"), headers=_headers(),
                            params={"member_id": f"eq.{member_id}",
                                    "order": "entry_date.desc", "limit": str(limit)},
                            timeout=TIMEOUT)
        resp.raise_for_status()
        return list(reversed(resp.json()))
    except Exception as exc:
        print(f"[store] get_revenue failed: {exc}")
        return load_local().get("revenue", [])


def save_message(member_id: str, role: str, text: str, model: str = "", intent: str = "") -> None:
    """把排程推出去的訊息也記進對話歷史,OA 才有上下文。"""
    if not _configured():
        return
    try:
        requests.post(_url("cofounder_messages"), headers=_headers("return=minimal"),
                      json={"member_id": member_id, "role": role, "text": text,
                            "model": model, "intent": intent},
                      timeout=TIMEOUT).raise_for_status()
    except Exception as exc:
        print(f"[store] save_message failed: {exc}")
