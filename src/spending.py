"""
消費分類與月預算比對。

- categorize(): keyword rules over seller name + item descriptions
- summarize_month() / budget_status(): 當月各分類花費 vs 預算

Categories are Traditional-Chinese, budget config lives in env (JSON) or
Supabase bot_config key 'spending_budget'.
"""
import os
import json

# 分類關鍵字 — 命中順序由上到下,先命中先分類
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("餐飲", ["餐", "食", "咖啡", "cafe", "coffee", "茶", "飲", "麥當勞", "肯德基",
            "星巴克", "路易莎", "便當", "小吃", "火鍋", "燒肉", "早餐", "午餐", "晚餐",
            "pizza", "burger", "麵", "飯", "壽司", "拉麵"]),
    ("超商", ["7-11", "統一超商", "全家", "family", "萊爾富", "hi-life", "ok超商",
            "convenience"]),
    ("交通", ["加油", "中油", "台塑", "停車", "parking", "捷運", "台鐵", "高鐵",
            "客運", "計程車", "uber", "taxi", "ubike", "etag", "遠通"]),
    ("購物", ["百貨", "服飾", "book", "書店", "誠品", "屈臣氏", "康是美", "watsons",
            "cosmed", "寶雅", "shopee", "蝦皮", "momo", "pchome", "電商"]),
    ("生活", ["全聯", "家樂福", "carrefour", "大潤發", "愛買", "costco", "好市多",
            "量販", "超市", "supermarket", "五金", "生活"]),
    ("娛樂", ["電影", "cinema", "威秀", "ktv", "遊戲", "steam", "netflix", "spotify",
            "訂閱", "健身", "gym"]),
    ("醫療", ["藥局", "診所", "醫院", "clinic", "pharmacy", "牙醫", "醫療"]),
    ("居家", ["電費", "水費", "瓦斯", "電信", "中華電信", "台灣大", "遠傳", "房租",
            "管理費"]),
]

DEFAULT_CATEGORY = "其他"


def categorize(seller_name: str, item_descriptions: list[str] | None = None) -> str:
    """Return a category for one invoice using seller name + item text."""
    haystack = (seller_name or "").lower()
    if item_descriptions:
        haystack += " " + " ".join(d.lower() for d in item_descriptions)

    for category, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw.lower() in haystack:
                return category
    return DEFAULT_CATEGORY


# ── budget config ───────────────────────────────────────────────────────────

def load_budget() -> dict:
    """
    Monthly budget per category, e.g. {"總額": 20000, "餐飲": 6000}.
    Source priority: env SPENDING_BUDGET (JSON) → Supabase bot_config → {}.
    '總額' is the overall monthly ceiling.
    """
    raw = os.environ.get("SPENDING_BUDGET", "").strip()
    if raw:
        try:
            return {k: int(v) for k, v in json.loads(raw).items()}
        except Exception:
            pass
    try:
        from src.database import get_config
        stored = get_config("spending_budget")
        if stored:
            return {k: int(v) for k, v in json.loads(stored).items()}
    except Exception:
        pass
    return {}


# ── summaries ───────────────────────────────────────────────────────────────

def summarize(invoices: list[dict]) -> dict:
    """
    Aggregate a list of {category, amount} into per-category + total.
    Returns {"total": int, "by_category": {cat: amount}}.
    """
    by_cat: dict[str, int] = {}
    total = 0
    for inv in invoices:
        cat = inv.get("category") or DEFAULT_CATEGORY
        amt = int(inv.get("amount") or 0)
        by_cat[cat] = by_cat.get(cat, 0) + amt
        total += amt
    return {"total": total, "by_category": dict(sorted(
        by_cat.items(), key=lambda kv: kv[1], reverse=True))}


def budget_status(summary: dict, budget: dict) -> list[dict]:
    """
    Compare spending against budget. Returns overspend/near-limit alerts:
      [{scope, spent, limit, ratio, level}]  level: 'over' | 'near'
    """
    alerts = []

    def _check(scope: str, spent: int, limit: int):
        if limit <= 0:
            return
        ratio = spent / limit
        if ratio >= 1.0:
            alerts.append({"scope": scope, "spent": spent, "limit": limit,
                           "ratio": ratio, "level": "over"})
        elif ratio >= 0.8:
            alerts.append({"scope": scope, "spent": spent, "limit": limit,
                           "ratio": ratio, "level": "near"})

    if "總額" in budget:
        _check("總額", summary["total"], budget["總額"])
    for cat, spent in summary["by_category"].items():
        if cat in budget:
            _check(cat, spent, budget[cat])
    return alerts


def format_report(summary: dict, budget: dict, period_label: str) -> str:
    """Human-readable LINE message body."""
    lines = [f"📊 {period_label} 消費整理", ""]
    lines.append(f"總支出：NT${summary['total']:,}")
    if "總額" in budget and budget["總額"] > 0:
        remain = budget["總額"] - summary["total"]
        lines.append(f"月預算：NT${budget['總額']:,}（剩 NT${remain:,}）")
    lines.append("")
    lines.append("分類：")
    for cat, amt in summary["by_category"].items():
        tag = ""
        if cat in budget and budget[cat] > 0:
            tag = f"  / 預算 NT${budget[cat]:,}"
            if amt > budget[cat]:
                tag += " ⚠️超支"
        lines.append(f"  ・{cat}：NT${amt:,}{tag}")

    alerts = budget_status(summary, budget)
    if alerts:
        lines.append("")
        lines.append("⚠️ 提醒：")
        for a in alerts:
            pct = int(a["ratio"] * 100)
            if a["level"] == "over":
                lines.append(f"  ・{a['scope']} 已超支（{pct}%，NT${a['spent']:,}/{a['limit']:,}）")
            else:
                lines.append(f"  ・{a['scope']} 接近上限（{pct}%）")
    return "\n".join(lines)
