"""wob_publish：把一個資料夾的照片/影片壓縮後上傳成「公車上的成長」預設內容。

在自己電腦執行（Windows PowerShell）：
    winget install ffmpeg            # 只需一次
    pip install pillow pillow-heif   # 只需一次（pillow-heif 讓 iPhone 的 HEIC 能讀）
    python scripts/wob_publish.py "D:\\寶寶照片\\公車"

    # 只壓縮、不上傳（先檢查順序和大小）
    python scripts/wob_publish.py "D:\\寶寶照片\\公車" --dry-run

需要 config/.env（已在 .gitignore，不會被 commit），二選一：
    WOB_SUPABASE_URL=https://hhcubvixldieuwdeqnwc.supabase.co
    WOB_SUPABASE_SERVICE_KEY=<heart-cards 的 service_role key>
  或
    WOB_ADMIN_TOKEN=<管理金鑰；資料庫 wob_admin_tokens 表只存它的 sha256>

規則：
  - 影片裁成前 2 秒（WOB_SLOT_SEC）、最長邊 1280、去掉聲音；較短的保留原長
  - 照片轉 JPG、最長邊 1600、依 EXIF 轉正
  - 順序：檔名開頭是數字（例如 001_xxx.jpg）照數字排；其餘照拍攝日期
  - 每次執行會「整組取代」雲端上的預設內容
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

WOB_BUCKET = "wob_media"
WOB_SLOT_SEC = 2
WOB_IMG_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
WOB_VID_EXT = {".mp4", ".mov", ".m4v", ".3gp", ".webm"}
WOB_ROOT = Path(__file__).resolve().parent.parent


# ---------- 設定 ----------
WOB_FN_URL = "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/wob-media"


def wob_env():
    """有 WOB_SUPABASE_SERVICE_KEY 就直連 Storage；否則用 WOB_ADMIN_TOKEN 走 Edge Function。"""
    env_file = WOB_ROOT / "config" / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
            if m and m.group(1) not in os.environ:
                os.environ[m.group(1)] = m.group(2).strip().strip('"')
    url = os.environ.get("WOB_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("WOB_SUPABASE_SERVICE_KEY", "")
    admin = os.environ.get("WOB_ADMIN_TOKEN", "")
    if url and key:
        return WobDirect(url, key)
    if admin:
        return WobViaFunction(admin)
    sys.exit("缺少金鑰：config/.env 需要 WOB_SUPABASE_URL + WOB_SUPABASE_SERVICE_KEY，或 WOB_ADMIN_TOKEN")


# ---------- 排序 ----------
def wob_taken_at(path):
    """拍攝時間：照片讀 EXIF，影片讀 creation_time，都沒有就用檔案修改時間。"""
    ext = path.suffix.lower()
    try:
        if ext in WOB_IMG_EXT:
            from PIL import Image
            with Image.open(path) as im:
                raw = im.getexif().get_ifd(0x8769).get(36867) or im.getexif().get(306)
            if raw:
                return datetime.strptime(str(raw)[:19], "%Y:%m:%d %H:%M:%S").timestamp()
        else:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format_tags=creation_time",
                 "-of", "default=nw=1:nk=1", str(path)],
                capture_output=True, text=True, check=False).stdout.strip()
            if out:
                return datetime.fromisoformat(out.replace("Z", "+00:00")).timestamp()
    except Exception:
        pass
    return path.stat().st_mtime


def wob_sort_key(path):
    m = re.match(r"^(\d+)", path.name)
    return (0, int(m.group(1)), 0) if m else (1, 0, wob_taken_at(path))


# ---------- 壓縮 ----------
def wob_make_image(src, dst):
    from PIL import Image, ImageOps
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        if src.suffix.lower() in {".heic", ".heif"}:
            raise RuntimeError("HEIC 需要先 pip install pillow-heif")
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((1600, 1600))
        im.save(dst, "JPEG", quality=82, optimize=True, progressive=True)


def wob_make_video(src, dst):
    cmd = [
        "ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-t", str(WOB_SLOT_SEC),
        "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst),
    ]
    subprocess.run(cmd, check=True)


# ---------- Supabase Storage ----------
def wob_req(url, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


class WobDirect:
    """用 service role key 直接打 Storage API。"""

    def __init__(self, base, key):
        self.base, self.auth = base, {"Authorization": f"Bearer {key}", "apikey": key}

    def put(self, path, data, ctype):
        cache = "0" if path == "manifest.json" else "31536000"
        return wob_req(f"{self.base}/storage/v1/object/{WOB_BUCKET}/{path}", "POST", data,
                       {**self.auth, "Content-Type": ctype, "x-upsert": "true", "cache-control": cache})

    def list(self):
        st, body = wob_req(f"{self.base}/storage/v1/object/list/{WOB_BUCKET}", "POST",
                           json.dumps({"prefix": "items", "limit": 1000}).encode(),
                           {**self.auth, "Content-Type": "application/json"})
        if st >= 300:
            raise RuntimeError(f"讀取清單失敗: {st} {body[:200]!r}（bucket {WOB_BUCKET} 存在嗎？）")
        return [f"items/{o['name']}" for o in json.loads(body) if o.get("id")]

    def delete(self, paths):
        wob_req(f"{self.base}/storage/v1/object/{WOB_BUCKET}", "DELETE",
                json.dumps({"prefixes": paths}).encode(), {**self.auth, "Content-Type": "application/json"})


class WobViaFunction:
    """用管理金鑰透過 wob-media Edge Function 上傳（不需要 service role key）。"""

    def __init__(self, token):
        self.auth = {"x-wob-admin": token}

    def put(self, path, data, ctype):
        q = urllib.parse.urlencode({"op": "put", "path": path})
        return wob_req(f"{WOB_FN_URL}?{q}", "POST", data, {**self.auth, "Content-Type": ctype})

    def list(self):
        st, body = wob_req(f"{WOB_FN_URL}?op=list", "POST", b"", self.auth)
        if st >= 300:
            raise RuntimeError(f"讀取清單失敗: {st} {body[:200]!r}")
        return json.loads(body)["paths"]

    def delete(self, paths):
        wob_req(f"{WOB_FN_URL}?op=delete", "POST", json.dumps({"paths": paths}).encode(),
                {**self.auth, "Content-Type": "application/json"})


def wob_upload(sb, path, file_path, ctype):
    st, body = sb.put(path, Path(file_path).read_bytes(), ctype)
    if st >= 300:
        raise RuntimeError(f"上傳失敗 {path}: {st} {body[:200]!r}")


# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser(description="上傳公車上的成長預設內容")
    ap.add_argument("folder", help="放照片/影片的資料夾")
    ap.add_argument("--dry-run", action="store_true", help="只壓縮，不上傳")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("找不到 ffmpeg，請先執行：winget install ffmpeg（裝完重開 PowerShell）")

    src_dir = Path(args.folder)
    files = [p for p in src_dir.iterdir()
             if p.is_file() and p.suffix.lower() in WOB_IMG_EXT | WOB_VID_EXT]
    if not files:
        sys.exit(f"{src_dir} 裡沒有照片或影片")
    files.sort(key=wob_sort_key)

    out_dir = src_dir / "_wob_out"
    shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.mkdir()

    items, total = [], 0
    for i, src in enumerate(files, 1):
        is_vid = src.suffix.lower() in WOB_VID_EXT
        tmp = out_dir / f"{i:03d}{'.mp4' if is_vid else '.jpg'}"
        try:
            (wob_make_video if is_vid else wob_make_image)(src, tmp)
        except Exception as e:
            print(f"  ⚠ 略過 {src.name}：{e}")
            continue
        v = hashlib.sha1(tmp.read_bytes()).hexdigest()[:10]
        final = tmp.with_name(f"{tmp.stem}_{v}{tmp.suffix}")
        tmp.rename(final)
        size = final.stat().st_size
        total += size
        items.append({"path": f"items/{final.name}", "kind": "video" if is_vid else "image",
                      "v": v, "file": final})
        print(f"{i:3d}. {'影片' if is_vid else '照片'} {src.name} → {final.name}（{size / 1024:.0f} KB）")

    print(f"\n共 {len(items)} 個，約 {total / 1024 / 1024:.1f} MB，"
          f"需要 {len(items) * WOB_SLOT_SEC} 秒（歌曲約 124 秒 ≈ {124 // WOB_SLOT_SEC + 1} 個）")
    print(f"壓縮後的檔案在：{out_dir}")
    if args.dry_run:
        print("（--dry-run：沒有上傳）")
        return

    sb = wob_env()
    old = set(sb.list())
    for n, it in enumerate(items, 1):
        print(f"上傳 {n}/{len(items)} {it['path']}", flush=True)
        if it["path"] not in old:
            wob_upload(sb, it["path"], it["file"],
                       "video/mp4" if it["kind"] == "video" else "image/jpeg")
    manifest = {
        "version": datetime.now().strftime("%Y%m%d%H%M%S"),
        "items": [{k: it[k] for k in ("path", "kind", "v")} for it in items],
    }
    mpath = out_dir / "manifest.json"
    mpath.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    wob_upload(sb, "manifest.json", mpath, "application/json")
    stale = sorted(old - {it["path"] for it in items})
    if stale:
        sb.delete(stale)
    print("\n✅ 完成！家人重新打開網頁、選「預設內容」就會看到新的內容。")


if __name__ == "__main__":
    main()
