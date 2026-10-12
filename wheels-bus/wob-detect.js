// wob_detect：鏡頭動作偵測 + 拍手偵測（麥克風聲音 / 手部辨識，任一成立）
const wob_detect = (() => {
  const WOB_MP_VER = '0.10.14';
  const WOB_MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${WOB_MP_VER}`;
  const WOB_HAND_MODEL =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

  // ---------- 動作：比對前後畫面差異 ----------
  function wob_motion(videoEl, opts) {
    const W = 64, H = 48;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let prev = null, last = 0, timer = null;

    function tick() {
      if (videoEl.readyState < 2) return;
      ctx.drawImage(videoEl, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const gray = new Uint8Array(W * H);
      for (let i = 0, j = 0; i < px.length; i += 4, j++) {
        gray[j] = (px[i] * 3 + px[i + 1] * 6 + px[i + 2]) / 10;
      }
      if (prev) {
        let changed = 0;
        for (let k = 0; k < gray.length; k++) if (Math.abs(gray[k] - prev[k]) > 28) changed++;
        const frac = changed / gray.length;
        const now = performance.now();
        if (frac > opts.threshold() && now - last > opts.cooldownMs) {
          last = now;
          opts.onMove(frac);
        }
      }
      prev = gray;
    }
    timer = setInterval(tick, 100);
    return { stop() { clearInterval(timer); } };
  }

  // ---------- 拍手：聲音突然變大 ----------
  function wob_clapAudio(audioCtx, stream, onClap) {
    const src = audioCtx.createMediaStreamSource(stream);
    const an = audioCtx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let avg = 0.02, last = 0, raf = 0;

    function loop() {
      an.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > peak) peak = v; }
      const now = performance.now();
      if (peak > 0.3 && peak > avg * 5 && now - last > 700) {
        last = now;
        onClap('audio');
      }
      avg = avg * 0.95 + peak * 0.05;
      raf = requestAnimationFrame(loop);
    }
    loop();
    return { stop() { cancelAnimationFrame(raf); src.disconnect(); } };
  }

  // ---------- 拍手：兩隻手靠近（MediaPipe） ----------
  async function wob_clapHands(videoEl, onClap) {
    const vision = await import(`${WOB_MP_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${WOB_MP_BASE}/wasm`);
    const marker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: WOB_HAND_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    let stopped = false, apart = false, last = 0, lastT = -1;

    function loop() {
      if (stopped) return;
      if (videoEl.readyState >= 2 && videoEl.currentTime !== lastT) {
        lastT = videoEl.currentTime;
        const res = marker.detectForVideo(videoEl, performance.now());
        const hands = res.landmarks || [];
        if (hands.length === 2) {
          const a = hands[0][9], b = hands[1][9]; // 掌心
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const now = performance.now();
          if (d > 0.22) apart = true;
          if (apart && d < 0.12 && now - last > 700) {
            apart = false; last = now;
            onClap('hands');
          }
        }
      }
      requestAnimationFrame(loop);
    }
    loop();
    return { stop() { stopped = true; marker.close(); } };
  }

  return { wob_motion, wob_clapAudio, wob_clapHands };
})();
