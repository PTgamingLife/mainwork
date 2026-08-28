"""
B-roll 素材庫 — Supabase(broll_assets / broll_usages)的薄封裝。

給 scripts/auto_edit.py 用:排 B-roll 計畫前先 search(),命中就直接沿用既有素材,
不再送去生成;真的生成了才 register() 記一筆;實際疊上去時 record_usage()。

金鑰走 config/.env 的 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY(與 src/database.py 同慣例)。
沒設金鑰時所有函式安靜降級(search 回空清單、寫入回 None),流程照樣能跑。
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

import requests

TIMEOUT = 20
_WARNED = False


def _creds() -> tuple[str, str] | None:
    """回傳 (url, service_role_key);沒設定就回 None 並提示一次。"""
    global _WARNED
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if url and key:
        return url, key
    if not _WARNED:
        print("[素材庫] 未設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY,略過素材庫比對。")
        _WARNED = True
    return None


def _headers(key: str, prefer: str = "") -> dict:
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def available() -> bool:
    return _creds() is not None


def sha256_of(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ── 搜尋 ────────────────────────────────────────────────────────────────────

def search(query: str, tags: list[str] | None = None,
           orientation: str | None = None, min_sim: float = 0.10,
           limit: int = 5) -> list[dict]:
    """找語意相近、可直接重用的素材(分數高者在前)。查不到或出錯回 []。"""
    creds = _creds()
    if not creds or not (query or "").strip():
        return []
    url, key = creds
    try:
        resp = requests.post(
            f"{url}/rest/v1/rpc/broll_search",
            headers=_headers(key),
            json={
                "q": query.strip(),
                "want_tags": tags or [],
                "want_orientation": orientation,
                "min_sim": min_sim,
                "max_rows": limit,
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        # 檔案可能已被刪掉/搬走 — 只回還存在於本機的
        return [r for r in rows if r.get("file_path") and Path(r["file_path"]).exists()]
    except Exception as e:
        print(f"[素材庫] 搜尋失敗({e}),當作沒有可重用素材。")
        return []


def best_match(query: str, tags: list[str] | None = None,
               orientation: str | None = None,
               min_score: float = 0.28) -> dict | None:
    """只取一段:分數要過 min_score 才算「夠像,可以不用生」。"""
    hits = search(query, tags, orientation, limit=3)
    if hits and float(hits[0].get("score", 0)) >= min_score:
        return hits[0]
    return None


# ── 寫入 ────────────────────────────────────────────────────────────────────

def register(file_path: str | Path, prompt: str, *, intent: str = "",
             tags: list[str] | None = None, style: str = "",
             source: str = "higgsfield", provider: str = "", model: str = "",
             cost_usd: float = 0.0, duration_sec: float | None = None,
             width: int | None = None, height: int | None = None,
             notes: str = "") -> dict | None:
    """把一段素材登記進庫。sha256 重複時視為已存在,回傳既有那筆。"""
    creds = _creds()
    if not creds:
        return None
    url, key = creds
    p = Path(file_path)
    if not p.exists():
        print(f"[素材庫] 檔案不存在,略過登記: {p}")
        return None

    digest = sha256_of(p)
    existing = _get_by_sha(url, key, digest)
    if existing:
        print(f"[素材庫] 同一檔案已在庫中(id={existing['id']}),不重複登記。")
        return existing

    row = {
        "file_path": str(p.resolve()),
        "sha256": digest,
        "prompt": prompt,
        "intent": intent or None,
        "tags": tags or [],
        "style": style or None,
        "source": source,
        "provider": provider or None,
        "model": model or None,
        "cost_usd": round(float(cost_usd), 4),
        "duration_sec": duration_sec,
        "width": width,
        "height": height,
        "notes": notes or None,
    }
    try:
        resp = requests.post(
            f"{url}/rest/v1/broll_assets",
            headers=_headers(key, prefer="return=representation"),
            json=row, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        return data[0] if isinstance(data, list) and data else data
    except Exception as e:
        print(f"[素材庫] 登記失敗({e}):{p.name}")
        return None


def record_usage(asset_id: str, video_slug: str,
                 start_sec: float, end_sec: float) -> bool:
    """記錄某支影片在哪個時間點用了這段素材(觸發器會回寫 use_count)。"""
    creds = _creds()
    if not creds or not asset_id:
        return False
    url, key = creds
    try:
        resp = requests.post(
            f"{url}/rest/v1/broll_usages",
            headers=_headers(key, prefer="resolution=ignore-duplicates"),
            json={
                "asset_id": asset_id,
                "video_slug": video_slug,
                "start_sec": round(float(start_sec), 2),
                "end_sec": round(float(end_sec), 2),
            }, timeout=TIMEOUT)
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[素材庫] 使用紀錄寫入失敗({e})")
        return False


def _get_by_sha(url: str, key: str, digest: str) -> dict | None:
    try:
        resp = requests.get(
            f"{url}/rest/v1/broll_assets",
            headers=_headers(key),
            params={"sha256": f"eq.{digest}", "select": "*", "limit": 1},
            timeout=TIMEOUT)
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception:
        return None
