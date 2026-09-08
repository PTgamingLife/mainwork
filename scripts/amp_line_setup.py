"""安麗蛋白素比賽 — LINE 上線設定(圖文選單 + webhook),給 GitHub Actions 跑。

不用在自己電腦下指令:token 放 GitHub Secrets,到 Actions 頁面按 Run workflow 即可。
預設 dry run,只印出要送什麼;要真的送必須明確傳 --apply。

用法:
    python scripts/amp_line_setup.py --action both              # dry run
    python scripts/amp_line_setup.py --action both --apply      # 真的設定

環境變數:
    AMP_LINE_CHANNEL_ACCESS_TOKEN   Messaging API 長效 token
    AMP_LIFF_URL_COMPACT            半頁 LIFF(四格都用這個)
    AMP_WEBHOOK_URL                 amp-line 的網址

四格的座標與連結沿用 amp_richmenu.py 的 build(),不重寫一份。
"""

import argparse
import json
import os
import sys

import requests

from amp_richmenu import build

API = "https://api.line.me/v2/bot"
DATA_API = "https://api-data.line.me/v2/bot"
MENU_NAME = "amp-main"
DEFAULT_IMAGE = "amway-protein/richmenu.png"


def headers(token: str, ctype: str = "application/json") -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": ctype}


def drop_old_menus(token: str, apply: bool) -> None:
    """刪掉舊的 amp-main,否則每跑一次就多留一個孤兒選單。

    dry run 不連 LINE(連 list 也不打),所以沒有 token 也能先看內容。
    """
    if not apply:
        print("  (dry run:略過清理舊選單)")
        return
    res = requests.get(f"{API}/richmenu/list", headers=headers(token), timeout=30)
    res.raise_for_status()
    olds = [m for m in res.json().get("richmenus", []) if m.get("name") == MENU_NAME]
    for m in olds:
        print(f"  舊選單 {m['richMenuId']} ({m.get('name')}) → 刪除")
        if apply:
            d = requests.delete(f"{API}/richmenu/{m['richMenuId']}", headers=headers(token), timeout=30)
            d.raise_for_status()
    if not olds:
        print("  沒有需要清掉的舊選單")


def do_richmenu(token: str, compact: str, image: str, apply: bool) -> None:
    menu = build(compact, compact)
    print("[圖文選單]")
    for area in menu["areas"]:
        b = area["bounds"]
        print(f'  [{b["x"]:>4},{b["y"]:>4}] {b["width"]}x{b["height"]}  '
              f'{area["action"]["label"]} → {area["action"]["uri"]}')
    if not os.path.exists(image):
        raise SystemExit(f"找不到底圖:{image}")
    print(f"  底圖:{image}({os.path.getsize(image) / 1024:.0f} KB)")

    drop_old_menus(token, apply)
    if not apply:
        print("  (dry run,沒有送出)")
        return

    res = requests.post(f"{API}/richmenu", headers=headers(token),
                        json=menu, timeout=30)
    res.raise_for_status()
    menu_id = res.json()["richMenuId"]
    print("  建立成功:", menu_id)

    ctype = "image/png" if image.lower().endswith(".png") else "image/jpeg"
    with open(image, "rb") as fh:
        up = requests.post(f"{DATA_API}/richmenu/{menu_id}/content",
                           headers=headers(token, ctype), data=fh, timeout=60)
    up.raise_for_status()
    print("  底圖上傳完成")

    setdef = requests.post(f"{API}/user/all/richmenu/{menu_id}",
                           headers=headers(token), timeout=30)
    setdef.raise_for_status()
    print("  已設為所有使用者的預設選單")


def do_webhook(token: str, url: str, apply: bool) -> None:
    print("[Webhook]")
    print(f"  設定為:{url}")
    if not apply:
        print("  (dry run,沒有送出)")
        return

    res = requests.put(f"{API}/channel/webhook/endpoint", headers=headers(token),
                       json={"endpoint": url}, timeout=30)
    res.raise_for_status()
    print("  已設定")

    # 等同 LINE 網頁上的 Verify 按鈕
    test = requests.post(f"{API}/channel/webhook/test", headers=headers(token),
                         json={"endpoint": url}, timeout=30)
    body = test.json() if test.content else {}
    print("  Verify:", json.dumps(body, ensure_ascii=False))
    # amp-line 收到沒有合法簽章的測試請求會回 401,這是預期行為(它本來就該擋)。
    # 只要 LINE 打得到、有回應就算通;真正的驗收是手機上實際對話。
    if not test.ok:
        print("  ⚠ Verify 回非 2xx,請到 LINE Developers 手動按一次 Verify 確認", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--action", choices=["richmenu", "webhook", "both"], default="both")
    ap.add_argument("--apply", action="store_true", help="真的送到 LINE(預設只 dry run)")
    ap.add_argument("--image", default=DEFAULT_IMAGE)
    args = ap.parse_args()

    token = os.getenv("AMP_LINE_CHANNEL_ACCESS_TOKEN", "")
    compact = os.getenv("AMP_LIFF_URL_COMPACT", "")
    webhook = os.getenv("AMP_WEBHOOK_URL", "")

    if not token:
        raise SystemExit("缺 AMP_LINE_CHANNEL_ACCESS_TOKEN")
    if args.action in ("richmenu", "both") and not compact:
        raise SystemExit("缺 AMP_LIFF_URL_COMPACT")
    if args.action in ("webhook", "both") and not webhook:
        raise SystemExit("缺 AMP_WEBHOOK_URL")

    print("模式:", "APPLY(會真的動到 LINE)" if args.apply else "DRY RUN")
    if args.action in ("richmenu", "both"):
        do_richmenu(token, compact, args.image, args.apply)
    if args.action in ("webhook", "both"):
        do_webhook(token, webhook, args.apply)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
