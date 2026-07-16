"""
每日發票抓取 — 從財政部電子發票平台拉手機條碼載具發票,分類、存 Supabase,
超支時用 LINE 提醒。

Usage:
  python scripts/fetch_invoices.py                # 抓昨天至今天,存檔 + 超支才推播
  python scripts/fetch_invoices.py --test         # 用假資料跑完整流程,不推播
  python scripts/fetch_invoices.py --days N        # 往回抓 N 天 (預設 2)
  python scripts/fetch_invoices.py --report        # 只發本月消費整理到 LINE
"""
import os
import sys
import io
import logging
from pathlib import Path
from datetime import datetime, timedelta

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / "config" / ".env")
except ModuleNotFoundError:
    pass  # dotenv optional — env vars may be provided directly by the runner

from src import einvoice_client as inv
from src import spending
from src.database import (
    get_existing_inv_nums, save_invoice, load_month_invoices, get_line_target,
)
from src.line_sender import send_daily_message

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_DIR / "invoices.log", encoding="utf-8"),
              logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


def parse_args():
    test = "--test" in sys.argv
    report_only = "--report" in sys.argv
    days = 2
    if "--days" in sys.argv:
        i = sys.argv.index("--days")
        if i + 1 < len(sys.argv):
            days = int(sys.argv[i + 1])
    return test, report_only, days


def fetch_and_store(days: int, test_mode: bool) -> int:
    """Fetch invoices for the last `days` days, categorize, store. Returns count of NEW invoices."""
    end = datetime.now()
    start = end - timedelta(days=days)
    start_s, end_s = start.strftime("%Y/%m/%d"), end.strftime("%Y/%m/%d")

    mode = "假資料" if (test_mode or not inv.is_live()) else "正式 API"
    log.info(f"抓取發票 {start_s} ~ {end_s}（{mode}）")

    headers = inv.fetch_headers(start_s, end_s, use_fixture=test_mode)
    log.info(f"取得 {len(headers)} 張發票表頭")

    known = get_existing_inv_nums()
    new_count = 0
    for h in headers:
        if h["invNum"] in known:
            continue
        items = inv.fetch_detail(h["invNum"], h["invDate"], use_fixture=test_mode)
        descriptions = [it["description"] for it in items]
        category = spending.categorize(h["sellerName"], descriptions)
        save_invoice(h, category, items)
        new_count += 1
        log.info(f"  + {h['invDate']} {h['sellerName']} NT${h['amount']} → {category}"
                 f"（{len(items)} 品項）")

    log.info(f"新增 {new_count} 張發票")
    return new_count


def build_month_report() -> tuple[dict, dict]:
    """Return (summary, budget) for the current month."""
    ym = datetime.now().strftime("%Y/%m")
    rows = load_month_invoices(ym)
    invoices = [{"category": r.get("category"), "amount": r.get("amount")} for r in rows]
    summary = spending.summarize(invoices)
    budget = spending.load_budget()
    return summary, budget


def run(test_mode: bool, report_only: bool, days: int):
    log.info("=" * 45)
    log.info("電子發票 — 消費追蹤啟動" + (" [TEST]" if test_mode else ""))
    log.info("=" * 45)

    if not report_only:
        fetch_and_store(days, test_mode)

    summary, budget = build_month_report()
    ym_label = datetime.now().strftime("%Y 年 %m 月")
    report = spending.format_report(summary, budget, ym_label)
    alerts = spending.budget_status(summary, budget)

    print("\n" + report + "\n")

    if test_mode:
        log.info("[TEST] 不推播 LINE。")
        return

    target = get_line_target()
    if not target:
        log.warning("未設定 LINE 目標,略過推播。")
        return

    # Push when: --report requested, OR any budget alert fired.
    if report_only or alerts:
        try:
            send_daily_message(target, report)
            log.info("LINE 推播成功。")
        except Exception as e:
            log.error(f"LINE 發送失敗: {e}")
    else:
        log.info("無超支,今日不打擾。")

    log.info("完成。")


if __name__ == "__main__":
    test, report_only, days = parse_args()
    run(test_mode=test, report_only=report_only, days=days)
