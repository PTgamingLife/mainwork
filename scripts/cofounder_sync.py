"""AI 創業合夥人 — Supabase ⇄ repo 每晚雙向同步。

    python scripts/cofounder_sync.py            # 雙向同步 + commit
    python scripts/cofounder_sync.py --test     # 只印出差異,不寫檔不 commit
    python scripts/cofounder_sync.py --no-commit

下行(Supabase → repo):把 state / daily / revenue 重建成 cofounder/data.json,
        儀表板與 Claude Code 都讀得到,而且進 git 有版本歷史。
上行(repo → Supabase):把 MODEL.md + SKILL.md 組成 system_prompt 寫進 cofounder_state。
        這就是「在 Claude Code 改模型 → OA 隔天換腦」的生效路徑。
"""
import argparse
import io
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from src import cofounder_store as store

TAIPEI = ZoneInfo("Asia/Taipei")
SKILL_DIR = ROOT / ".claude" / "skills" / "cofounder"
DATA_FILE = ROOT / "cofounder" / "data.json"

# data.json 裡由 Supabase 當家的欄位(其餘欄位以 repo 為準)
DB_OWNED = ("daily", "revenue")


def build_system_prompt() -> str:
    """把 MODEL.md 與 SKILL.md 組成 OA 用的系統提示。

    MODEL.md 是活的商業模型(漏斗、offer、激勵規則),SKILL.md 是行為規範。
    兩份都塞進去,OA 的人格才會跟 Claude Code 裡的合夥人一致。
    """
    model_md = (SKILL_DIR / "MODEL.md").read_text(encoding="utf-8")
    skill_md = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    return "\n".join([
        "你是使用者的 AI 創業合夥人。以下是你的行為規範與活的商業模型,",
        "「六、已驗證模式」權重最高,其次「二、Offer 假設池」,再來「一、變現模型」。",
        "",
        "=== 行為規範(SKILL.md) ===",
        skill_md,
        "",
        "=== 商業模型(MODEL.md) ===",
        model_md,
    ])


def normalize_daily(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        out.append({
            "date": str(r.get("action_date", "")),
            "conversations": r.get("conversations", 0),
            "leads": r.get("leads", 0),
            "pitches": r.get("pitches", 0),
            "deals": r.get("deals", 0),
            "revenue": float(r.get("revenue", 0) or 0),
            "ai_ratio": r.get("ai_ratio"),
            "mission": r.get("mission", ""),
            "result": r.get("result", "pending"),
            "blocker": r.get("blocker", ""),
            "note": r.get("note", ""),
        })
    return out


def normalize_revenue(rows: list[dict]) -> list[dict]:
    return [{
        "date": str(r.get("entry_date", "")),
        "source": r.get("source", ""),
        "offer_id": r.get("offer_id", ""),
        "amount": float(r.get("amount", 0) or 0),
        "client": r.get("client", ""),
        "note": r.get("note", ""),
    } for r in rows]


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="只印出,不寫檔不 commit")
    ap.add_argument("--no-commit", action="store_true", help="寫檔但不 commit")
    args = ap.parse_args()

    member = store.get_member()
    if not member:
        raise SystemExit("找不到啟用中的成員,跳過同步。")

    local = store.load_local()
    state = store.get_state(member["id"])
    daily = normalize_daily(store.get_daily(member["id"], limit=400))
    revenue = normalize_revenue(store.get_revenue(member["id"], limit=1000))

    # ---- 下行:Supabase → data.json ----
    merged = dict(local)
    for key, value in state.items():
        if key not in DB_OWNED and key != "system_prompt":
            merged[key] = value
    merged["daily"] = daily
    merged["revenue"] = revenue
    merged.setdefault("meta", {})["updated"] = datetime.now(TAIPEI).strftime("%Y-%m-%d")

    # ---- 上行:MODEL.md/SKILL.md → cofounder_state.system_prompt ----
    prompt = build_system_prompt()
    new_state = {k: v for k, v in merged.items() if k not in DB_OWNED}
    new_state["system_prompt"] = prompt

    if args.test:
        print(f"[test] 會寫入 data.json:daily {len(daily)} 筆、revenue {len(revenue)} 筆")
        print(f"[test] 會寫入 system_prompt:{len(prompt)} 字")
        changed = json.dumps(merged, ensure_ascii=False, sort_keys=True) != \
            json.dumps(local, ensure_ascii=False, sort_keys=True)
        print(f"[test] data.json {'有' if changed else '沒有'}變化")
        return

    store.save_local(merged)
    store.set_state(member["id"], new_state)
    print(f"[sync] data.json ← daily {len(daily)} 筆、revenue {len(revenue)} 筆")
    print(f"[sync] system_prompt → Supabase({len(prompt)} 字)")

    if args.no_commit:
        return

    status = git("status", "--porcelain", "cofounder/data.json")
    if not status.stdout.strip():
        print("[sync] data.json 無變化,不 commit")
        return

    git("add", "cofounder/data.json")
    today = datetime.now(TAIPEI).strftime("%Y-%m-%d")
    commit = git("commit", "-m", f"chore(cofounder): 同步 {today} 每日紀錄")
    if commit.returncode != 0:
        print(f"[sync] commit 失敗:{commit.stderr.strip()[:200]}")
        return
    push = git("push")
    if push.returncode != 0:
        print(f"[sync] push 失敗:{push.stderr.strip()[:200]}")
    else:
        print("[sync] 已 commit + push")


if __name__ == "__main__":
    main()
