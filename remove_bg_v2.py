"""
策略：先用原始檔（白底）疊上綠色底，讓 AI 清楚辨識機器人輪廓後再去背
"""
from rembg import remove
from PIL import Image
import io, os

SRC_DIR = r"C:\Users\nancy\OneDrive\桌面\AI_use\APP\facialmonitor"   # 原始白底圖
DST_DIR = r"C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code\facialmonitor\img"
FILES = ["mascot-main.png", "mascot-analyze.png",
         "tab-1.png", "tab-2.png", "tab-3.png", "tab-4.png", "tab-5.png", "tab-6.png"]

def process(src_path, dst_path):
    # 1. 開原始白底圖
    orig = Image.open(src_path).convert("RGBA")
    w, h = orig.size

    # 2. 貼到鮮綠底色上（讓 AI 看清白色輪廓）
    green_bg = Image.new("RGBA", (w, h), (0, 220, 80, 255))
    green_bg.paste(orig, mask=orig.split()[3])  # 若已有透明就用；否則直接貼
    # 如果原圖完全不透明（白底），改用貼上方法
    if orig.getextrema()[3] == (255, 255):  # 全不透明
        green_bg = Image.new("RGB", (w, h), (0, 220, 80))
        green_bg.paste(orig.convert("RGB"))
        green_bg = green_bg.convert("RGBA")

    # 3. 轉成 bytes，餵給 rembg
    buf = io.BytesIO()
    green_bg.save(buf, format="PNG")
    result_bytes = remove(buf.getvalue())

    # 4. 存檔
    out = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
    out.save(dst_path)
    print(f"OK: {os.path.basename(dst_path)}  {out.size}")

# mascot-analyze 使用 tab-2（原始）
ALIAS = {"mascot-analyze.png": "tab-2.png", "tab-6.png": "tab-6.png"}

for f in FILES:
    src_name = ALIAS.get(f, f)
    src = os.path.join(SRC_DIR, src_name)
    dst = os.path.join(DST_DIR, f)
    if os.path.exists(src):
        process(src, dst)
    else:
        # fallback: 用已處理的檔案
        src = os.path.join(DST_DIR, f)
        if os.path.exists(src):
            process(src, dst)
        else:
            print(f"SKIP: {f}")

print("Done!")
