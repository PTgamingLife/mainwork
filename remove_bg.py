from PIL import Image
import os

IMG_DIR = r"C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code\facialmonitor\img"
FILES = ["mascot-main.png", "mascot-analyze.png", "tab-1.png", "tab-2.png",
         "tab-3.png", "tab-4.png", "tab-5.png"]
THRESHOLD = 25  # 白色容忍度（越小越嚴格）

def remove_bg(path):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    # 從四個角取背景色（最白的角落）
    corners = [pixels[0,0], pixels[w-1,0], pixels[0,h-1], pixels[w-1,h-1]]
    bg = max(corners, key=lambda c: c[0] + c[1] + c[2])
    br, bg_g, bb = bg[0], bg[1], bg[2]

    # 洪水填充：從四角往內找相連的白色像素，全部改透明
    stack = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]
    visited = set()

    while stack:
        x, y = stack.pop()
        if (x, y) in visited:
            continue
        if not (0 <= x < w and 0 <= y < h):
            continue
        r, g, b, a = pixels[x, y]
        if (abs(r - br) <= THRESHOLD and
            abs(g - bg_g) <= THRESHOLD and
            abs(b - bb) <= THRESHOLD):
            pixels[x, y] = (r, g, b, 0)
            visited.add((x, y))
            stack += [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]

    img.save(path)
    print(f"OK: {os.path.basename(path)}  ({w}x{h})")

for f in FILES:
    p = os.path.join(IMG_DIR, f)
    if os.path.exists(p):
        remove_bg(p)
    else:
        print(f"SKIP: {f} not found")

print("Done!")
