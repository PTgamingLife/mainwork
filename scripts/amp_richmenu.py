"""安麗蛋白素比賽 — LINE 圖文選單(4 格)建立工具。

預設是 dry run:只印出要送出的 JSON 與每一格的座標、連結,不碰 LINE。
確認無誤後加 --apply 才會真的建立、上傳底圖並設為預設選單。

用法(PowerShell):
    python scripts/amp_richmenu.py                      # dry run,看內容
    python scripts/amp_richmenu.py --apply                # 用 repo 附的底圖真的上傳

需要的環境變數(放 .env,不要進 repo):
    AMP_LINE_CHANNEL_ACCESS_TOKEN   Messaging API 長效 token
    AMP_LIFF_URL_COMPACT            半頁 LIFF,例 https://liff.line.me/xxxx-yyyy
    AMP_LIFF_URL_FULL               全頁 LIFF

底圖規格:2500 x 1686 PNG/JPEG,2x2 四格。
repo 已附 amway-protein/richmenu.png;要改字改色就改 amway-protein/richmenu.html
(用瀏覽器以 2500x1686 視窗截圖覆蓋 PNG)。
"""

import argparse
import json
import os
import sys

import requests
from dotenv import load_dotenv

API = "https://api.line.me/v2/bot"
DATA_API = "https://api-data.line.me/v2/bot"
W, H = 2500, 1686

# 格子順序照 zip 的 richmenu-config.json,標籤改成這場比賽的用語。
# 四格一律開半頁 LIFF(該 LIFF 的 size 在 LINE Developers 設為 Tall)。
CELLS = [
    ("任務加分", "score"),
    ("排行榜", "board"),
    ("每日問答", "quiz"),
    ("戳夥伴", "board"),
]


def build(compact: str, full: str) -> dict:
    areas = []
    for i, (label, view) in enumerate(CELLS):
        base = compact
        sep = "&" if "?" in base else "?"
        areas.append({
            "bounds": {
                "x": (i % 2) * (W // 2),
                "y": (i // 2) * (H // 2),
                "width": W // 2,
                "height": H // 2,
            },
            "action": {"type": "uri", "label": label, "uri": f"{base}{sep}view={view}"},
        })
    return {
        "size": {"width": W, "height": H},
        "selected": True,
        "name": "amp-main",
        "chatBarText": "打開挑戰",
        "areas": areas,
    }


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="真的送到 LINE(預設只 dry run)")
    ap.add_argument("--image", default="amway-protein/richmenu.png",
                    help="底圖路徑,2500x1686(預設用 repo 附的那張)")
    args = ap.parse_args()

    token = os.getenv("AMP_LINE_CHANNEL_ACCESS_TOKEN", "")
    compact = os.getenv("AMP_LIFF_URL_COMPACT", "")
    full = os.getenv("AMP_LIFF_URL_FULL", "")
    if not compact or not full:
        print("缺 AMP_LIFF_URL_COMPACT / AMP_LIFF_URL_FULL", file=sys.stderr)
        return 1

    menu = build(compact, full)
    print(json.dumps(menu, ensure_ascii=False, indent=2))
    for area in menu["areas"]:
        b = area["bounds"]
        print(f'  [{b["x"]:>4},{b["y"]:>4}] {b["width"]}x{b["height"]}  '
              f'{area["action"]["label"]} → {area["action"]["uri"]}')

    if not args.apply:
        print("\n(dry run。確認以上四格無誤後,再加 --apply 執行(底圖預設 amway-protein/richmenu.png)。)")
        return 0

    if not token:
        print("缺 AMP_LINE_CHANNEL_ACCESS_TOKEN", file=sys.stderr)
        return 1
    if not args.image or not os.path.exists(args.image):
        print("--apply 需要 --image 指向存在的底圖", file=sys.stderr)
        return 1

    headers = {"Authorization": f"Bearer {token}"}

    res = requests.post(f"{API}/richmenu", headers={**headers, "Content-Type": "application/json"},
                        json=menu, timeout=30)
    res.raise_for_status()
    menu_id = res.json()["richMenuId"]
    print("建立成功:", menu_id)

    ctype = "image/png" if args.image.lower().endswith(".png") else "image/jpeg"
    with open(args.image, "rb") as fh:
        up = requests.post(f"{DATA_API}/richmenu/{menu_id}/content",
                           headers={**headers, "Content-Type": ctype}, data=fh, timeout=60)
    up.raise_for_status()
    print("底圖上傳完成")

    setdef = requests.post(f"{API}/user/all/richmenu/{menu_id}", headers=headers, timeout=30)
    setdef.raise_for_status()
    print("已設為所有使用者的預設選單")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
