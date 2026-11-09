"""lf_ 改名 API。流程:產生提案(pending)→ 勾選確認(confirmed)→ 執行(done)。"""
from fastapi import APIRouter, Body, HTTPException

from lf_db import lf_exec, lf_now, lf_one, lf_rows

lf_rename_router = APIRouter()


def lf_ids(body: dict) -> list[int]:
    ids = [int(x) for x in body.get("lf_ids") or []][:1000]
    if not ids:
        raise HTTPException(400, "請先勾選項目")
    return ids


@lf_rename_router.get("/api/lf_renames")
def lf_renames(lf_status: str = ""):
    sql = ("SELECT r.*, f.category FROM lf_renames r LEFT JOIN lf_friends f ON f.id=r.friend_id")
    if lf_status:
        return lf_rows(sql + " WHERE r.status=? ORDER BY r.id DESC LIMIT 2000", (lf_status,))
    return lf_rows(sql + " WHERE r.status!='cancelled' ORDER BY r.id DESC LIMIT 2000")


@lf_rename_router.post("/api/lf_renames/propose")
def lf_propose(body: dict = Body(...)):
    """依範本產生提案。範本可用 {prefix}(分類前綴)、{name}、{category}。"""
    tpl = str(body.get("lf_template") or "{prefix}{name}")
    if "{name}" not in tpl:
        raise HTTPException(400, "範本必須包含 {name}")
    cats = {r["name"]: r["rename_prefix"] or "" for r in lf_rows("SELECT * FROM lf_categories")}
    made = skipped = 0
    for fid in lf_ids(body):
        f = lf_one("SELECT id,name,category FROM lf_friends WHERE id=?", (fid,))
        if not f:
            continue
        prefix = cats.get(f["category"] or "", "")
        if prefix and f["name"].startswith(prefix):
            skipped += 1
            continue
        new = tpl.replace("{prefix}", prefix).replace("{name}", f["name"]) \
                 .replace("{category}", f["category"] or "")[:20].strip()
        if not new or new == f["name"]:
            skipped += 1
            continue
        lf_exec("UPDATE lf_renames SET status='cancelled' WHERE friend_id=? AND status IN ('pending','confirmed')",
                (fid,))
        lf_exec("INSERT INTO lf_renames(friend_id,old_name,new_name,status,created_at) VALUES(?,?,?,'pending',?)",
                (fid, f["name"], new, lf_now()))
        made += 1
    return {"lf_ok": True, "lf_made": made, "lf_skipped": skipped}


@lf_rename_router.post("/api/lf_renames/edit")
def lf_edit(body: dict = Body(...)):
    new = str(body.get("lf_new_name") or "").strip()[:20]
    if not new:
        raise HTTPException(400, "新名稱不可空白")
    # 改了內容就退回待確認,必須重新勾選
    lf_exec("UPDATE lf_renames SET new_name=?,status='pending',confirmed_at=NULL "
            "WHERE id=? AND status IN ('pending','confirmed','failed')", (new, int(body.get("lf_id") or 0)))
    return {"lf_ok": True}


@lf_rename_router.post("/api/lf_renames/confirm")
def lf_confirm(body: dict = Body(...)):
    ids = lf_ids(body)
    q = ",".join("?" * len(ids))
    n = lf_exec(f"UPDATE lf_renames SET status='confirmed',confirmed_at=? "
                f"WHERE id IN ({q}) AND status IN ('pending','failed')", (lf_now(), *ids))
    return {"lf_ok": True, "lf_count": n}


@lf_rename_router.post("/api/lf_renames/unconfirm")
def lf_unconfirm(body: dict = Body(...)):
    ids = lf_ids(body)
    lf_exec(f"UPDATE lf_renames SET status='pending',confirmed_at=NULL "
            f"WHERE id IN ({','.join('?' * len(ids))}) AND status='confirmed'", ids)
    return {"lf_ok": True}


@lf_rename_router.post("/api/lf_renames/cancel")
def lf_cancel(body: dict = Body(...)):
    ids = lf_ids(body)
    lf_exec(f"UPDATE lf_renames SET status='cancelled' "
            f"WHERE id IN ({','.join('?' * len(ids))}) AND status IN ('pending','confirmed','failed')", ids)
    return {"lf_ok": True}


@lf_rename_router.post("/api/lf_renames/revert")
def lf_revert(body: dict = Body(...)):
    r = lf_one("SELECT * FROM lf_renames WHERE id=? AND status='done'", (int(body.get("lf_id") or 0),))
    if not r:
        raise HTTPException(404, "只能還原已完成的改名")
    lf_exec("INSERT INTO lf_renames(friend_id,old_name,new_name,status,created_at) VALUES(?,?,?,'pending',?)",
            (r["friend_id"], r["new_name"], r["old_name"], lf_now()))
    return {"lf_ok": True, "lf_message": "已產生還原提案,請勾選確認後執行"}


@lf_rename_router.post("/api/lf_renames/run")
def lf_run(body: dict = Body(...)):
    if body.get("lf_ack") is not True:
        raise HTTPException(400, "需勾選「我確認要修改 LINE 顯示名稱」")
    n = lf_one("SELECT COUNT(*) n FROM lf_renames WHERE status='confirmed'")["n"]
    if not n:
        raise HTTPException(400, "沒有已確認的改名項目")
    from lf_scraper import lf_get_worker
    ok, msg = lf_get_worker().submit("rename", limit=int(body.get("lf_limit") or 30))
    if not ok:
        raise HTTPException(409, msg)
    return {"lf_ok": True, "lf_count": min(n, int(body.get("lf_limit") or 30))}
