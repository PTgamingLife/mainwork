"""lf_ 改顯示名稱 — 本工具唯一會修改 LINE 的動作。

安全閘:
1. 只處理 lf_renames 中 status='confirmed'(網頁上勾選並確認)的項目。
2. 每次最多 limit 筆,每筆之間隨機間隔。
3. 只在好友資料視窗內的名稱輸入框輸入;拒絕 textarea / contenteditable(訊息輸入框)。
4. 改名只影響「你自己看到的顯示名稱」,對方看不到;舊名稱存在 lf_renames 可還原。
"""
import time

from lf_db import lf_exec, lf_now, lf_rows


def lf_rename_one(w, old: str, new: str, mid: str | None = None) -> None:
    s, page = w.sel, w.page
    w._click_tab("lf_tab_friends")
    box = page.locator(s["lf_search_input"]).first
    w._safe_fill(box, old)
    time.sleep(1.5)
    items = w._items("lf_friend_item", "lf_friend_name")
    idx = next((i for i, it in enumerate(items)
                if (mid and it["mid"] == mid) or (not mid and it["name"] == old and not it["group"])), -1)
    if idx < 0:
        raise RuntimeError("在好友清單找不到這個名稱")
    page.locator(s["lf_friend_item"]).nth(idx).click(timeout=8000)
    page.wait_for_selector(s["lf_profile_dialog"], timeout=8000)
    page.locator(s["lf_profile_edit_name"]).first.click(timeout=8000)
    inp = page.locator(s["lf_profile_name_input"]).first
    inp.wait_for(timeout=8000)
    info = inp.evaluate("(e, d) => [e.tagName, e.isContentEditable, !!e.closest(d)]",
                        s["lf_profile_dialog"])
    if info[0] != "INPUT" or info[1] or not info[2]:
        raise RuntimeError("安全閘:名稱欄位不是好友資料視窗內的單行輸入框,停止")
    inp.fill(new[:20])
    page.locator(s["lf_profile_name_save"]).first.click(timeout=8000)
    time.sleep(1.2)
    page.keyboard.press("Escape")  # 關閉好友資料視窗(不在聊天輸入框內)


def lf_run_renames(w, limit: int = 30) -> None:
    rows = lf_rows("SELECT r.*, f.mid FROM lf_renames r LEFT JOIN lf_friends f ON f.id=r.friend_id "
                   "WHERE r.status='confirmed' ORDER BY r.id LIMIT ?", (max(1, min(limit, 100)),))
    w.state.update(lf_phase="rename", lf_done=0, lf_total=len(rows))
    for i, r in enumerate(rows):
        if w.pause_ev.is_set():
            w.log(f"改名已暫停,完成 {i}/{len(rows)}")
            break
        w.state.update(lf_current=f"{r['old_name']} → {r['new_name']}", lf_done=i)
        try:
            lf_rename_one(w, r["old_name"], r["new_name"], r.get("mid"))
            lf_exec("UPDATE lf_renames SET status='done',done_at=?,error=NULL WHERE id=?",
                    (lf_now(), r["id"]))
            lf_exec("UPDATE lf_friends SET name=?,custom_name=?,updated_at=? WHERE id=?",
                    (r["new_name"], r["new_name"], lf_now(), r["friend_id"]))
            w.log(f"已改名:{r['old_name']} → {r['new_name']}")
        except Exception as e:
            lf_exec("UPDATE lf_renames SET status='failed',error=? WHERE id=?", (str(e)[:300], r["id"]))
            w.log(f"改名失敗 {r['old_name']}:{e}")
            try:
                w.page.keyboard.press("Escape")
            except Exception:
                pass
        w._sleep(4, 9)
    w.state["lf_done"] = len(rows)
