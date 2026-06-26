"""LINE Messaging API — push text + 6-image carousel."""
import os
import requests

LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"
LINE_BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast"
LINE_BOT_INFO_URL = "https://api.line.me/v2/bot/info"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {os.environ['LINE_CHANNEL_ACCESS_TOKEN']}",
        "Content-Type": "application/json"
    }


def _push(user_id: str, messages: list):
    """Push up to 5 messages to a user."""
    resp = requests.post(
        LINE_PUSH_URL,
        headers=_headers(),
        json={"to": user_id, "messages": messages[:5]},
        timeout=15
    )
    resp.raise_for_status()


def _broadcast(messages: list):
    resp = requests.post(
        LINE_BROADCAST_URL,
        headers=_headers(),
        json={"messages": messages[:5]},
        timeout=15
    )
    resp.raise_for_status()


def _image_msg(url: str) -> dict:
    return {"type": "image", "originalContentUrl": url, "previewImageUrl": url}


def send_carousel(user_id: str | None, text: str, image_urls: list[str]):
    """Send text + 6 carousel images to LINE.
    LINE allows max 5 messages per push, so we make 2 calls:
      Call 1: text + 4 images (slides 1-4)
      Call 2: 2 images (slides 5-6)
    """
    valid_urls = [u for u in image_urls if u]

    # Build message batches
    batch1 = [{"type": "text", "text": text}]
    batch2 = []

    for i, url in enumerate(valid_urls[:6]):
        if i < 4:
            batch1.append(_image_msg(url))
        else:
            batch2.append(_image_msg(url))

    send = _push if user_id else _broadcast
    target = user_id

    if user_id:
        _push(user_id, batch1)
        if batch2:
            _push(user_id, batch2)
        print(f"[LINE] Carousel sent to {user_id[:8]}... ({len(valid_urls)} images)")
    else:
        _broadcast(batch1)
        if batch2:
            _broadcast(batch2)
        print(f"[LINE] Carousel broadcasted ({len(valid_urls)} images)")


def send_daily_message(user_id: str | None, text: str, image_url: str = None):
    """Legacy single-image send (kept for compatibility)."""
    messages = [{"type": "text", "text": text}]
    if image_url:
        messages.append(_image_msg(image_url))
    if user_id:
        _push(user_id, messages)
        print(f"[LINE] Pushed to user {user_id[:8]}...")
    else:
        _broadcast(messages)
        print("[LINE] Broadcasted.")


def verify_token() -> bool:
    try:
        resp = requests.get(LINE_BOT_INFO_URL, headers=_headers(), timeout=10)
        return resp.status_code == 200
    except Exception:
        return False


def get_bot_info() -> dict:
    resp = requests.get(LINE_BOT_INFO_URL, headers=_headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()
