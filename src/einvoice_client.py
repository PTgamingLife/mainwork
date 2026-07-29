"""
財政部電子發票整合服務平台 — 手機條碼載具查詢 client.

Consumer-facing B2C API (PB2CAPIVAN). Pulls all invoices aggregated to a
mobile-barcode carrier (手機條碼載具).

Endpoints used (action on the InvApp resource):
  - carrierInvChk    → 發票表頭 (merchant, date, total amount)  [almost always present]
  - carrierInvDetail → 發票明細 (line items: name, qty, unit price) [if seller uploaded]

Credentials (all via env — NEVER hard-coded):
  EINVOICE_APP_ID       申請的 AppID
  EINVOICE_CARRIER_NO   手機條碼 (starts with '/', 8 chars)
  EINVOICE_CARRIER_PIN  手機條碼驗證碼 (the password you set on einvoice.nat.gov.tw)

Test mode: if EINVOICE_APP_ID is unset OR use_fixture=True, returns sample
data from tests/fixtures/einvoice_sample.json so the whole pipeline can run
end-to-end without real credentials.
"""
import os
import json
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import requests

API_URL = "https://api.einvoice.nat.gov.tw/PB2CAPIVAN/invapp/InvApp"
CARD_TYPE = "3J0002"  # 手機條碼
API_VERSION = "0.5"
TIMEOUT = 20

ROOT = Path(__file__).parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "einvoice_sample.json"


# ── credentials / config ────────────────────────────────────────────────────

def _creds() -> dict | None:
    """Return credential dict, or None when not configured (→ fixture mode)."""
    app_id = os.environ.get("EINVOICE_APP_ID", "").strip()
    card_no = os.environ.get("EINVOICE_CARRIER_NO", "").strip()
    card_pin = os.environ.get("EINVOICE_CARRIER_PIN", "").strip()
    if not (app_id and card_no and card_pin):
        return None
    return {"app_id": app_id, "card_no": card_no, "card_pin": card_pin}


def _exp_timestamp() -> str:
    """Barcode expiry — a far-future unix ts is accepted by the platform."""
    return str(int((datetime.now() + timedelta(days=365)).timestamp()))


def _base_params(creds: dict) -> dict:
    return {
        "version": API_VERSION,
        "cardType": CARD_TYPE,
        "cardNo": creds["card_no"],
        "cardEncrypt": creds["card_pin"],
        "expTimeStamp": _exp_timestamp(),
        "timeStamp": str(int(time.time()) + 10),
        "uuid": str(uuid.uuid4()),
        "appID": creds["app_id"],
    }


# ── fixture (test) mode ─────────────────────────────────────────────────────

def _load_fixture() -> dict:
    if FIXTURE.exists():
        return json.loads(FIXTURE.read_text(encoding="utf-8"))
    return {"headers": [], "details": {}}


# ── public API ──────────────────────────────────────────────────────────────

def fetch_headers(start_date: str, end_date: str, use_fixture: bool = False) -> list[dict]:
    """
    Pull invoice headers between start_date and end_date (both 'YYYY/MM/DD').

    Returns list of normalized dicts:
      {invNum, invDate, sellerName, amount, cardType, cardNo}
    """
    creds = None if use_fixture else _creds()
    if creds is None:
        return _load_fixture().get("headers", [])

    params = _base_params(creds)
    params.update({
        "action": "carrierInvChk",
        "startDate": start_date,
        "endDate": end_date,
        "onlyWinningInv": "N",
    })
    resp = requests.post(API_URL, data=params, timeout=TIMEOUT)
    resp.raise_for_status()
    body = resp.json()
    if str(body.get("code")) != "200":
        raise RuntimeError(f"einvoice carrierInvChk failed: {body.get('code')} {body.get('msg')}")

    out = []
    for row in body.get("details", []):
        out.append({
            "invNum": row.get("invNum", ""),
            "invDate": row.get("invDate", ""),
            "sellerName": (row.get("sellerName") or "").strip(),
            "amount": _to_int(row.get("amount")),
        })
    return out


def fetch_detail(inv_num: str, inv_date: str, use_fixture: bool = False) -> list[dict]:
    """
    Pull line items for one invoice. inv_date is 'YYYY/MM/DD'.

    Returns list of normalized dicts: {description, quantity, unitPrice, amount}
    Empty list when the seller did not upload item detail.
    """
    creds = None if use_fixture else _creds()
    if creds is None:
        return _load_fixture().get("details", {}).get(inv_num, [])

    params = _base_params(creds)
    params.update({
        "action": "carrierInvDetail",
        "invNum": inv_num,
        "invDate": inv_date,
    })
    resp = requests.post(API_URL, data=params, timeout=TIMEOUT)
    resp.raise_for_status()
    body = resp.json()
    if str(body.get("code")) != "200":
        # detail is best-effort; a missing/failed detail is not fatal
        return []

    out = []
    for row in body.get("details", []):
        out.append({
            "description": (row.get("description") or "").strip(),
            "quantity": _to_int(row.get("quantity"), default=1),
            "unitPrice": _to_int(row.get("unitPrice")),
            "amount": _to_int(row.get("amount")),
        })
    return out


def is_live() -> bool:
    """True when real credentials are configured (not running on fixtures)."""
    return _creds() is not None


def _to_int(val, default: int = 0) -> int:
    try:
        return int(round(float(val)))
    except (TypeError, ValueError):
        return default
