// 生命之旅 — 每一頁共用:LIFF 登入、呼叫後端、換頁、提示、照片壓縮。
(function () {
  const CFG = window.LJ_CONFIG;
  const LJ = window.LJ = { idToken: '', me: null };
  const $ = (id) => document.getElementById(id);

  // 錯誤碼 → 給人看的話
  const MSG = {
    UNAUTHORIZED: 'LINE 登入過期了，請關掉重新打開。',
    AI_BUSY: 'AI 現在有點忙，請過一分鐘再試一次。',
    AI_REFUSED: 'AI 這次沒辦法寫，請換個說法或換張照片再試。',
    AI_BAD_OUTPUT: 'AI 這次寫得不完整，請再試一次。',
    AI_NOT_CONFIGURED: '系統還在設定中，請稍後再來。',
    REGEN_LIMIT: '已經用完 3 次了，可以直接修改文字。',
    NO_SUCH_CODE: '找不到這個編號，請再確認一次。',
    SELF_GIFT: '不能送給自己喔。',
    TOO_MANY_PENDING: '你送給對方的回憶還有 5 則在等他回覆，等他看完再送吧。',
    PHOTO_TOO_LARGE: '照片太大了，請換一張。',
    BAD_PHOTO_TYPE: '只支援 JPG、PNG、WEBP 照片。',
    NO_PROFILE: '要先完成「認識自己」的問答，才能開始紀錄旅程。',
    ALREADY_FINAL: '這一段已經存好了。',
    NETWORK: '網路好像斷了，請再試一次。',
  };
  LJ.say = (code) => MSG[code] || ('出了點問題(' + code + ')，請再試一次。');

  LJ.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  LJ.api = async function (action, payload) {
    if (CFG.MOCK) return window.LJ_MOCK(action, payload || {});
    try {
      const res = await fetch(CFG.API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action, idToken: LJ.idToken }, payload || {})),
      });
      return await res.json().catch(() => ({ ok: false, error: 'BAD_RESPONSE' }));
    } catch (e) {
      return { ok: false, error: 'NETWORK' };
    }
  };

  // 在 LIFF 裡換頁:保留 ?mock=1,其餘參數自己帶
  LJ.go = function (page, params) {
    const q = new URLSearchParams(params || {});
    if (CFG.MOCK) q.set('mock', '1');
    const s = q.toString();
    location.href = page + (s ? '?' + s : '');
  };
  LJ.param = (k) => new URLSearchParams(location.search).get(k);

  LJ.toast = function (msg) {
    let el = $('ljToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ljToast';
      el.className = 'lj-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(LJ._t);
    LJ._t = setTimeout(() => el.classList.remove('on'), 2600);
  };

  LJ.fail = function (msg) {
    document.body.innerHTML = `<div class="lj-fail"><div class="lj-fail-box">
      <p>${LJ.esc(msg)}</p><button class="btn btn-main" onclick="location.reload()">重新整理</button></div></div>`;
  };

  // 每一頁都先跑這個:LIFF 登入 → 拿 ID token → 回呼(帶 me)
  LJ.boot = async function (onReady, opts) {
    opts = opts || {};
    if (!CFG.MOCK) {
      try {
        await liff.init({ liffId: CFG.LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
        LJ.idToken = liff.getIDToken() || '';
        if (!LJ.idToken) return LJ.fail('拿不到 LINE 身分，請關掉重新打開。');
      } catch (e) {
        return LJ.fail('LINE 連線失敗，請在 LINE 裡打開這個頁面。');
      }
    }
    if (opts.skipMe) return onReady(null);
    const me = await LJ.api('me');
    if (!me.ok) return LJ.fail(LJ.say(me.error));
    LJ.me = me;
    onReady(me);
  };

  // 照片在手機上先壓到長邊 1600px、JPEG 85%:一張大約 200–400KB,上傳快、AI 也看得清楚
  LJ.compress = function (file, maxSide) {
    maxSide = maxSide || 1600;
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('BAD_PHOTO_TYPE'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        resolve({ mime: 'image/jpeg', base64: dataUrl.split(',')[1], preview: dataUrl });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('BAD_PHOTO')); };
      img.src = url;
    });
  };
})();
