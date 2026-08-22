"""AI 創業合夥人 — 早晚定時推播(GitHub Actions cron 呼叫)。

    python scripts/cofounder_push.py --morning        # 07:30 派今日必勝任務
    python scripts/cofounder_push.py --review         # 21:30 催覆盤 + 對帳
    python scripts/cofounder_push.py --morning --test # 只印出訊息,不推 LINE

需要的環境變數:
    ANTHROPIC_API_KEY
    COFOUNDER_LINE_CHANNEL_ACCESS_TOKEN
    COFOUNDER_SUPABASE_URL, COFOUNDER_SUPABASE_SERVICE_ROLE_KEY
"""
import argparse
import io
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from src import cofounder_store as store

TAIPEI = ZoneInfo("Asia/Taipei")

# 早會與覆盤都是「判斷」而不是閒聊 —— 要算落後量、選出唯一必勝任務、做失敗歸因,
# 所以兩班都用 Opus。OA 裡的日常問答才走 Haiku(見 supabase/functions/cofounder-line)。
# 想省錢的話把 MODEL_MORNING 改成 "claude-haiku-4-5" 就好。
MODEL_MORNING = "claude-opus-5"
MODEL_REVIEW = "claude-opus-5"

MORNING_TASK = """現在是早上,做【晨會模式】。

依合夥人模型產出今日任務卡,格式固定、要短(手機上讀得完):

☀️ 第 N 天 · streak X 天 · 本月 A / B

【今天唯一必須贏的事】
(一件事,具體到可驗收)

【賭注】
(一句挑釁但正向的話)

【5 小時怎麼切】
90 min 銷售 → …
120 min 交付/產品化 → …
60 min 內容 → …
30 min AI 化 → …

【今天的關卡】
(本週 Boss 進度,今天要 +幾)

規則:只給一個必勝任務,不要給選項。銷售排第一。
連續 2 天未達標就降低難度而非加碼;連續 3 天超標就加碼 20%。
語氣鼓舞、短促。不要 markdown 標題或表格。"""

REVIEW_TASK = """現在是晚上,做【覆盤模式】的開場。

如果今天還沒有回報數字,先用一句話把落後量講清楚,然後要他回報 6 個數字
(格式:回報 對話 名單 提案 成交 入帳 AI率,例如「回報 3 2 1 0 0 60」)。

如果今天已經有數字,直接做對帳:
【對帳】今日實績 vs 日配額,逐項 ✅/❌ 與差額
【三燈號】行動量 / 轉換率 / AI 槓桿,各一句
【落後帳】距當月目標還差多少、剩幾天、每天要補多少(算出來,不要只喊話)
【失敗歸因】未達標就要他選:沒時間 / 沒名單 / 怕被拒 / 卡技術 / 方向錯
【明天】一句話預告

語氣:不給藉口、不安慰、不辱罵。只講數字、差額、下一步。不要 markdown 標題或表格。"""


def build_system(state: dict, daily: list, revenue: list, today: str) -> str:
    prompt = state.get("system_prompt") or (
        "你是使用者的 AI 創業合夥人,目標是 3 個月內把月收推到 200,000 TWD。"
        "用繁體中文、台灣用語。"
    )
    public = {k: v for k, v in state.items() if k != "system_prompt"}
    return "\n".join([
        prompt,
        "",
        "【通道限制】這則訊息會推到 LINE,顯示在手機上:不要 markdown 標題、表格、程式碼區塊;",
        "用短行與換行;整則控制在 400 字內。",
        "",
        f"【今天】{today}",
        f"【目前狀態】{json.dumps(public, ensure_ascii=False)}",
        f"【近 14 天每日數字】{json.dumps(daily[-14:], ensure_ascii=False, default=str)}",
        f"【入帳明細】{json.dumps(revenue[-20:], ensure_ascii=False, default=str)}",
    ])


def generate(system: str, task: str, model: str) -> str:
    import anthropic

    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=model,
        max_tokens=2000,
        system=system,
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        messages=[{"role": "user", "content": task}],
    )
    return "\n".join(b.text for b in resp.content if b.type == "text").strip()


def push(text: str, target: str) -> None:
    """推播對象取自資料庫的成員(綁定時就存好了),不需要另外設環境變數。"""
    token = os.environ.get("COFOUNDER_LINE_CHANNEL_ACCESS_TOKEN")
    if not token:
        raise SystemExit("缺 COFOUNDER_LINE_CHANNEL_ACCESS_TOKEN")
    if not target:
        raise SystemExit("成員沒有 line_user_id,先在 LINE 打「綁定 <碼>」完成綁定")
    # src.line_sender 每次呼叫才讀 LINE_CHANNEL_ACCESS_TOKEN,
    # 這裡指到合夥人 OA 的 token,不會動到健康管理 bot 的設定。
    os.environ["LINE_CHANNEL_ACCESS_TOKEN"] = token
    from src.line_sender import _push
    _push(target, [{"type": "text", "text": text[:5000]}])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--morning", action="store_true", help="早上派任務")
    ap.add_argument("--review", action="store_true", help="晚上催覆盤")
    ap.add_argument("--test", action="store_true", help="只印出,不推 LINE")
    args = ap.parse_args()

    if args.morning == args.review:
        raise SystemExit("請指定 --morning 或 --review(擇一)")

    today = datetime.now(TAIPEI).strftime("%Y-%m-%d")
    member = store.get_member()
    if not member:
        raise SystemExit("找不到啟用中的成員。先在 LINE 打「綁定 <碼>」完成綁定。")

    state = store.get_state(member["id"])
    daily = store.get_daily(member["id"])
    revenue = store.get_revenue(member["id"])

    system = build_system(state, daily, revenue, today)
    model = MODEL_MORNING if args.morning else MODEL_REVIEW
    task = MORNING_TASK if args.morning else REVIEW_TASK
    text = generate(system, task, model)

    if args.test:
        print(f"--- {'晨會' if args.morning else '覆盤'} / {model} / {today} (未推播) ---")
        print(text)
        return

    push(text, member.get("line_user_id", ""))
    store.save_message(member["id"], "assistant", text, model=model,
                       intent="morning" if args.morning else "review")
    print(f"[push] sent ({len(text)} chars, {model})")


if __name__ == "__main__":
    main()
