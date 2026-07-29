"""
Storage layer with local JSON fallback (Supabase optional).
Primary: Supabase REST API (if tables exist)
Fallback: config/bot_state.json (always works)
"""
import os
import json
import requests
from datetime import datetime
from pathlib import Path

STATE_FILE = Path(__file__).parent.parent / "config" / "bot_state.json"


# ── Local JSON fallback ────────────────────────────────────────────────────

def _load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"day_counter": "1", "line_user_id": ""}


def _save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Supabase REST helpers ──────────────────────────────────────────────────

def _url(table: str) -> str:
    return f"{os.environ['SUPABASE_URL']}/rest/v1/{table}"


def _headers(prefer: str = "") -> dict:
    h = {
        "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def _supabase_get(key: str) -> str | None:
    try:
        resp = requests.get(
            _url("bot_config"),
            headers=_headers(),
            params={"key": f"eq.{key}", "select": "value"},
            timeout=5
        )
        if resp.status_code == 200 and resp.json():
            return resp.json()[0]["value"]
    except Exception:
        pass
    return None


def _supabase_set(key: str, value: str) -> bool:
    try:
        resp = requests.post(
            _url("bot_config"),
            headers=_headers("resolution=merge-duplicates"),
            json={"key": key, "value": str(value), "updated_at": datetime.utcnow().isoformat()},
            timeout=5
        )
        return resp.status_code in (200, 201)
    except Exception:
        return False


# ── Public API ─────────────────────────────────────────────────────────────

def get_config(key: str, default: str = None) -> str | None:
    # Try Supabase first, fall back to local
    val = _supabase_get(key)
    if val is not None:
        return val
    state = _load_state()
    return state.get(key, default)


def set_config(key: str, value: str):
    # Write to local state first (always succeeds)
    state = _load_state()
    state[key] = str(value)
    _save_state(state)
    # Also try Supabase (best-effort)
    _supabase_set(key, value)


def get_day_number() -> int:
    return int(get_config("day_counter", "1"))


def increment_day():
    set_config("day_counter", str(get_day_number() + 1))


def get_line_user_id() -> str | None:
    # Priority: .env > local state > Supabase
    uid = os.environ.get("LINE_USER_ID", "").strip()
    if uid:
        return uid
    return get_config("line_user_id")


def set_line_user_id(user_id: str):
    set_config("line_user_id", user_id)


def save_message_log(date_str: str, day_number: int, text: str, image_url: str, status: str):
    # Try Supabase (optional - don't fail if tables missing)
    try:
        requests.post(
            _url("daily_messages"),
            headers=_headers("return=minimal"),
            json={
                "date": date_str,
                "day_number": day_number,
                "text_content": text,
                "image_url": image_url or "",
                "status": status,
                "sent_at": datetime.utcnow().isoformat()
            },
            timeout=5
        )
    except Exception:
        pass

    # Always log locally
    log_file = Path(__file__).parent.parent / "logs" / "messages.jsonl"
    log_file.parent.mkdir(exist_ok=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "date": date_str, "day": day_number,
            "status": status, "image_url": image_url
        }, ensure_ascii=False) + "\n")


# ── Group / target ─────────────────────────────────────────────────────────

def get_line_target() -> str | None:
    """Return LINE group ID if set, else personal user ID."""
    group_id = os.environ.get("LINE_GROUP_ID", "").strip()
    if group_id:
        return group_id
    uid = os.environ.get("LINE_USER_ID", "").strip()
    if uid:
        return uid
    return get_config("line_user_id")


# ── Morning cache (text + prompts saved between Phase 1 and Phase 2) ───────

CACHE_FILE = Path(__file__).parent.parent / "config" / "morning_cache.json"


def save_morning_cache(day: int, text: str, prompts: list[str]):
    today = datetime.now().strftime("%Y-%m-%d")
    payload = {
        "date": today,
        "day_number": day,
        "text": text,
        "prompts": prompts,
        "status": "pending",
    }
    # Write local file
    CACHE_FILE.parent.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    # Sync to Supabase (for cloud runners)
    try:
        requests.post(
            _url("morning_cache"),
            headers=_headers("resolution=merge-duplicates"),
            json={
                "cache_date": today,
                "day_number": day,
                "text_content": text,
                "prompts": prompts,
                "status": "pending",
                "updated_at": datetime.utcnow().isoformat(),
            },
            timeout=10,
        )
    except Exception:
        pass


def load_morning_cache() -> dict | None:
    today = datetime.now().strftime("%Y-%m-%d")
    # Try local file first
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            if data.get("date") == today:
                return data
        except Exception:
            pass
    # Fall back to Supabase (for cloud runners)
    try:
        resp = requests.get(
            _url("morning_cache"),
            headers=_headers(),
            params={"cache_date": f"eq.{today}", "status": "eq.pending", "select": "*"},
            timeout=10,
        )
        if resp.status_code == 200 and resp.json():
            row = resp.json()[0]
            return {
                "date": today,
                "day_number": row["day_number"],
                "text": row["text_content"],
                "prompts": row["prompts"],
                "status": row["status"],
            }
    except Exception:
        pass
    return None


def clear_morning_cache():
    # Clear local file
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()
    # Mark as completed in Supabase
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        requests.patch(
            _url("morning_cache"),
            headers=_headers(),
            params={"cache_date": f"eq.{today}"},
            json={"status": "completed", "updated_at": datetime.utcnow().isoformat()},
            timeout=10,
        )
    except Exception:
        pass


# ── Confirmation (Supabase line_confirmations table) ───────────────────────

def check_confirmation_today(day: int) -> bool:
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        resp = requests.get(
            _url("line_confirmations"),
            headers=_headers(),
            params={
                "confirm_date": f"eq.{today}",
                "day_number": f"eq.{day}",
                "images_sent": "eq.false",
                "select": "id",
            },
            timeout=5,
        )
        return resp.status_code == 200 and len(resp.json()) > 0
    except Exception:
        return False


def mark_images_sent(day: int):
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        requests.patch(
            _url("line_confirmations"),
            headers=_headers(),
            params={"confirm_date": f"eq.{today}", "day_number": f"eq.{day}"},
            json={"images_sent": True},
            timeout=5,
        )
    except Exception:
        pass


# ── IG Analysis requests ───────────────────────────────────────────────────

def check_analysis_requested() -> bool:
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        resp = requests.get(
            _url("ig_analysis_requests"),
            headers=_headers(),
            params={"request_date": f"eq.{today}", "status": "eq.pending", "select": "id"},
            timeout=5,
        )
        return resp.status_code == 200 and len(resp.json()) > 0
    except Exception:
        return False


def mark_analysis_completed():
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        requests.patch(
            _url("ig_analysis_requests"),
            headers=_headers(),
            params={"request_date": f"eq.{today}"},
            json={"status": "done"},
            timeout=5,
        )
    except Exception:
        pass


# ── E-invoice / spending (electronic invoices table) ───────────────────────

def _local_invoice_file() -> Path:
    f = Path(__file__).parent.parent / "logs" / "invoices.jsonl"
    f.parent.mkdir(exist_ok=True)
    return f


def get_existing_inv_nums() -> set[str]:
    """Invoice numbers already stored — used to de-dupe on each fetch."""
    nums: set[str] = set()
    # Supabase first
    try:
        resp = requests.get(
            _url("invoices"),
            headers=_headers(),
            params={"select": "inv_num"},
            timeout=10,
        )
        if resp.status_code == 200:
            nums |= {r["inv_num"] for r in resp.json()}
    except Exception:
        pass
    # Local fallback
    f = _local_invoice_file()
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            try:
                nums.add(json.loads(line)["inv_num"])
            except Exception:
                continue
    return nums


def save_invoice(header: dict, category: str, items: list[dict]) -> bool:
    """
    Persist one invoice (header + items). header keys: invNum, invDate,
    sellerName, amount. Idempotent per inv_num (merge-duplicates on Supabase).
    """
    inv_num = header["invNum"]
    row = {
        "inv_num": inv_num,
        "inv_date": header.get("invDate", ""),
        "seller_name": header.get("sellerName", ""),
        "amount": int(header.get("amount") or 0),
        "category": category,
        "created_at": datetime.utcnow().isoformat(),
    }
    ok = False
    # Supabase (best-effort)
    try:
        resp = requests.post(
            _url("invoices"),
            headers=_headers("resolution=merge-duplicates,return=minimal"),
            json=row,
            timeout=10,
        )
        ok = resp.status_code in (200, 201, 204)
        if ok and items:
            item_rows = [{
                "inv_num": inv_num,
                "description": it.get("description", ""),
                "quantity": int(it.get("quantity") or 1),
                "unit_price": int(it.get("unitPrice") or 0),
                "amount": int(it.get("amount") or 0),
            } for it in items]
            requests.post(
                _url("invoice_items"),
                headers=_headers("return=minimal"),
                json=item_rows,
                timeout=10,
            )
    except Exception:
        ok = False

    # Always append locally
    with open(_local_invoice_file(), "a", encoding="utf-8") as fh:
        fh.write(json.dumps({**row, "items": items}, ensure_ascii=False) + "\n")
    return ok


def load_month_invoices(year_month: str) -> list[dict]:
    """
    Return [{seller_name, amount, category, inv_date}] for a given 'YYYY/MM'.
    Supabase first, local fallback.
    """
    out: list[dict] = []
    try:
        resp = requests.get(
            _url("invoices"),
            headers=_headers(),
            params={"inv_date": f"like.{year_month}*",
                    "select": "seller_name,amount,category,inv_date"},
            timeout=10,
        )
        if resp.status_code == 200 and resp.json():
            return resp.json()
    except Exception:
        pass
    f = _local_invoice_file()
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            try:
                r = json.loads(line)
                if str(r.get("inv_date", "")).startswith(year_month):
                    out.append(r)
            except Exception:
                continue
    return out
