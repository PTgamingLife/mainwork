"""lf_ 本機後端(FastAPI)。只綁 127.0.0.1,並檢查 Host 標頭防 DNS rebinding。"""
import sys

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from lf_config import LF_AI_MODEL, LF_HOST, LF_PORT, LF_STATIC
from lf_db import (lf_exec, lf_get_friend, lf_get_messages, lf_get_settings, lf_init_db,
                   lf_now, lf_one, lf_query_friends, lf_rows, lf_set_settings, lf_stats,
                   lf_update_friend)

lf_app = FastAPI(title="lf_line_friends", docs_url=None, redoc_url=None)
lf_init_db()


@lf_app.middleware("http")
async def lf_guard_host(request: Request, call_next):
    host = (request.headers.get("host") or "").split(":")[0]
    if host not in ("127.0.0.1", "localhost"):
        return JSONResponse({"lf_error": "forbidden host"}, status_code=403)
    resp = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        resp.headers["Cache-Control"] = "no-cache"  # 更新程式後瀏覽器一定拿到新版
    return resp


def lf_worker():
    from lf_scraper import lf_get_worker
    return lf_get_worker()


def lf_ok(**kw):
    return {"lf_ok": True, **kw}


# ---------- 頁面 ----------
@lf_app.get("/")
def lf_index():
    return FileResponse(LF_STATIC / "index.html")


lf_app.mount("/static", StaticFiles(directory=LF_STATIC), name="static")


# ---------- 同步 ----------
@lf_app.get("/api/lf_status")
def lf_status():
    from lf_ai import lf_ai_state
    w = __import__("lf_scraper").lf_worker
    st = w.state if w else {"lf_browser_open": False, "lf_logged_in": False, "lf_busy": False,
                            "lf_phase": "idle", "lf_done": 0, "lf_total": 0, "lf_log": []}
    return {"lf_worker": st, "lf_ai": {k: v for k, v in lf_ai_state.items() if k != "stop"},
            "lf_stats": lf_stats(), "lf_model": LF_AI_MODEL}


def lf_submit(cmd, **kw):
    ok, msg = lf_worker().submit(cmd, **kw)
    if not ok:
        raise HTTPException(409, msg)
    return lf_ok(lf_message=msg)


@lf_app.post("/api/lf_login")
def lf_login():
    return lf_submit("open")


@lf_app.post("/api/lf_close")
def lf_close():
    return lf_submit("close")


@lf_app.post("/api/lf_sync_list")
def lf_sync_list(body: dict = Body(default={})):
    part = "chats" if body.get("lf_part") == "chats" else "all"
    return lf_submit("sync_list", part=part)


@lf_app.post("/api/lf_sync_batch")
def lf_sync_batch(body: dict = Body(default={})):
    s = lf_get_settings()
    count = int(body.get("lf_count") or s.get("lf_batch_size", 150))
    msgs = int(body.get("lf_msgs") or s.get("lf_msgs_per_friend", 10))
    if not 1 <= count <= 300:
        raise HTTPException(400, "lf_count 需介於 1–300")
    return lf_submit("sync_batch", count=count, msgs=msgs)


@lf_app.post("/api/lf_pause")
def lf_pause():
    from lf_ai import lf_ai_state
    lf_ai_state["stop"] = True
    w = __import__("lf_scraper").lf_worker
    if w:
        w.pause()
    return lf_ok()


@lf_app.post("/api/lf_probe")
def lf_probe(body: dict = Body(default={})):
    return lf_submit("probe", label=str(body.get("lf_label") or "current"))


@lf_app.post("/api/lf_import")
def lf_import(body: dict = Body(...)):
    from lf_import_txt import lf_import_text
    text = body.get("lf_text") or ""
    if not text or len(text) > 30_000_000:
        raise HTTPException(400, "檔案內容空白或過大")
    try:
        return lf_ok(**lf_import_text(text, str(body.get("lf_filename") or ""),
                                      int(body.get("lf_keep") or 200)))
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------- 分類 ----------
@lf_app.post("/api/lf_rules_run")
def lf_rules_run():
    from lf_rules import lf_run_rules
    return lf_ok(lf_count=lf_run_rules())


@lf_app.post("/api/lf_ai_run")
def lf_ai_run(body: dict = Body(default={})):
    from lf_ai import lf_ai_start
    limit = max(1, min(int(body.get("lf_limit") or 50), 3000))
    if not lf_ai_start(limit):
        raise HTTPException(409, "AI 分類已在執行")
    return lf_ok()


@lf_app.post("/api/lf_analyze/{fid}")
def lf_analyze(fid: int, body: dict = Body(default={})):
    from lf_ai import lf_analyze as _an
    try:
        return lf_ok(lf_analysis=_an(fid, str(body.get("lf_instruction") or "")))
    except (ValueError, RuntimeError) as e:
        raise HTTPException(400, str(e))


@lf_app.get("/api/lf_analyses/{fid}")
def lf_analyses(fid: int):
    return lf_rows("SELECT * FROM lf_analyses WHERE friend_id=? ORDER BY id DESC LIMIT 20", (fid,))


@lf_app.post("/api/lf_deep_fetch/{fid}")
def lf_deep_fetch(fid: int, body: dict = Body(default={})):
    return lf_submit("deep_fetch", fid=fid, msgs=int(body.get("lf_msgs") or 100))


# ---------- 好友 ----------
@lf_app.get("/api/lf_friends")
def lf_friends(lf_q: str = "", lf_category: str = "", lf_tag: int = 0, lf_since: str = "",
               lf_until: str = "", lf_todo: str = "", lf_sort: str = "last_chat_at",
               lf_page: int = 1, lf_per: int = 50):
    return lf_query_friends(lf_q, lf_category, lf_tag, lf_since, lf_until, lf_todo,
                            lf_sort, lf_page, lf_per)


@lf_app.get("/api/lf_friends/{fid}")
def lf_friend(fid: int):
    f = lf_get_friend(fid)
    if not f:
        raise HTTPException(404, "找不到好友")
    f["messages"] = lf_get_messages(fid, 500)
    return f


@lf_app.patch("/api/lf_friends/{fid}")
def lf_friend_patch(fid: int, body: dict = Body(...)):
    if not lf_one("SELECT id FROM lf_friends WHERE id=?", (fid,)):
        raise HTTPException(404, "找不到好友")
    lf_update_friend(fid, body)
    if "lf_tag_ids" in body:
        lf_exec("DELETE FROM lf_friend_tags WHERE friend_id=? AND source='manual'", (fid,))
        for tid in body["lf_tag_ids"] or []:
            lf_exec("INSERT OR REPLACE INTO lf_friend_tags(friend_id,tag_id,source) VALUES(?,?,'manual')",
                    (fid, int(tid)))
    return lf_get_friend(fid)


@lf_app.post("/api/lf_batch")
def lf_batch(body: dict = Body(...)):
    ids = [int(x) for x in body.get("lf_ids") or []][:1000]
    act = body.get("lf_action")
    if not ids:
        raise HTTPException(400, "請先勾選好友")
    for fid in ids:
        if act == "add_tag":
            lf_exec("INSERT OR REPLACE INTO lf_friend_tags(friend_id,tag_id,source) VALUES(?,?,'manual')",
                    (fid, int(body["lf_tag_id"])))
        elif act == "remove_tag":
            lf_exec("DELETE FROM lf_friend_tags WHERE friend_id=? AND tag_id=?", (fid, int(body["lf_tag_id"])))
        elif act == "set_category":
            lf_update_friend(fid, {"lf_category": body.get("lf_category") or ""})
        else:
            raise HTTPException(400, "未知的 lf_action")
    return lf_ok(lf_count=len(ids))


# ---------- 分類 / 標籤 / 規則 / 設定 ----------
LF_TABLES = {
    "categories": ("lf_categories", ["name", "color", "rename_prefix", "sort"]),
    "tags": ("lf_tags", ["name", "color", "rule_type", "rule_value"]),
    "rules": ("lf_rules", ["field", "pattern", "category", "enabled"]),
}


@lf_app.get("/api/lf_meta/{kind}")
def lf_meta_list(kind: str):
    if kind not in LF_TABLES:
        raise HTTPException(404)
    t = LF_TABLES[kind][0]
    return lf_rows(f"SELECT * FROM {t} ORDER BY " + ("sort,id" if kind == "categories" else "id"))


@lf_app.post("/api/lf_meta/{kind}")
def lf_meta_save(kind: str, body: dict = Body(...)):
    if kind not in LF_TABLES:
        raise HTTPException(404)
    t, cols = LF_TABLES[kind]
    data = {c: body[c] for c in cols if c in body}
    if not data:
        raise HTTPException(400, "沒有可儲存的欄位")
    try:
        if body.get("id"):
            old = lf_one(f"SELECT * FROM {t} WHERE id=?", (int(body["id"]),))
            lf_exec(f"UPDATE {t} SET {','.join(c + '=?' for c in data)} WHERE id=?",
                    (*data.values(), int(body["id"])))
            if kind == "categories" and old and data.get("name") and old["name"] != data["name"]:
                for col in ("category", "ai_category", "rule_category"):
                    lf_exec(f"UPDATE lf_friends SET {col}=? WHERE {col}=?", (data["name"], old["name"]))
        else:
            lf_exec(f"INSERT INTO {t}({','.join(data)}) VALUES({','.join('?' * len(data))})",
                    tuple(data.values()))
    except Exception as e:
        raise HTTPException(400, f"儲存失敗:{e}")
    return lf_meta_list(kind)


@lf_app.delete("/api/lf_meta/{kind}/{rid}")
def lf_meta_delete(kind: str, rid: int):
    if kind not in LF_TABLES:
        raise HTTPException(404)
    lf_exec(f"DELETE FROM {LF_TABLES[kind][0]} WHERE id=?", (rid,))
    return lf_meta_list(kind)


@lf_app.get("/api/lf_settings")
def lf_settings_get():
    return lf_get_settings()


@lf_app.put("/api/lf_settings")
def lf_settings_put(body: dict = Body(...)):
    lf_set_settings({k: v for k, v in body.items() if k.startswith("lf_")})
    return lf_get_settings()


# ---------- 改名(需勾選確認) ----------
from lf_server_rename import lf_rename_router  # noqa: E402

lf_app.include_router(lf_rename_router)


if __name__ == "__main__":
    import uvicorn
    port = int(sys.argv[1]) if len(sys.argv) > 1 else LF_PORT
    print(f"lf_ 好友整理工具:http://{LF_HOST}:{port}")
    uvicorn.run(lf_app, host=LF_HOST, port=port, log_level="warning")
