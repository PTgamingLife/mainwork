"""生命之旅 — LINE 上線設定(圖文選單 + webhook),給 GitHub Actions 跑。

預設 dry run,只印出要送什麼;要真的送必須明確傳 --apply。
沿用 amp_line_setup.py 的做法,但選單名稱、四格、webhook 都換成生命之旅。

用法:
    python scripts/lj_line_setup.py --action both              # dry run
    python scripts/lj_line_setup.py --action both --apply      # 真的設定

環境變數:
    AMP_LINE_CHANNEL_ACCESS_TOKEN   同一個 OA 的 Messaging API 長效 token
    LJ_WEBHOOK_URL                  lj-line 的網址
"""

import argparse
import json
import os
import sys

import requests

API = "https://api.line.me/v2/bot"
DATA_API = "https://api-data.line.me/v2/bot"
LJ_MENU_NAME = "lj-main"
LJ_OLD_NAMES = {"lj-main", "amp-main"}   # 換上新選單時,舊的比賽選單一起清掉
LJ_IMAGE = "life-journey/richmenu.jpg"
LJ_LIFF = "https://liff.line.me/2011511140-5AixRgyd"
W, H = 2500, 1686

# 順序必須與 life-journey/richmenu.html 一致:左上、右上、左下、右下
LJ_CELLS = [
    ("增加我的生命之旅", "add.html"),
    ("我的生命之旅", "journey.html"),
    ("看別人的旅程", "find.html"),
    ("送一段回憶", "gift.html"),
]


def lj_build() -> dict:
    areas = [{
        "bounds": {"x": (i % 2) * (W // 2), "y": (i // 2) * (H // 2), "width": W // 2, "height": H // 2},
        "action": {"type": "uri", "label": label[:20], "uri": f"{LJ_LIFF}/{page}"},
    } for i, (label, page) in enumerate(LJ_CELLS)]
    return {"size": {"width": W, "height": H}, "selected": True, "name": LJ_MENU_NAME,
            "chatBarText": "生命之旅", "areas": areas}


def headers(token: str, ctype: str = "application/json") -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": ctype}


def do_richmenu(token: str, image: str, apply: bool) -> None:
    menu = lj_build()
    print("[圖文選單]")
    for a in menu["areas"]:
        b = a["bounds"]
        print(f'  [{b["x"]:>4},{b["y"]:>4}] {b["width"]}x{b["height"]}  {a["action"]["label"]} → {a["action"]["uri"]}')
    if not os.path.exists(image):
        raise SystemExit(f"找不到底圖:{image}")
    size = os.path.getsize(image)
    print(f"  底圖:{image}({size / 1024:.0f} KB)")
    if size > 1024 * 1024:
        raise SystemExit("底圖超過 LINE 上限 1MB")
    if not apply:
        print("  (dry run,沒有送出)")
        return

    # 先建新的、上傳、設預設,成功後才刪舊的 —— 中途失敗使用者也不會沒有選單
    res = requests.post(f"{API}/richmenu", headers=headers(token), json=menu, timeout=30)
    res.raise_for_status()
    menu_id = res.json()["richMenuId"]
    print("  建立成功:", menu_id)
    ctype = "image/png" if image.lower().endswith(".png") else "image/jpeg"
    with open(image, "rb") as fh:
        requests.post(f"{DATA_API}/richmenu/{menu_id}/content", headers=headers(token, ctype),
                      data=fh, timeout=60).raise_for_status()
    print("  底圖上傳完成")
    requests.post(f"{API}/user/all/richmenu/{menu_id}", headers=headers(token), timeout=30).raise_for_status()
    print("  已設為所有使用者的預設選單")

    res = requests.get(f"{API}/richmenu/list", headers=headers(token), timeout=30)
    res.raise_for_status()
    for m in res.json().get("richmenus", []):
        if m.get("name") in LJ_OLD_NAMES and m["richMenuId"] != menu_id:
            print(f"  舊選單 {m['richMenuId']} ({m.get('name')}) → 刪除")
            requests.delete(f"{API}/richmenu/{m['richMenuId']}", headers=headers(token), timeout=30).raise_for_status()


def do_webhook(token: str, url: str, apply: bool) -> None:
    print("[Webhook]")
    print(f"  設定為:{url}")
    if not apply:
        print("  (dry run,沒有送出)")
        return
    requests.put(f"{API}/channel/webhook/endpoint", headers=headers(token),
                 json={"endpoint": url}, timeout=30).raise_for_status()
    print("  已設定")
    test = requests.post(f"{API}/channel/webhook/test", headers=headers(token), json={"endpoint": url}, timeout=30)
    print("  Verify:", json.dumps(test.json() if test.content else {}, ensure_ascii=False))
    if not test.ok:
        print("  ⚠ Verify 回非 2xx,請到 LINE Developers 手動按一次 Verify 確認", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--action", choices=["richmenu", "webhook", "both"], default="both")
    ap.add_argument("--apply", action="store_true", help="真的送到 LINE(預設只 dry run)")
    ap.add_argument("--image", default=LJ_IMAGE)
    args = ap.parse_args()

    token = os.getenv("AMP_LINE_CHANNEL_ACCESS_TOKEN", "")
    webhook = os.getenv("LJ_WEBHOOK_URL", "")
    if args.apply and not token:
        raise SystemExit("缺 AMP_LINE_CHANNEL_ACCESS_TOKEN")
    if args.action in ("webhook", "both") and not webhook:
        raise SystemExit("缺 LJ_WEBHOOK_URL")

    print("模式:", "APPLY(會真的動到 LINE)" if args.apply else "DRY RUN")
    if args.action in ("richmenu", "both"):
        do_richmenu(token, args.image, args.apply)
    if args.action in ("webhook", "both"):
        do_webhook(token, webhook, args.apply)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
