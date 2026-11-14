"""
影片生成的工作佇列(job store)。

build_video() 是同步且耗時(數十秒~數分鐘)的工作,HTTP 請求不能同步等它。
這裡把它包成「送出 → 背景跑 → 輪詢狀態 → 下載成片」的非同步 job 模型:

  · 單一 worker thread 依序消化佇列 —— ffmpeg 很吃 CPU,序列化處理比並發穩定。
  · job 狀態存在記憶體(程序重啟即清空),產出落在各自的 workdir。
    需要跨重啟保存時,再把 _jobs 換成資料庫即可,介面不變。

狀態流轉:queued → running → done | error
"""
from __future__ import annotations

import os
import queue
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field

from .pipeline import build_video


@dataclass
class Job:
    """單一影片生成工作。"""

    id: str
    title: str
    params: dict                      # 傳給 build_video 的參數(不含 progress)
    workdir: str
    status: str = "queued"            # queued | running | done | error
    stage: str = ""                   # 目前階段(人類可讀)
    progress: float = 0.0             # 0~1
    error: str = ""
    video_path: str = ""              # 完成後的成片路徑
    created_at: float = field(default_factory=time.time)
    started_at: float = 0.0
    finished_at: float = 0.0

    def to_public(self) -> dict:
        """回給前端的精簡視圖(不洩漏內部絕對路徑等細節)。"""
        return {
            "id": self.id,
            "title": self.title,
            "status": self.status,
            "stage": self.stage,
            "progress": round(self.progress, 4),
            "error": self.error,
            "has_video": bool(self.video_path) and os.path.exists(self.video_path),
            "created_at": self.created_at,
            "started_at": self.started_at or None,
            "finished_at": self.finished_at or None,
        }


class JobManager:
    """執行緒安全的 job 佇列 + 背景 worker。"""

    def __init__(self, base_dir: str = "out/api", workers: int = 1) -> None:
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._queue: "queue.Queue[str]" = queue.Queue()
        self._threads: list[threading.Thread] = []
        for i in range(max(1, workers)):
            t = threading.Thread(target=self._worker, name=f"vidgen-worker-{i}", daemon=True)
            t.start()
            self._threads.append(t)

    # ---- 對外介面 ----

    def submit(self, params: dict, title: str = "未命名") -> Job:
        """建立一個 job 並排入佇列,立刻回傳(不等生成完成)。"""
        job_id = uuid.uuid4().hex[:12]
        workdir = os.path.join(self.base_dir, job_id)
        os.makedirs(workdir, exist_ok=True)
        job = Job(id=job_id, title=title, params=params, workdir=workdir)
        with self._lock:
            self._jobs[job_id] = job
        self._queue.put(job_id)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        with self._lock:
            return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)

    # ---- 背景 worker ----

    def _worker(self) -> None:
        while True:
            job_id = self._queue.get()
            job = self.get(job_id)
            if job is None:
                self._queue.task_done()
                continue
            try:
                self._run_job(job)
            except Exception:  # noqa: BLE001 - 任何失敗都要記錄,不能讓 worker 掛掉
                job.status = "error"
                job.error = traceback.format_exc(limit=4)
                job.finished_at = time.time()
            finally:
                self._queue.task_done()

    def _run_job(self, job: Job) -> None:
        job.status = "running"
        job.started_at = time.time()

        def on_progress(stage: str, frac: float) -> None:
            job.stage = stage
            job.progress = frac

        video_path = build_video(
            workdir=job.workdir,
            progress=on_progress,
            **job.params,
        )
        job.video_path = video_path
        job.status = "done"
        job.stage = "完成"
        job.progress = 1.0
        job.finished_at = time.time()
