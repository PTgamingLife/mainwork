"""lf_ LINE Chrome 擴充只讀抓取器。

安全原則:
- 只讀:不會點「傳送」、不會在訊息輸入框打字、不加好友、不退群。
- 唯一會改 LINE 的動作是 lf_renamer(改顯示名稱),且只處理網頁上勾選確認過的項目。
- 所有 Playwright 操作都在單一背景執行緒內進行。
"""
import json
import queue
import random
import shutil
import threading
import time
import traceback

from lf_config import LF_EXT_DIR, LF_EXT_ID, LF_PROFILE, LF_SELECTORS
from lf_db import (lf_exec, lf_get_setting, lf_next_batch, lf_now, lf_one, lf_rows,
                   lf_save_messages, lf_upsert_friend)
from lf_parse import lf_combine, lf_parse_clock, lf_parse_date, lf_parse_list_time

LF_JS_ITEMS = """([itemSel, nameSel, subSel, timeSel, unreadSel, groupSel]) => {
  const txt = (n) => { if (!n) return ''; let s = '';
    n.childNodes.forEach(c => { if (c.nodeType === 3) s += c.textContent;
      else if (c.tagName === 'IMG') s += c.alt || ''; else if (c.nodeType === 1) s += txt(c); });
    return s; };
  const pick = (el, sel) => sel ? txt(el.querySelector(sel)).replace(/\\s+/g, ' ').trim() : '';
  return [...document.querySelectorAll(itemSel)].map(el => ({
    mid: el.getAttribute('data-mid') || '',
    name: pick(el, nameSel), sub: pick(el, subSel), time: pick(el, timeSel),
    unread: unreadSel ? !!el.querySelector(unreadSel) : false,
    group: groupSel ? !!el.querySelector(groupSel) : false }));
}"""

LF_JS_MARK_SCROLL = """([itemSel, mark]) => {
  document.querySelectorAll('[' + mark + ']').forEach(e => e.removeAttribute(mark));
  let e = document.querySelector(itemSel);
  while (e && e !== document.body) {
    const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5) {
      e.setAttribute(mark, '1'); return true; }
    e = e.parentElement; }
  return false;
}"""

LF_JS_SCROLL = """([mark, dir]) => {
  const e = document.querySelector('[' + mark + ']'); if (!e) return {ok: false};
  // column-reverse 清單(LINE 聊天室):最上方是負的 scrollTop
  const rev = [e, e.firstElementChild].some(x => x && getComputedStyle(x).flexDirection === 'column-reverse');
  if (dir === 'up') e.scrollTop = rev ? -e.scrollHeight : 0;
  else e.scrollTop += Math.max(200, e.clientHeight * 0.8);
  return {ok: true, top: e.scrollTop, bottom: e.scrollTop + e.clientHeight >= e.scrollHeight - 4};
}"""

LF_JS_MSGS = """([itemSel, dateSel, textSel, timeSel, roomSel]) => {
  const txt = (n) => { if (!n) return ''; let s = '';
    n.childNodes.forEach(c => { if (c.nodeType === 3) s += c.textContent;
      else if (c.tagName === 'IMG') s += c.alt || ''; else if (c.nodeType === 1) s += txt(c); });
    return s; };
  const room = document.querySelector(roomSel);
  const roomMid = room ? (room.getAttribute('data-mid') || '') : '';
  const kind = (el) => el.querySelector('[class*="stickerMessageContent"]') ? '[貼圖]'
    : el.querySelector('[class*="imageMessageContent"], img.image') ? '[圖片]'
    : el.querySelector('[class*="contactMessageContent"]') ? '[聯絡人]'
    : el.querySelector('[class*="fileMessageContent"]') ? '[檔案]' : '[非文字訊息]';
  const out = [];
  document.querySelectorAll(itemSel + ',' + dateSel).forEach(el => {
    if (el.matches(dateSel)) { out.push({k: 'd', t: txt(el).trim()}); return; }
    const tx = el.querySelector(textSel), tm = el.querySelector(timeSel);
    const mid = el.getAttribute('data-mid') || '';
    out.push({k: 'm', t: tx ? txt(tx).trim() : kind(el),
      mine: roomMid ? mid !== roomMid : false, time: tm ? txt(tm).trim() : ''});
  });
  return out;
}"""


def lf_load_selectors() -> dict:
    return json.loads(LF_SELECTORS.read_text(encoding="utf-8"))


def lf_prepare_ext() -> str:
    """把使用者 Chrome 已安裝的 LINE 擴充複製到 lf_ext/(本機、不進 git)。"""
    if (LF_EXT_DIR / "manifest.json").exists():
        return str(LF_EXT_DIR)
    import os
    import pathlib
    base = pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "Google" / "Chrome" / "User Data"
    found = sorted(base.glob(f"*/Extensions/{LF_EXT_ID}/*/manifest.json"),
                   key=lambda p: [int(x) if x.isdigit() else 0
                                  for x in p.parent.name.replace("_", ".").split(".")])
    if not found:
        raise RuntimeError("找不到 LINE Chrome 擴充。請先在一般 Chrome 安裝 LINE 擴充,"
                           "或把擴充資料夾放到 tools/line-friends/lf_ext/")
    shutil.copytree(found[-1].parent, LF_EXT_DIR, ignore=shutil.ignore_patterns("_metadata"))
    return str(LF_EXT_DIR)


class LfWorker:
    def __init__(self):
        self.q: queue.Queue = queue.Queue()
        self.pause_ev = threading.Event()
        self.pw = self.ctx = self.page = None
        self.sel = lf_load_selectors()
        self.state = {"lf_browser_open": False, "lf_logged_in": False, "lf_busy": False,
                      "lf_phase": "idle", "lf_done": 0, "lf_total": 0, "lf_current": "",
                      "lf_error": "", "lf_log": []}
        threading.Thread(target=self._loop, daemon=True, name="lf_worker").start()

    # ---------- 對外 ----------
    def submit(self, cmd: str, **kw) -> tuple[bool, str]:
        if cmd != "close" and self.state["lf_busy"]:
            return False, "目前有工作在執行,請先暫停或等待完成"
        if cmd not in ("open", "close") and not self.state["lf_browser_open"]:
            return False, "請先按「開啟 LINE 登入」"
        self.pause_ev.clear()
        self.state["lf_busy"] = cmd not in ("close",)
        self.q.put((cmd, kw))
        return True, "已排入"

    def pause(self) -> None:
        self.pause_ev.set()
        self.log("收到暫停,完成目前這位後停止")

    def log(self, msg: str) -> None:
        line = time.strftime("%H:%M:%S ") + msg
        self.state["lf_log"] = (self.state["lf_log"] + [line])[-40:]

    # ---------- 執行緒迴圈 ----------
    def _loop(self):
        while True:
            try:
                cmd, kw = self.q.get(timeout=3)
            except queue.Empty:
                self._check_login()
                continue
            try:
                self.sel = lf_load_selectors()  # 每次重讀,改 json 免重啟
                getattr(self, "_do_" + cmd)(**kw)
                self.state["lf_error"] = ""
            except Exception as e:
                self.state["lf_error"] = str(e)
                self.log("錯誤:" + str(e))
                traceback.print_exc()
            finally:
                self.state.update(lf_busy=False, lf_phase="idle", lf_current="")

    def _check_login(self):
        if not self.page:
            return
        try:
            if self.page.is_closed():
                raise RuntimeError
            self.state["lf_logged_in"] = self.page.locator(
                self.sel["lf_logged_in_marker"]).count() > 0
        except Exception:
            self.state.update(lf_browser_open=False, lf_logged_in=False)
            self.page = None

    def _sleep(self, a=None, b=None):
        a = float(a if a is not None else lf_get_setting("lf_delay_min", "3"))
        b = float(b if b is not None else lf_get_setting("lf_delay_max", "8"))
        time.sleep(random.uniform(a, max(a, b)))

    # ---------- 指令 ----------
    def _do_open(self):
        from playwright.sync_api import sync_playwright
        if self.page and not self.page.is_closed():
            self.page.bring_to_front()
            return
        ext = lf_prepare_ext()
        LF_PROFILE.mkdir(exist_ok=True)
        if not self.pw:
            self.pw = sync_playwright().start()
        self.ctx = self.pw.chromium.launch_persistent_context(
            str(LF_PROFILE), headless=False, no_viewport=True, channel="chromium",
            args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}",
                  "--window-size=1100,800"])
        self.page = self.ctx.pages[0] if self.ctx.pages else self.ctx.new_page()
        self.page.goto(self.sel["lf_app_url"])
        self.state["lf_browser_open"] = True
        self.log("已開啟 LINE,請用手機 LINE 掃 QR 碼登入")

    def _do_close(self):
        try:
            if self.ctx:
                self.ctx.close()
        finally:
            self.ctx = self.page = None
            self.state.update(lf_browser_open=False, lf_logged_in=False)

    def _click_tab(self, key: str):
        loc = self.page.locator(self.sel[key]).first
        loc.click(timeout=8000)
        time.sleep(1.2)

    def _items(self, item_key, name_key, sub_key="", time_key="", unread_key="") -> list[dict]:
        s = self.sel
        return self.page.evaluate(LF_JS_ITEMS, [s[item_key], s[name_key], s.get(sub_key, ""),
                                                s.get(time_key, ""), s.get(unread_key, ""),
                                                s.get("lf_group_marker", "")])

    def _collect(self, item_key, name_key, sub_key, time_key="", unread_key="", cap=20000,
                 idle_max=4, bottom_wait=0.0):
        """捲動虛擬清單收集項目(以 mid 去重,排除群組)。
        bottom_wait:捲到底仍沒新項目時多等幾秒(聊天清單到底才會載入更舊的聊天)。"""
        s = self.sel
        self.page.wait_for_selector(s[item_key], timeout=30000)
        self.page.evaluate(LF_JS_MARK_SCROLL, [s[item_key], "data-lf-scroll"])
        seen: dict[str, dict] = {}
        idle = 0
        while idle < idle_max and len(seen) < cap:
            if self.pause_ev.is_set():
                break
            items = self._items(item_key, name_key, sub_key, time_key, unread_key)
            before = len(seen)
            for it in items:
                key = it["mid"] or it["name"]
                if it["name"] and not it["group"] and key not in seen:
                    seen[key] = it
            self.state.update(lf_done=len(seen), lf_current=f"已讀到 {len(seen)} 筆")
            r = self.page.evaluate(LF_JS_SCROLL, ["data-lf-scroll", "down"])
            stuck = len(seen) == before and r.get("bottom", True)
            idle = idle + 1 if stuck else 0
            time.sleep(random.uniform(0.6, 1.3) + (bottom_wait if stuck else 0))
        return list(seen.values())

    def _self_mid(self) -> str:
        """好友清單最上方、第一個分類標題之前的項目是「自己」。記在設定裡。"""
        from lf_db import lf_set_settings
        cached = lf_get_setting("lf_self_mid", "")
        if cached:
            return cached
        mid = self.page.evaluate(
            """(sel) => { const first = document.querySelector(sel); if (!first) return '';
              let p = first.previousElementSibling;
              while (p) { if (String(p.className).includes('categoryLayout')) return ''; p = p.previousElementSibling; }
              return first.getAttribute('data-mid') || ''; }""", self.sel["lf_friend_item"])
        if mid:
            lf_set_settings({"lf_self_mid": mid})
        return mid

    def _do_sync_list(self, part: str = "all"):
        """抓好友清單(名稱+狀態消息)與聊天清單(最後聊天時間、未讀)。不開任何聊天室。
        part=all 兩者都抓;part=chats 只更新聊天清單。"""
        if part != "chats":
            self.state.update(lf_phase="friends", lf_done=0, lf_total=0)
            self._click_tab("lf_tab_friends")
            self.page.wait_for_selector(self.sel["lf_friend_item"], timeout=30000)
            me = self._self_mid()
            friends = [f for f in self._collect("lf_friend_item", "lf_friend_name", "lf_friend_status")
                       if f["mid"] != me]
            for f in friends:
                lf_upsert_friend(f["name"], mid=f["mid"], status_msg=f["sub"], list_synced_at=lf_now())
            self.log(f"好友清單:{len(friends)} 位(已排除群組)")
            if self.pause_ev.is_set():
                return
        self.state.update(lf_phase="chats", lf_done=0)
        self._click_tab("lf_tab_chats")
        chats = self._collect("lf_chat_item", "lf_chat_name", "lf_chat_preview",
                              "lf_chat_time", "lf_chat_unread", idle_max=6, bottom_wait=3.0)
        known = {r["mid"] for r in lf_rows("SELECT mid FROM lf_friends WHERE mid IS NOT NULL")}
        n = 0
        for c in chats:
            if known and c["mid"] not in known:
                continue  # 非好友的聊天室略過
            lf_upsert_friend(c["name"], mid=c["mid"], in_chatlist=1,
                             has_unread=1 if c["unread"] else 0,
                             last_chat_at=lf_parse_list_time(c["time"]), last_preview=c["sub"][:200])
            n += 1
        self.log(f"聊天清單:{len(chats)} 個,對應好友 {n} 位")

    def _open_chat(self, name: str, mid: str | None = None) -> bool:
        """在聊天分頁搜尋並開啟聊天室。有未讀時(預設)不開,避免對方看到已讀。"""
        s = self.sel
        self._click_tab("lf_tab_chats")
        box = self.page.locator(s["lf_search_input"]).first
        self._safe_fill(box, name)
        time.sleep(1.8)
        items = self._items("lf_chat_item", "lf_chat_name", unread_key="lf_chat_unread")
        idx = next((i for i, it in enumerate(items)
                    if (mid and it["mid"] == mid) or (not mid and it["name"] == name and not it["group"])),
                   -1)
        if idx < 0:
            return False
        if items[idx]["unread"] and lf_get_setting("lf_skip_unread", "1") == "1":
            lf_upsert_friend(name, mid=mid, has_unread=1)
            raise LookupError("有未讀訊息,略過(避免顯示已讀)")
        item = self.page.locator(s["lf_chat_item"]).nth(idx)
        btn = item.locator(s["lf_chat_open_button"])
        if btn.count():
            btn.first.evaluate("e => e.click()")  # 按鈕被名稱區塊蓋住,直接觸發 click
        else:
            item.click(timeout=8000)
        self.page.wait_for_selector(s["lf_msg_item"], timeout=10000)
        time.sleep(0.8)
        return True

    def _safe_fill(self, loc, text: str):
        """安全閘:只允許在搜尋框輸入,拒絕任何訊息輸入框。"""
        info = loc.evaluate("e => [e.tagName, e.isContentEditable, e.type || '']")
        if info[0] == "TEXTAREA" or info[1] or loc.evaluate(
                "(e, s) => e.matches(s)", self.sel["lf_msg_input_forbidden"]):
            raise RuntimeError("安全閘:拒絕在訊息輸入框輸入文字")
        loc.fill(text)

    def _read_msgs(self, n: int) -> list[dict]:
        s = self.sel
        self.page.evaluate(LF_JS_MARK_SCROLL, [s["lf_msg_item"], "data-lf-mscroll"])
        args = [s["lf_msg_item"], s["lf_date_divider"], s["lf_msg_text"], s["lf_msg_time"],
                s["lf_chatroom"]]
        def chrono() -> list[dict]:
            # LINE 訊息清單是 column-reverse:DOM 由新到舊、日期線在該日訊息之後 → 反轉成時間順序
            return list(reversed(self.page.evaluate(LF_JS_MSGS, args)))

        last, still = -1, 0
        for _ in range(40):
            raw = chrono()
            cnt = sum(1 for r in raw if r["k"] == "m")
            if cnt >= n:
                # 要保留的最舊那則之前必須有日期分隔線,否則日期不明 → 再往上捲
                m_idx = [i for i, r in enumerate(raw) if r["k"] == "m"]
                if any(r["k"] == "d" for r in raw[:m_idx[-n] + 1]):
                    break
            still = still + 1 if cnt == last else 0
            if still >= 3:
                break
            last = cnt
            self.page.evaluate(LF_JS_SCROLL, ["data-lf-mscroll", "up"])
            time.sleep(random.uniform(0.8, 1.5))
        raw = chrono()
        cur_date, out = None, []
        for r in raw:
            if r["k"] == "d":
                cur_date = lf_parse_date(r["t"]) or cur_date
                continue
            out.append({"sent_at": lf_combine(cur_date, lf_parse_clock(r["time"])),
                        "sender": "me" if r["mine"] else "them",
                        "content": r["t"] or "[非文字訊息]"})
        return out[-n:]

    def _do_sync_batch(self, count: int, msgs: int):
        from lf_rules import lf_run_rules
        count, msgs = max(1, min(int(count), 300)), max(1, min(int(msgs), 50))
        batch = lf_next_batch(count)
        self.state.update(lf_phase="messages", lf_done=0, lf_total=len(batch))
        skip_unread = lf_get_setting("lf_skip_unread", "1") == "1"
        done_ids = []
        for i, f in enumerate(batch):
            if self.pause_ev.is_set():
                self.log(f"已暫停,完成 {i}/{len(batch)}")
                break
            self.state.update(lf_current=f["name"], lf_done=i)
            if f["has_unread"] and skip_unread:
                self.log(f"略過(未讀):{f['name']}")
                lf_exec("UPDATE lf_friends SET msg_synced_at=? WHERE id=?", (lf_now(), f["id"]))
                continue
            try:
                if self._open_chat(f["name"], f["mid"]):
                    got = self._read_msgs(msgs)
                    lf_save_messages(f["id"], got, keep=msgs)
                    done_ids.append(f["id"])
                else:
                    self.log(f"找不到聊天室:{f['name']}")
                    lf_exec("UPDATE lf_friends SET in_chatlist=0,msg_synced_at=? WHERE id=?",
                            (lf_now(), f["id"]))
            except LookupError as e:
                self.log(f"{f['name']}:{e}")
                lf_exec("UPDATE lf_friends SET msg_synced_at=? WHERE id=?", (lf_now(), f["id"]))
            except Exception as e:
                self.log(f"{f['name']} 失敗:{e}")
            self._sleep()
        self.state["lf_done"] = len(done_ids)
        lf_run_rules(done_ids)
        self.log(f"本次完成 {len(done_ids)} 位")

    def _do_deep_fetch(self, fid: int, msgs: int):
        f = lf_one("SELECT id,mid,name FROM lf_friends WHERE id=?", (int(fid),))
        if not f:
            raise ValueError("找不到好友")
        msgs = max(10, min(int(msgs), 300))
        self.state.update(lf_phase="deep", lf_total=1, lf_done=0, lf_current=f["name"])
        lf_exec("UPDATE lf_friends SET keep_n=? WHERE id=?", (msgs, f["id"]))
        if not self._open_chat(f["name"], f["mid"]):
            raise RuntimeError("找不到這位好友的聊天室")
        got = self._read_msgs(msgs)
        n = lf_save_messages(f["id"], got, keep=msgs, source="deep")
        self.state["lf_done"] = 1
        self.log(f"深度抓取 {f['name']}:{n} 則")

    def _do_probe(self, label: str = "current"):
        """label=friends/chats 先切分頁;chatroom 會打開第一個「沒有未讀」的聊天室。"""
        from lf_probe import lf_probe_page
        if label == "chatscan":
            from lf_probe import lf_scan_classes
            self._click_tab("lf_tab_chats")
            self.page.wait_for_selector(self.sel["lf_chat_item"], timeout=30000)
            self.log("已輸出聊天清單 class 統計:" + lf_scan_classes(self.page, self.sel["lf_chat_item"]))
            return
        if label == "friendroom":
            # 實驗:從好友清單打開一位「不在聊天清單」的好友,只統計載入的訊息數與日期分隔數
            s = self.sel
            self._click_tab("lf_tab_friends")
            self.page.wait_for_selector(s["lf_friend_item"], timeout=30000)
            inchat = {r["mid"] for r in lf_rows("SELECT mid FROM lf_friends WHERE in_chatlist=1")}
            inchat.add(self._self_mid())
            items = self._items("lf_friend_item", "lf_friend_name")
            idx = next((i for i, it in enumerate(items)
                        if it["mid"] and it["mid"] not in inchat and not it["group"]), -1)
            if idx < 0:
                raise RuntimeError("畫面上沒有不在聊天清單的好友")
            self.page.locator(s["lf_friend_item"]).nth(idx).locator(
                s["lf_friend_chat_button"]).first.evaluate("e => e.click()")
            time.sleep(5)
            n_msg = self.page.locator(s["lf_msg_item"]).count()
            n_date = self.page.locator(s["lf_date_divider"]).count()
            self.log(f"實驗:不在聊天清單的好友,開啟後載入 {n_msg} 則訊息、{n_date} 個日期")
            return
        if label == "msgorder":
            # 診斷:目前聊天室的排版方向與「日期/時間」順序(不含訊息內容)
            s = self.sel
            info = self.page.evaluate(
                """([item, date, tm]) => { const first = document.querySelector(item);
                  let p = first; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
                  const seq = [...document.querySelectorAll(item + ',' + date)].map(e => e.matches(date)
                    ? 'D:' + e.textContent.trim() : 'M:' + ((e.querySelector(tm) || {}).textContent || '').trim());
                  return {dir: p ? getComputedStyle(p).flexDirection : '', inner: first ? getComputedStyle(first.parentElement).flexDirection : '', seq}; }""",
                [s["lf_msg_item"], s["lf_date_divider"], s["lf_msg_time"]])
            self.log("訊息順序診斷:" + json.dumps(info, ensure_ascii=False)[:1500])
            return
        if label == "friends":
            self._click_tab("lf_tab_friends")
        elif label in ("chats", "chatroom"):
            self._click_tab("lf_tab_chats")
        if label == "chatroom":
            s = self.sel
            self.page.wait_for_selector(s["lf_chat_item"], timeout=30000)
            items = self._items("lf_chat_item", "lf_chat_name", unread_key="lf_chat_unread")
            idx = next((i for i, it in enumerate(items) if not it["unread"] and not it["group"]), -1)
            if idx < 0:
                raise RuntimeError("找不到沒有未讀的聊天室")
            self.page.locator(s["lf_chat_item"]).nth(idx).click(timeout=8000)
            time.sleep(3)
        path = lf_probe_page(self.page, label)
        self.log(f"已輸出頁面結構(文字已遮蔽):{path}")

    def _do_rename(self, limit: int = 30):
        from lf_renamer import lf_run_renames
        lf_run_renames(self, int(limit))


lf_worker = None


def lf_get_worker() -> LfWorker:
    global lf_worker
    if lf_worker is None:
        lf_worker = LfWorker()
    return lf_worker
