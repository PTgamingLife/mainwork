"""Generate AI course promotional poster via gpt-image-2 and save locally."""
import os
import base64
import json
from datetime import datetime
from openai import OpenAI


PROMPT = """
Create a professional and modern promotional poster for a Chinese-language AI course.
The poster should have a tech-forward design with dark navy/deep blue background,
vibrant accent colors (electric blue, cyan, and gold), clean layout.

Include ALL of the following text elements exactly as specified:

HEADLINE (largest, most prominent):
「AI 教學 0 到 1」
Subtitle: Cloud 101 AI 系列課程

COURSE INFO BOX (highlighted section):
📅 上課日期：7/19（六）
⏰ 上課時間：10:00 – 16:00
💰 費用：NT$ 18,800
📚 8堂課 × 6小時完整課程

SECTION HEADER: 🏆 學員成功案例

5 case study cards in a grid layout, each with a result number highlighted:
① 大學系統工具 → 工作時間減少 30%
② 減重活動社群工具 → 當日營業額成長 2～3 倍
③ 菜農客服系統 → 銷售額提升 18%
④ 觀光景點餐廳 → 四國語言網頁
⑤ 面舌診工具 → 衛福部疾病相似度 74%

BOTTOM CTA: 立即報名 · 名額有限

Design style: sleek tech poster, futuristic UI elements, subtle circuit/neural-network
pattern background, professional typography mixing Chinese and numbers,
gradient accents, white text on dark background.
Portrait orientation (vertical poster format).
"""


def generate_poster() -> str:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    print("[Poster] Calling gpt-image-2...")
    response = client.images.generate(
        model="gpt-image-2",
        prompt=PROMPT,
        size="1024x1536",
        quality="high",
        n=1,
        output_format="png",
    )

    item = response.data[0]
    if hasattr(item, "b64_json") and item.b64_json:
        image_bytes = base64.b64decode(item.b64_json)
    else:
        raise ValueError("No b64_json returned from gpt-image-2")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = f"course_poster_{timestamp}.png"

    with open(out_path, "wb") as f:
        f.write(image_bytes)

    print(f"[Poster] Saved → {out_path}  ({len(image_bytes):,} bytes)")

    # save metadata alongside the image
    meta = {
        "generated_at": timestamp,
        "model": "gpt-image-2",
        "size": "1024x1536",
        "quality": "high",
        "file": out_path,
        "course": {
            "title": "AI 教學 0 到 1",
            "date": "7/19",
            "time": "10:00–16:00",
            "price": "NT$18,800",
            "lessons": 8,
            "hours": 6,
        },
    }
    with open(f"course_poster_{timestamp}.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return out_path


if __name__ == "__main__":
    path = generate_poster()
    print(f"[Done] Poster ready: {path}")
