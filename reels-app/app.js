/* Reels 教練 — 前端邏輯(免建置 SPA)
 * 依賴:supabase-js UMD、marked(皆由 CDN 載入,見 index.html)、config.js
 */
(function () {
  "use strict";

  const cfg = window.REELS_CONFIG || {};
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR_PROJECT")) {
    document.getElementById("auth-msg").textContent =
      "尚未設定 config.js:請填入 SUPABASE_URL 與 SUPABASE_ANON_KEY";
  }
  if (!window.supabase || !window.marked) {
    document.getElementById("auth-msg").textContent =
      "必要函式庫載入失敗(CDN 被擋?),請檢查網路後重新整理。";
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const $ = (id) => document.getElementById(id);
  const md = (text) => window.marked.parse(text || "", { gfm: true, breaks: true });

  const MAX_WHISPER_BYTES = 25 * 1024 * 1024;
  const FRAME_INTERVAL_SEC = 2;
  const MAX_FRAMES = 20;

  let currentUser = null;

  /* ---------- view 切換 ---------- */
  function showView(name) {
    ["login", "model", "generate", "analyze"].forEach((v) => {
      $("view-" + v).classList.toggle("hidden", v !== name);
    });
    document.querySelectorAll(".nav-btn[data-view]").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === name);
    });
    $("nav").classList.toggle("hidden", name === "login");
  }

  document.querySelectorAll(".nav-btn[data-view]").forEach((b) => {
    b.addEventListener("click", () => {
      showView(b.dataset.view);
      if (b.dataset.view === "model") loadModel();
      if (b.dataset.view === "generate") loadScripts();
    });
  });

  /* ---------- 認證 ---------- */
  async function refreshSession() {
    const { data } = await sb.auth.getSession();
    currentUser = data.session ? data.session.user : null;
    if (currentUser) {
      showView("model");
      await ensureModelSeeded();
      loadModel();
    } else {
      showView("login");
    }
  }

  $("signin-btn").addEventListener("click", async () => {
    const { error } = await sb.auth.signInWithPassword({
      email: $("auth-email").value.trim(),
      password: $("auth-password").value,
    });
    $("auth-msg").textContent = error ? "登入失敗:" + error.message : "";
    if (!error) refreshSession();
  });

  $("signup-btn").addEventListener("click", async () => {
    const { data, error } = await sb.auth.signUp({
      email: $("auth-email").value.trim(),
      password: $("auth-password").value,
    });
    if (error) { $("auth-msg").textContent = "註冊失敗:" + error.message; return; }
    if (data.session) { refreshSession(); }
    else { $("auth-msg").textContent = "註冊成功!請到信箱點擊驗證連結後再登入。"; $("auth-msg").classList.add("ok"); }
  });

  $("logout-btn").addEventListener("click", async () => {
    await sb.auth.signOut();
    currentUser = null;
    showView("login");
  });

  /* ---------- 個人模型 ---------- */
  async function ensureModelSeeded() {
    const { data: existing } = await sb
      .from("user_models").select("id").eq("user_id", currentUser.id).limit(1);
    if (existing && existing.length) return;
    const { data: base, error: baseErr } = await sb
      .from("base_models").select("content, version").eq("id", 1).single();
    if (baseErr || !base) return;
    await sb.from("user_models").insert({
      user_id: currentUser.id,
      version: base.version,
      content: base.content,
      change_note: "帳號建立:載入通用種子模型",
    });
  }

  async function loadModel() {
    const { data: models } = await sb
      .from("user_models")
      .select("version, content, change_note, created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });
    if (!models || !models.length) {
      $("model-content").textContent = "尚無模型,請重新整理。";
      return;
    }
    const latest = models[0];
    $("model-version").textContent = latest.version;
    $("model-content").innerHTML = md(latest.content);
    $("model-history").innerHTML = models
      .map((m) =>
        `<div class="list-item"><strong>${esc(m.version)}</strong> — ${esc(m.change_note || "")}` +
        `<div class="meta">${fmtTime(m.created_at)}</div></div>`)
      .join("");

    const { data: cases } = await sb
      .from("cases")
      .select("case_no, source_url, is_own, content, created_at")
      .eq("user_id", currentUser.id)
      .order("case_no", { ascending: false });
    $("case-list").innerHTML = (cases && cases.length)
      ? cases.map((c) =>
          `<details class="list-item"><summary>Case #${c.case_no}` +
          `${c.is_own ? "(自己的)" : "(參考)"} ${c.source_url ? esc(c.source_url) : ""}` +
          `<span class="meta"> ${fmtTime(c.created_at)}</span></summary>` +
          `<div class="md-body">${md(c.content)}</div></details>`).join("")
      : "還沒有案例 — 去「分析 Reels」上傳第一支吧。";
  }

  $("model-refresh").addEventListener("click", loadModel);

  /* ---------- 生成腳本 ---------- */
  async function callFn(name, body) {
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) throw new Error("請重新登入");
    const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess.session.access_token}`,
        apikey: cfg.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `伺服器錯誤(${res.status})`);
    return json;
  }

  $("gen-btn").addEventListener("click", async () => {
    const topic = $("gen-topic").value.trim();
    if (!topic) { $("gen-msg").textContent = "請先填標題/主題"; return; }
    $("gen-btn").disabled = true;
    $("gen-msg").textContent = "生成中(約 30–60 秒)…";
    $("gen-result").classList.add("hidden");
    try {
      const out = await callFn("generate-script", {
        topic,
        material: $("gen-material").value.trim(),
      });
      $("gen-result").innerHTML = md(out.script_md);
      $("gen-result").classList.remove("hidden");
      $("gen-msg").textContent = "";
      loadScripts();
    } catch (e) {
      $("gen-msg").textContent = "生成失敗:" + e.message;
    } finally {
      $("gen-btn").disabled = false;
    }
  });

  async function loadScripts() {
    const { data } = await sb
      .from("scripts").select("topic, content, model_version, created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false }).limit(20);
    $("script-list").innerHTML = (data && data.length)
      ? data.map((s) =>
          `<details class="list-item"><summary>${esc(s.topic)}` +
          `<span class="meta"> 模型 ${esc(s.model_version || "?")} · ${fmtTime(s.created_at)}</span></summary>` +
          `<div class="md-body">${md(s.content)}</div></details>`).join("")
      : "還沒有腳本。";
  }

  /* ---------- 分析 Reels ---------- */
  function setProgress(pct, step) {
    $("ana-progress").classList.remove("hidden");
    $("ana-bar").style.width = pct + "%";
    $("ana-step").textContent = step;
  }

  async function extractFrames(file) {
    // 用 <video>+<canvas> 每 2 秒抽一幀(最多 20 幀),免 ffmpeg
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.src = url;
    await new Promise((ok, bad) => {
      video.onloadedmetadata = ok;
      video.onerror = () => bad(new Error("影片無法讀取,請確認格式(建議 mp4)"));
    });
    const duration = video.duration;
    const interval = Math.max(FRAME_INTERVAL_SEC, duration / MAX_FRAMES);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 720 / video.videoHeight);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    const frames = [];
    for (let t = 0; t < duration && frames.length < MAX_FRAMES; t += interval) {
      // 夾在 (0, duration) 內:currentTime 設成目前值(如 0→0)不會觸發 seeked,會卡死
      const target = Math.min(Math.max(t, 0.05), Math.max(duration - 0.1, 0.05));
      await new Promise((ok) => { video.onseeked = ok; video.currentTime = target; });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.7));
      frames.push({ t: Math.round(t * 10) / 10, blob });
    }
    URL.revokeObjectURL(url);
    return { frames, duration: Math.round(duration * 10) / 10 };
  }

  async function uploadTo(path, fileOrBlob, contentType) {
    const { error } = await sb.storage.from("reels").upload(path, fileOrBlob, {
      contentType, upsert: true,
    });
    if (error) throw new Error("上傳失敗:" + error.message);
    return path;
  }

  $("ana-btn").addEventListener("click", async () => {
    const file = $("ana-video").files[0];
    if (!file) { $("ana-msg").textContent = "請先選擇影片檔"; return; }
    $("ana-btn").disabled = true;
    $("ana-msg").textContent = "";
    $("ana-result").classList.add("hidden");
    try {
      setProgress(10, "抽取畫面幀…");
      const { frames, duration } = await extractFrames(file);

      const stamp = Date.now();
      const dir = `${currentUser.id}/${stamp}`;

      setProgress(30, "上傳影片…");
      const skipTranscript = file.size > MAX_WHISPER_BYTES;
      const videoPath = await uploadTo(`${dir}/video.mp4`, file, file.type || "video/mp4");

      setProgress(50, `上傳 ${frames.length} 張畫面幀…`);
      const framePaths = [];
      for (const f of frames) {
        const p = await uploadTo(`${dir}/frame_${String(f.t).replace(".", "_")}s.jpg`, f.blob, "image/jpeg");
        framePaths.push({ path: p, t: f.t });
      }

      const shotFiles = Array.from($("ana-shots").files).slice(0, 5);
      const screenshotPaths = [];
      for (let i = 0; i < shotFiles.length; i++) {
        setProgress(60, `上傳後台截圖 ${i + 1}/${shotFiles.length}…`);
        screenshotPaths.push(
          await uploadTo(`${dir}/insight_${i}.jpg`, shotFiles[i], shotFiles[i].type || "image/jpeg")
        );
      }

      setProgress(70, skipTranscript
        ? "影片超過 25MB,跳過逐字稿;AI 歸因分析中(約 1–2 分鐘)…"
        : "口播轉逐字稿 + AI 歸因分析中(約 1–2 分鐘)…");
      const out = await callFn("analyze-reel", {
        videoPath, framePaths, screenshotPaths,
        sourceUrl: $("ana-url").value.trim() || null,
        isOwn: $("ana-own").value === "true",
        metricsText: $("ana-metrics").value.trim() || null,
        durationSec: duration,
        skipTranscript,
      });

      setProgress(100, "完成");
      $("ana-result").innerHTML =
        `<p><strong>✅ 模型已更新至 ${esc(out.new_version)}</strong> — ${esc(out.change_note || "")}</p><hr>` +
        md(out.report_md);
      $("ana-result").classList.remove("hidden");
    } catch (e) {
      $("ana-msg").textContent = "分析失敗:" + e.message;
    } finally {
      $("ana-btn").disabled = false;
      setTimeout(() => $("ana-progress").classList.add("hidden"), 1500);
    }
  });

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString("zh-TW"); } catch { return iso; }
  }

  refreshSession();
})();
