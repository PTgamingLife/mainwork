#!/usr/bin/env python3
"""
啟動 vidgen 的 HTTP API(非同步 job 服務)。

  python scripts/serve_api.py                  # 預設 0.0.0.0:8000
  VIDGEN_VOICE_PROVIDER=elevenlabs VIDGEN_BROLL_PROVIDER=http \
  python scripts/serve_api.py --port 8000      # 接上真實 provider(先設好環境變數)

provider / API key 的切換沿用 src/vidgen/README.md 的環境變數,程式不用改。
正式環境建議用 gunicorn 起多個 worker(見 Dockerfile)。
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from vidgen.api import create_app  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="vidgen HTTP API")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    args = parser.parse_args()

    app = create_app()
    app.run(host=args.host, port=args.port, threaded=True)


if __name__ == "__main__":
    main()
