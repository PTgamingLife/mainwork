# 十神試煉場 — 呼叫 Supabase edge function si-gen-art 產生遊戲美術
# 用法:python3 scripts/si-art/si_gen.py scripts/si-art/si_p1.json shishen-quest/idle/img
# 需要環境變數 SI_GEN_KEY(= sg_push_auth.token);金鑰不寫進任何檔案
import base64, json, os, sys, urllib.error, urllib.request

SI_URL = "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/si-gen-art"
SI_STYLES = {
    "sprite": "2D game sprite, Chinese ink-wash painting style, cute chibi (Q-version) proportions, soft sumi brush outlines, "
              "muted palette of ink black #1E1E1E, mist white #F4F4F2 and plum yellow #E3BE2B accents, no red, no text, "
              "no ground shadow, single subject centered, full body, transparent background.",
    "bg": "Chinese ink-wash painting, muted gray ink washes on mist white paper (#F4F4F2 to #E6E7E4), no red, no text.",
}


def si_main(list_path, out_dir):
    si_key = os.environ.get("SI_GEN_KEY", "").strip()
    if not si_key:
        sys.exit("缺少環境變數 SI_GEN_KEY")
    os.makedirs(out_dir, exist_ok=True)
    for it in json.load(open(list_path, encoding="utf-8")):
        path = os.path.join(out_dir, it["file"])
        if os.path.exists(path):
            print("skip", it["file"])
            continue
        prompt = f'{SI_STYLES[it.get("style", "sprite")]} {it["prompt"]}'
        body = json.dumps({"prompt": prompt, "size": it.get("size", "1024x1024"),
                           "background": it.get("background", "transparent")}).encode()
        req = urllib.request.Request(SI_URL, data=body, method="POST",
                                     headers={"Content-Type": "application/json", "x-sg-key": si_key})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.load(r)
        except urllib.error.HTTPError as e:
            print("FAIL", it["file"], e.code, e.read()[:300])
            continue
        with open(path, "wb") as f:
            f.write(base64.b64decode(data["b64"]))
        print("ok", it["file"], os.path.getsize(path), flush=True)


if __name__ == "__main__":
    si_main(sys.argv[1], sys.argv[2])
