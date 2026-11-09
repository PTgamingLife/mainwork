"""PoC:確認 Playwright 能載入 LINE 擴充並顯示登入頁。只開啟、截圖、輸出遮蔽後的 DOM 骨架,不登入、不操作。
用法:python tests/lf_poc_launch.py <輸出資料夾>
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from playwright.sync_api import sync_playwright  # noqa: E402

from lf_config import LF_PROFILE  # noqa: E402
from lf_probe import LF_JS_SKELETON  # noqa: E402
from lf_scraper import lf_load_selectors, lf_prepare_ext  # noqa: E402

out = sys.argv[1]
ext = lf_prepare_ext()
sel = lf_load_selectors()
with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        str(LF_PROFILE), headless=False, channel="chromium",
        args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}"])
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(sel["lf_app_url"])
    time.sleep(10)
    page.screenshot(path=os.path.join(out, "lf_poc.png"))
    with open(os.path.join(out, "lf_poc_dom.txt"), "w", encoding="utf-8") as f:
        f.write(page.evaluate(LF_JS_SKELETON))
    print("url:", page.url, "| login marker:", page.locator(sel["lf_login_marker"]).count(),
          "| logged-in marker:", page.locator(sel["lf_logged_in_marker"]).count())
    ctx.close()
