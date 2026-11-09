"""以測試資料庫啟動 lf_ 伺服器(不碰真實資料)。用法:python tests/lf_test_server.py <db路徑> [port]"""
import os
import sys

os.environ["LF_DB"] = sys.argv[1]
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import uvicorn  # noqa: E402

from lf_server import lf_app  # noqa: E402

uvicorn.run(lf_app, host="127.0.0.1", port=int(sys.argv[2]) if len(sys.argv) > 2 else 8767, log_level="warning")
