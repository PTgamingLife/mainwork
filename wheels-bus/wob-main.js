// wob_main：等待（拍手）→ 播放（能量制）→ 結尾
const WOB_ENERGY_PER_MOVE = 2;   // 動一下加 2 秒
const WOB_ENERGY_MAX = 10;       // 能量上限 10 秒
const WOB_ENERGY_START = 4;      // 拍手出發時的初始能量
const WOB_MOVE_COOLDOWN = 500;   // 兩次「動一下」至少間隔 ms

(() => {
  const $ = id => document.getElementById(id);
  const wob_el = {
    home: $('wob_home'), setup: $('wob_setup'), stage: $('wob_stage'), scene: $('wob_scene'),
    img: $('wob_img'), vid: $('wob_vid'), lyric: $('wob_lyric'),
    cam: $('wob_cam'), fill: $('wob_energy_fill'),
    wait: $('wob_wait'), waitHint: $('wob_wait_hint'), skip: $('wob_skip'),
    move: $('wob_move'), end: $('wob_end'), wall: $('wob_wall'),
    again: $('wob_again'), back: $('wob_back'), go: $('wob_go'),
    toSetup: $('wob_to_setup'), setupBack: $('wob_setup_back'),
  };

  const wob_run = {
    phase: 'idle',      // idle | wait | play | end
    energy: 0,
    lastTs: 0,
    slot: -1,
    audio: new Audio(),
    audioCtx: null,
    stream: null,
    motion: null, clapA: null, clapH: null,
  };
  window.wob_run = wob_run; // 方便測試時觀察

  wob_bus.mount($('wob_bus'), $('wob_bubble'), wob_el.scene);

  // ---------- 鏡頭 / 麥克風 ----------
  async function wob_startSensors() {
    if (wob_run.stream) return true;
    try {
      wob_run.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      wob_el.waitHint.textContent = '沒有拿到鏡頭權限：改成「點螢幕」加能量。';
      return false;
    }
    wob_el.cam.srcObject = wob_run.stream;
    await wob_el.cam.play().catch(() => {});

    wob_run.motion = wob_detect.wob_motion(wob_el.cam, {
      threshold: () => wob_state.sens,
      cooldownMs: WOB_MOVE_COOLDOWN,
      onMove: wob_onMove,
    });
    if (wob_run.audioCtx && wob_run.stream.getAudioTracks().length) {
      wob_run.clapA = wob_detect.wob_clapAudio(wob_run.audioCtx, wob_run.stream, wob_onClap);
    }
    wob_detect.wob_clapHands(wob_el.cam, wob_onClap)
      .then(h => { wob_run.clapH = h; })
      .catch(() => { /* 模型載不到時只用聲音判斷 */ });
    return true;
  }

  // ---------- 流程 ----------
  function wob_show(page) {
    wob_el.home.classList.toggle('is-active', page === 'home');
    wob_el.setup.classList.toggle('is-active', page === 'setup');
    wob_el.stage.classList.toggle('is-active', page === 'stage');
  }

  async function wob_toWait() {
    wob_run.phase = 'wait';
    wob_run.energy = 0;
    wob_run.slot = -1;
    wob_bus.reset();
    wob_el.lyric.textContent = '';
    wob_el.img.classList.remove('is-on');
    wob_el.vid.classList.remove('is-on');
    wob_el.end.classList.remove('is-on');
    wob_el.move.classList.remove('is-on');
    wob_el.wait.classList.add('is-on');
    wob_el.scene.classList.remove('is-playing');
    wob_run.audio.currentTime = 0;
    const ok = await wob_startSensors();
    if (ok) wob_el.waitHint.textContent = '對著鏡頭拍拍手 👏';
  }

  function wob_toPlay() {
    if (wob_run.phase !== 'wait') return;
    wob_run.phase = 'play';
    wob_el.wait.classList.remove('is-on');
    wob_run.energy = WOB_ENERGY_START;
  }

  function wob_toEnd() {
    wob_run.phase = 'end';
    wob_el.scene.classList.remove('is-playing');
    wob_el.vid.pause();
    wob_el.move.classList.remove('is-on');
    wob_el.wall.innerHTML = '';
    wob_state.media.forEach((m, i) => {
      const el = document.createElement(m.kind === 'video' ? 'video' : 'img');
      el.src = m.kind === 'video' ? m.url + '#t=0.5' : m.url;
      if (m.kind === 'video') el.muted = true;
      el.style.animationDelay = `${Math.min(i * 40, 2400)}ms`;
      wob_el.wall.append(el);
    });
    wob_el.end.classList.add('is-on');
  }

  function wob_onClap() {
    if (wob_run.phase === 'wait') wob_toPlay();
  }

  function wob_onMove() {
    if (wob_run.phase !== 'play') return;
    wob_run.energy = Math.min(WOB_ENERGY_MAX, wob_run.energy + WOB_ENERGY_PER_MOVE);
  }

  // ---------- 素材切換 ----------
  function wob_showSlot(idx) {
    const list = wob_state.media;
    const m = list[idx % list.length];
    const { img, vid } = wob_el;
    if (m.kind === 'image') {
      vid.pause();
      vid.classList.remove('is-on');
      img.classList.remove('is-on');
      void img.offsetWidth; // 重新觸發淡入
      img.src = m.url;
      img.classList.add('is-on');
    } else {
      img.classList.remove('is-on');
      vid.classList.remove('is-on');
      vid.src = m.url;
      vid.currentTime = 0;
      void vid.offsetWidth;
      vid.classList.add('is-on');
      if (wob_el.scene.classList.contains('is-playing')) vid.play().catch(() => {});
    }
  }

  // ---------- 主迴圈 ----------
  function wob_tick(ts) {
    const dt = wob_run.lastTs ? (ts - wob_run.lastTs) / 1000 : 0;
    wob_run.lastTs = ts;

    if (wob_run.phase === 'play') {
      wob_run.energy = Math.max(0, wob_run.energy - dt);
      const on = wob_run.energy > 0;
      const a = wob_run.audio, vid = wob_el.vid;
      const isVid = vid.classList.contains('is-on');

      if (on && a.paused) {
        a.play().catch(() => {});
        if (isVid && vid.currentTime < WOB_SLOT_SEC && !vid.ended) vid.play().catch(() => {});
      } else if (!on && !a.paused) {
        a.pause();
        vid.pause();
      }
      wob_el.scene.classList.toggle('is-playing', on);
      wob_el.move.classList.toggle('is-on', !on);

      if (isVid && vid.currentTime >= WOB_SLOT_SEC) vid.pause(); // 超過一格的秒數就截掉

      const t = a.currentTime, dur = wob_state.song.duration || a.duration || 0;
      const slot = Math.floor(t / WOB_SLOT_SEC);
      if (slot !== wob_run.slot) { wob_run.slot = slot; wob_showSlot(slot); }
      const v = wob_bus.setVerse(wob_bus.verseAt(t, dur));
      if (v) wob_el.lyric.textContent = v.line;
    }
    wob_el.fill.style.width = `${(wob_run.energy / WOB_ENERGY_MAX) * 100}%`;
    requestAnimationFrame(wob_tick);
  }

  // ---------- 事件 ----------
  wob_run.audio.addEventListener('ended', wob_toEnd);

  // 開始播放 wob_state.media；必須在使用者點擊當下呼叫（iOS 解鎖聲音）
  window.wob_launch = () => {
    wob_run.audio.src = wob_state.song.url;
    wob_run.audio.play().then(() => wob_run.audio.pause()).catch(() => {});
    if (!wob_run.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      wob_run.audioCtx = new Ctx();
    }
    wob_run.audioCtx.resume();
    wob_show('stage');
    wob_toWait();
  };

  wob_el.go.addEventListener('click', () => {
    wob_state.media = wob_state.custom;
    window.wob_launch();
  });
  wob_el.toSetup.addEventListener('click', () => wob_show('setup'));
  wob_el.setupBack.addEventListener('click', () => wob_show('home'));

  wob_el.skip.addEventListener('click', wob_toPlay);

  // 沒有鏡頭時的備案：點螢幕也算動一下
  wob_el.scene.addEventListener('pointerdown', e => {
    if (!wob_run.motion && !e.target.closest('button')) wob_onMove();
  });

  wob_el.again.addEventListener('click', wob_toWait);

  wob_el.back.addEventListener('click', () => {
    wob_run.phase = 'idle';
    wob_run.audio.pause();
    wob_show('home');
  });

  wob_setup.init();
  wob_preset.init();
  requestAnimationFrame(wob_tick);
})();
