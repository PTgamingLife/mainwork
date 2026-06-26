"""
IG Analysis — triggered when LINE user types "分析".
Runs every 10 minutes via Task Scheduler.
Fetches latest posts via instaloader, analyzes with GPT-4o, sends report to LINE.
"""
import os
import sys
import io
import logging
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(ROOT / "config" / ".env")

from openai import OpenAI
from src.database import check_analysis_requested, mark_analysis_completed, get_line_target
from src.line_sender import _push, _broadcast

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "ig_analysis.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


def fetch_posts(username: str, count: int = 6) -> list[dict]:
    import instaloader
    L = instaloader.Instaloader(quiet=True, download_pictures=False,
                                 download_videos=False, download_comments=False)
    profile = instaloader.Profile.from_username(L.context, username)
    posts = []
    for post in profile.get_posts():
        posts.append({
            "date": post.date_local.strftime("%Y-%m-%d"),
            "caption": (post.caption or "")[:300],
            "likes": post.likes,
            "comments": post.comments,
            "url": f"https://www.instagram.com/p/{post.shortcode}/",
        })
        if len(posts) >= count:
            break
    return posts


def build_analysis(posts: list[dict]) -> list[str]:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    avg_likes = sum(p["likes"] for p in posts) / len(posts)
    avg_comments = sum(p["comments"] for p in posts) / len(posts)
    best = max(posts, key=lambda x: x["likes"] + x["comments"] * 3)
    best_idx = posts.index(best) + 1

    posts_text = "\n\n".join([
        f"[{i+1}] {p['date']}｜讚 {p['likes']}｜留言 {p['comments']}\n文案：{p['caption'][:150]}"
        for i, p in enumerate(posts)
    ])

    prompt = f"""你是「老婆叫我別再跟 AI 聊天」IG 帳號顧問。
帳號定位：AI 工具實戰 × 一人公司，受眾是想導入 AI 的上班族。

最新 {len(posts)} 篇數據：
{posts_text}

均讚：{avg_likes:.0f}｜均留言：{avg_comments:.1f}｜最佳：第 {best_idx} 篇

請分三段分析，每段不超過 80 字，全文不超過 350 字：

🌟【表現亮點】
（哪篇最好？為什麼？Hook / 文案哪個寫法有效？）

⚠️【需要改進】
（Hook 力道？CTA 是否清楚？主題是否夠痛？）

💡【下篇建議】
（具體主題 + Hook 建議 + CTA 建議，可直接用）

繁體中文，直接說，不廢話。"""

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.7,
    )
    analysis = resp.choices[0].message.content.strip()

    header = (
        f"📊 IG 分析｜{datetime.now().strftime('%m/%d %H:%M')}\n"
        f"━━━━━━━━━━━━━━\n"
        f"分析 {len(posts)} 篇｜均讚 {avg_likes:.0f}｜均留言 {avg_comments:.1f}\n"
        f"最佳：第 {best_idx} 篇（{best['date']}，讚 {best['likes']}）\n"
        f"━━━━━━━━━━━━━━"
    )
    return [header, analysis]


def run():
    if not check_analysis_requested():
        return

    username = os.environ.get("IG_USERNAME", "").strip()
    if not username:
        log.error("IG_USERNAME 未設定，請在 config/.env 加入 IG_USERNAME=你的IG帳號")
        target = get_line_target()
        err_msg = [{"type": "text", "text": "❌ 未設定 IG_USERNAME，請在 .env 加入 IG_USERNAME=你的IG帳號名稱"}]
        if target:
            _push(target, err_msg)
        return

    log.info(f"開始分析 @{username}...")

    try:
        posts = fetch_posts(username)
        if not posts:
            log.error("無法取得貼文")
            return

        log.info(f"取得 {len(posts)} 篇，送 GPT-4o 分析...")
        msgs_text = build_analysis(posts)

        target = get_line_target()
        messages = [{"type": "text", "text": t} for t in msgs_text]
        if target:
            _push(target, messages)
        else:
            _broadcast(messages)

        log.info("分析報告已送出 ✅")
        mark_analysis_completed()

    except Exception as e:
        log.error(f"分析失敗: {e}")
        target = get_line_target()
        if target:
            _push(target, [{"type": "text", "text": f"❌ IG 分析失敗：{str(e)[:100]}"}])


if __name__ == "__main__":
    run()
