# vidgen HTTP API —— 文稿轉口播影片服務。
# 需要 ffmpeg 二進位,所以不能跑在 Edge Function(Deno),這裡用一般容器。
FROM python:3.11-slim

# ffmpeg / ffprobe 是合成與量測長度的必要工具
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY scripts ./scripts

ENV PYTHONPATH=/app/src \
    PORT=8000 \
    VIDGEN_API_WORKDIR=/data/out

# job store 在記憶體、由背景 worker thread 消化,因此只能跑「單一程序」。
# gunicorn 用 1 worker + 多 threads:對外可並發收請求,job 仍由同一個 JobManager 管理。
# 若要水平擴展(多程序/多機),需把 jobstore 換成共享儲存(DB + 物件儲存),介面不變。
EXPOSE 8000
CMD ["gunicorn", "--workers", "1", "--threads", "8", "--timeout", "0", \
     "--bind", "0.0.0.0:8000", "vidgen.api:create_app()"]
