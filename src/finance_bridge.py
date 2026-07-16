"""
發票 → 家庭財務模型橋接。

把已抓取分類的電子發票,寫進 household-finance/data.json 的 transactions
(實際流水帳)。**不動 expenses**(那是規劃預算,由 household-finance skill
的記帳/建議模式管理),避免自動覆蓋破壞模型。

去重:每筆 bridged transaction 帶 "inv" = 發票號碼,已存在則跳過。
分類:把 spending.py 的稅目對應到家庭財務模型使用的稅目。
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_JSON = ROOT / "household-finance" / "data.json"

# 電子發票分類 → 家庭財務模型稅目(居住/飲食/交通/娛樂/通訊/其他)
CATEGORY_MAP = {
    "餐飲": "飲食",
    "超商": "飲食",
    "生活": "飲食",   # 超市/量販採買
    "交通": "交通",
    "居家": "居住",
    "娛樂": "娛樂",
    "購物": "其他",
    "醫療": "其他",
    "其他": "其他",
}


def map_category(einvoice_category: str) -> str:
    return CATEGORY_MAP.get(einvoice_category, "其他")


def _to_iso_date(inv_date: str) -> str:
    """'2026/07/14' → '2026-07-14'. Leave unknown formats untouched."""
    return inv_date.replace("/", "-") if inv_date else inv_date


def sync_month(year_month: str, owner: str = "共同", dry_run: bool = False) -> dict:
    """
    Merge stored invoices for `year_month` ('YYYY/MM') into data.json
    transactions. Returns {added, skipped, total_amount, transactions}.

    dry_run=True returns the would-be transactions without writing the file
    (also used when data.json is absent — e-invoice branch standalone).
    """
    from src.database import load_month_invoices

    rows = load_month_invoices(year_month)

    data = None
    existing_invs: set[str] = set()
    if DATA_JSON.exists():
        data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
        for t in data.get("transactions", []):
            if t.get("inv"):
                existing_invs.add(t["inv"])

    added, skipped, total = [], 0, 0
    for r in rows:
        inv_num = r.get("inv_num") or r.get("invNum") or ""
        if inv_num and inv_num in existing_invs:
            skipped += 1
            continue
        amount = int(r.get("amount") or 0)
        txn = {
            "date": _to_iso_date(r.get("inv_date") or r.get("invDate", "")),
            "type": "expense",
            "category": map_category(r.get("category", "其他")),
            "amount": amount,
            "owner": owner,
            "note": (r.get("seller_name") or r.get("sellerName") or "電子發票").strip(),
            "inv": inv_num,
        }
        added.append(txn)
        total += amount

    result = {"added": len(added), "skipped": skipped,
              "total_amount": total, "transactions": added}

    if not dry_run and data is not None and added:
        data.setdefault("transactions", []).extend(added)
        # bump meta.updated to today
        from datetime import datetime
        data.setdefault("meta", {})["updated"] = datetime.now().strftime("%Y-%m-%d")
        DATA_JSON.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return result


if __name__ == "__main__":
    import sys
    from datetime import datetime
    ym = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y/%m")
    dry = "--dry-run" in sys.argv
    res = sync_month(ym, dry_run=dry)
    print(f"{ym}: +{res['added']} 筆 / 跳過 {res['skipped']} / "
          f"合計 NT${res['total_amount']:,}" + (" [dry-run]" if dry else ""))
    for t in res["transactions"]:
        print(f"  {t['date']} {t['category']:<4} NT${t['amount']:>6,}  {t['note']}")
