from rembg import remove
from PIL import Image
import io, os

IMG_DIR = r"C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code\facialmonitor\img"
FILES = ["mascot-main.png", "mascot-analyze.png",
         "tab-1.png", "tab-2.png", "tab-3.png", "tab-4.png", "tab-5.png"]

for f in FILES:
    path = os.path.join(IMG_DIR, f)
    if not os.path.exists(path):
        print(f"SKIP: {f}")
        continue
    with open(path, "rb") as fp:
        data = fp.read()
    result = remove(data)
    img = Image.open(io.BytesIO(result)).convert("RGBA")
    img.save(path)
    print(f"OK: {f}  {img.size}")

print("Done!")
