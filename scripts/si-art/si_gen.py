# 十神試煉場 — 產生遊戲美術
# 用法:python3 scripts/si-art/si_gen.py scripts/si-art/si_p1.json shishen-quest/idle/img
# 預設直接呼叫 OpenAI:有 OPENAI_API_KEY 就帶上;沒有則靠雲端環境的網路密鑰(Bearer)自動帶入
# 設了 SI_GEN_KEY(= sg_push_auth.token)則改走 Supabase si-gen-art
# 金鑰只從環境變數讀,不寫進任何檔案
import base64, json, os, sys, urllib.error, urllib.request

SI_URL = "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/si-gen-art"
SI_OPENAI_URL = "https://api.openai.com/v1/images/generations"
SI_MODEL = "gpt-image-2"  # 與 sg-gen-angel 相同;不支援透明背景
SI_MODEL_TRANSPARENT = "gpt-image-1.5"  # 透明背景角色圖用
SI_STYLES = {
    "sprite": "2D game sprite, Chinese ink-wash painting style, cute chibi (Q-version) proportions, soft sumi brush outlines, "
              "muted palette of ink black #1E1E1E, mist white #F4F4F2 and plum yellow #E3BE2B accents, no red, no text, "
              "no ground shadow, single subject centered, full body, transparent background.",
    "bg": "Chinese ink-wash painting, muted gray ink washes on mist white paper (#F4F4F2 to #E6E7E4), no red, no text.",
}


def si_request(prompt, size, background):
    si_key = os.environ.get("SI_GEN_KEY", "").strip()
    if si_key:
        body = {"prompt": prompt, "size": size, "background": background}
        req = urllib.request.Request(SI_URL, data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "x-sg-key": si_key})
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.load(r)["b64"]
    headers = {"Content-Type": "application/json"}
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if openai_key:
        headers["Authorization"] = f"Bearer {openai_key}"
    model = SI_MODEL_TRANSPARENT if background == "transparent" else SI_MODEL
    body = {"model": model, "prompt": prompt, "n": 1, "size": size, "quality": "medium",
            "background": background, "output_format": "webp", "output_compression": 90}
    req = urllib.request.Request(SI_OPENAI_URL, data=json.dumps(body).encode(), method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)["data"][0]["b64_json"]


def si_main(list_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for it in json.load(open(list_path, encoding="utf-8")):
        path = os.path.join(out_dir, it["file"])
        if os.path.exists(path):
            print("skip", it["file"])
            continue
        prompt = f'{SI_STYLES[it.get("style", "sprite")]} {it["prompt"]}'
        try:
            b64 = si_request(prompt, it.get("size", "1024x1024"), it.get("background", "transparent"))
        except urllib.error.HTTPError as e:
            print("FAIL", it["file"], e.code, e.read()[:300])
            continue
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64))
        print("ok", it["file"], os.path.getsize(path), flush=True)


if __name__ == "__main__":
    si_main(sys.argv[1], sys.argv[2])
