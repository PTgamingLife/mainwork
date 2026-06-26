"""Generate 6-image IG carousel via gpt-image-2 + Supabase Storage upload."""
import os
import base64
import requests
from datetime import datetime
from openai import OpenAI


def _openai() -> OpenAI:
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def _bucket() -> str:
    return os.environ.get("SUPABASE_STORAGE_BUCKET", "health-bot-images")


def _storage_headers() -> dict:
    return {"Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}"}


def ensure_bucket():
    bucket = _bucket()
    resp = requests.post(
        f"{os.environ['SUPABASE_URL']}/storage/v1/bucket",
        headers={**_storage_headers(), "Content-Type": "application/json"},
        json={"id": bucket, "name": bucket, "public": True},
        timeout=10
    )
    if resp.status_code not in (200, 201, 409):
        print(f"[Storage] Bucket note: {resp.status_code}")


def _generate_one(prompt: str) -> bytes:
    """Call gpt-image-2 and return raw image bytes."""
    response = _openai().images.generate(
        model="gpt-image-2",
        prompt=prompt,
        size="1024x1024",
        quality="medium",
        n=1
    )
    item = response.data[0]
    if hasattr(item, "b64_json") and item.b64_json:
        return base64.b64decode(item.b64_json)
    if hasattr(item, "url") and item.url:
        r = requests.get(item.url, timeout=30)
        r.raise_for_status()
        return r.content
    raise ValueError("No image data from OpenAI")


def _upload(image_bytes: bytes, file_path: str) -> str:
    """Upload to Supabase Storage, return public URL."""
    resp = requests.put(
        f"{os.environ['SUPABASE_URL']}/storage/v1/object/{_bucket()}/{file_path}",
        headers={**_storage_headers(), "Content-Type": "image/png", "x-upsert": "true"},
        data=image_bytes,
        timeout=30
    )
    resp.raise_for_status()
    return f"{os.environ['SUPABASE_URL']}/storage/v1/object/public/{_bucket()}/{file_path}"


def generate_carousel(prompts: list[str], day_number: int) -> list[str]:
    """Generate 6 carousel images and upload. Returns list of 6 public URLs."""
    today = datetime.now().strftime("%Y%m%d")
    urls = []

    for i, prompt in enumerate(prompts, start=1):
        print(f"[Image] Generating slide {i}/6...")
        try:
            image_bytes = _generate_one(prompt)
            file_path = f"carousel/day_{day_number:04d}_{today}_slide{i}.png"
            url = _upload(image_bytes, file_path)
            urls.append(url)
            print(f"[Image] Slide {i} uploaded.")
        except Exception as e:
            print(f"[Image] Slide {i} failed: {e}")
            urls.append(None)

    return urls


def generate_and_upload(prompt: str, day_number: int) -> str:
    """Single image fallback (kept for compatibility)."""
    today = datetime.now().strftime("%Y%m%d")
    image_bytes = _generate_one(prompt)
    file_path = f"daily/day_{day_number:04d}_{today}.png"
    return _upload(image_bytes, file_path)
