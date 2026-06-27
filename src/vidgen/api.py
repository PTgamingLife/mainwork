"""
vidgen 的 HTTP API —— 前端(talkmeme)把文稿送進來、輪詢進度、取回成片的接點。

因為 build_video() 耗時,API 走非同步 job 模型(見 jobstore.py):

  POST   /jobs               送出文稿 + 參數 → 立刻回 { id, status: "queued" }
  GET    /jobs               列出所有 job(除錯/管理用)
  GET    /jobs/<id>          查單一 job 狀態(status / stage / progress)
  GET    /jobs/<id>/video    下載成片 final.mp4(done 後才有)
  GET    /jobs/<id>/storyboard  取回回填過 duration 的分鏡表 JSON
  GET    /health             健康檢查

POST /jobs 接受兩種格式:
  · application/json:{ script, title?, style?, aspect?, use_llm? }(純文字、最簡單)
  · multipart/form-data:同上欄位,另可附 bg(背景圖,可多張)與 music(配樂)檔案

前端是純靜態頁、與 API 不同源,因此全程開 CORS。
"""
from __future__ import annotations

import os
import uuid

from flask import Flask, jsonify, request, send_file

from .jobstore import JobManager

ALLOWED_ASPECTS = {"9:16", "16:9", "1:1", "4:5"}
DEFAULT_STYLE = "cinematic, soft natural lighting, shallow depth of field"


def _parse_use_llm(raw) -> bool | None:
    """把表單/JSON 的 use_llm 轉成 True / False / None(None = 依環境變數自動決定)。"""
    if raw is None or raw == "":
        return None
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def create_app(manager: JobManager | None = None) -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024 * 1024  # 上傳上限 64MB(背景圖/配樂)
    mgr = manager or JobManager(base_dir=os.environ.get("VIDGEN_API_WORKDIR", "out/api"))
    uploads_root = os.path.join(mgr.base_dir, "uploads")

    # ---- CORS:靜態前端跨來源呼叫 ----
    @app.after_request
    def _cors(resp):
        resp.headers["Access-Control-Allow-Origin"] = os.environ.get("VIDGEN_CORS_ORIGIN", "*")
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return resp

    @app.route("/jobs", methods=["OPTIONS"])
    @app.route("/jobs/<job_id>", methods=["OPTIONS"])
    def _preflight(job_id: str | None = None):
        return ("", 204)

    # ---- 路由 ----
    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.post("/jobs")
    def create_job():
        params, title, err = _collect_params(request, uploads_root)
        if err:
            return jsonify(error=err), 400
        job = mgr.submit(params, title=title)
        return jsonify(job.to_public()), 202

    @app.get("/jobs")
    def list_jobs():
        return jsonify(jobs=[j.to_public() for j in mgr.list()])

    @app.get("/jobs/<job_id>")
    def get_job(job_id: str):
        job = mgr.get(job_id)
        if job is None:
            return jsonify(error="job not found"), 404
        return jsonify(job.to_public())

    @app.get("/jobs/<job_id>/video")
    def get_video(job_id: str):
        job = mgr.get(job_id)
        if job is None:
            return jsonify(error="job not found"), 404
        if job.status != "done" or not job.video_path or not os.path.exists(job.video_path):
            return jsonify(error="video not ready", status=job.status), 409
        return send_file(job.video_path, mimetype="video/mp4", as_attachment=True,
                         download_name=f"{job.title or 'video'}.mp4")

    @app.get("/jobs/<job_id>/storyboard")
    def get_storyboard(job_id: str):
        job = mgr.get(job_id)
        if job is None:
            return jsonify(error="job not found"), 404
        path = os.path.join(job.workdir, "storyboard.resolved.json")
        if not os.path.exists(path):
            path = os.path.join(job.workdir, "storyboard.json")
        if not os.path.exists(path):
            return jsonify(error="storyboard not ready", status=job.status), 409
        return send_file(path, mimetype="application/json")

    return app


def _collect_params(req, uploads_root: str) -> tuple[dict, str, str | None]:
    """從 request(JSON 或 multipart)取出 build_video 參數。回傳 (params, title, error)。"""
    files = req.files if req.files else None
    data = req.form if (req.form or files) else (req.get_json(silent=True) or {})

    script = (data.get("script") or "").strip()
    if not script:
        return {}, "", "缺少 script(文稿內容不可為空)"

    title = (data.get("title") or "未命名").strip()
    style = (data.get("style") or DEFAULT_STYLE).strip()
    aspect = (data.get("aspect") or "9:16").strip()
    if aspect not in ALLOWED_ASPECTS:
        return {}, "", f"aspect 必須是 {sorted(ALLOWED_ASPECTS)} 之一"
    use_llm = _parse_use_llm(data.get("use_llm"))

    # 上傳檔案(僅 multipart 有):背景圖 bg(可多)、配樂 music
    background_refs: list[str] = []
    music_path: str | None = None
    if files:
        token = uuid.uuid4().hex[:12]
        updir = os.path.join(uploads_root, token)
        os.makedirs(updir, exist_ok=True)
        for f in req.files.getlist("bg"):
            if f and f.filename:
                dest = os.path.join(updir, _safe_name(f.filename))
                f.save(dest)
                background_refs.append(dest)
        music = req.files.get("music")
        if music and music.filename:
            music_path = os.path.join(updir, _safe_name(music.filename))
            music.save(music_path)

    params = {
        "script": script,
        "title": title,
        "visual_style": style,
        "aspect_ratio": aspect,
        "background_refs": background_refs or None,
        "music_path": music_path,
        "use_llm": use_llm,
    }
    return params, title, None


def _safe_name(name: str) -> str:
    """只保留檔名本身,避免路徑穿越。"""
    base = os.path.basename(name).replace("\x00", "")
    return base or "upload"
