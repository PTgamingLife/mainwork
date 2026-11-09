"""lf_ 全域設定:路徑、.env 載入、常數。"""
import os
import pathlib

LF_ROOT = pathlib.Path(__file__).resolve().parent


def lf_load_env(path: pathlib.Path = LF_ROOT / ".env") -> None:
    """簡易 .env 解析(不覆蓋已存在的環境變數)。"""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and v and k not in os.environ:
            os.environ[k] = v


lf_load_env()

LF_DATA = pathlib.Path(os.environ.get("LF_DATA_DIR", LF_ROOT / "lf_data"))
LF_DB_PATH = pathlib.Path(os.environ.get("LF_DB", LF_DATA / "lf_line.db"))
LF_PROFILE = LF_ROOT / "lf_profile"
LF_EXT_DIR = LF_ROOT / "lf_ext"
LF_STATIC = LF_ROOT / "static"
LF_SELECTORS = LF_ROOT / "lf_selectors.json"

LF_HOST = "127.0.0.1"  # 只綁本機,不對外
LF_PORT = int(os.environ.get("LF_PORT", "8766"))
LF_AI_MODEL = os.environ.get("LF_AI_MODEL", "claude-opus-5-5")
LF_EXT_ID = "ophjlpahpchlmihnnnihgmmeilfjmjjc"  # LINE Chrome 擴充 ID

LF_DEFAULT_CATEGORIES = [
    ("家人", "#B8C5D6", "【家】"), ("朋友", "#C9D8C5", "【友】"),
    ("同事", "#D6CDB8", "【同】"), ("客戶", "#E3C4B8", "【客】"),
    ("潛在客戶", "#E8D5A9", "【潛】"), ("廠商", "#C5C0D6", "【廠】"),
    ("學員", "#B8D6D0", "【學】"), ("合作夥伴", "#D6B8C9", "【夥】"),
    ("社團/群組認識", "#C8CFB4", "【社】"), ("沉睡", "#CFCFCF", "【睡】"),
    ("不認識", "#E0D6D6", "【?】"),
]

LF_DEFAULT_SETTINGS = {
    "lf_batch_size": "150",
    "lf_msgs_per_friend": "10",
    "lf_dormant_days": "365",
    "lf_skip_unread": "1",
    "lf_delay_min": "3",
    "lf_delay_max": "8",
    "lf_ai_prompt": (
        "你是個人人脈整理助理。根據好友名稱、狀態消息與最近訊息,"
        "判斷這位好友屬於哪個分類,寫一句 30 字內的摘要與建議下一步。"
        "訊息太少無法判斷時,分類填「不認識」。"
    ),
}
