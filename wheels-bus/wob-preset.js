// wob_preset：預設內容（Supabase 私有空間 + 家庭密碼），下載後存在瀏覽器快取
const WOB_API = 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/wob-media';
const WOB_PW_KEY = 'wob_pw';
const WOB_CACHE = 'wob_media_v1';

const wob_preset = (() => {
  const $ = id => document.getElementById(id);
  const wob_els = {
    form: $('wob_pw_form'), pw: $('wob_pw'), info: $('wob_preset_info'),
    bar: $('wob_preset_bar'), go: $('wob_preset_go'), forget: $('wob_pw_forget'),
  };
  let wob_items = [];

  function wob_pwGet() { try { return localStorage.getItem(WOB_PW_KEY) || ''; } catch { return ''; } }
  function wob_pwSet(v) { try { v ? localStorage.setItem(WOB_PW_KEY, v) : localStorage.removeItem(WOB_PW_KEY); } catch { /* 無痕模式 */ } }

  function wob_status(text, pct) {
    wob_els.info.textContent = text;
    wob_els.bar.hidden = pct == null;
    if (pct != null) wob_els.bar.firstElementChild.style.width = `${pct}%`;
  }

  // 有快取就用快取，沒有才下載（快取 key 用含雜湊的檔名，內容變了檔名就會變）
  async function wob_fetchBlob(cache, item) {
    const key = new URL(`__wob_cache__/${item.path}`, location.href).href;
    if (cache) {
      const hit = await cache.match(key);
      if (hit) return hit.blob();
    }
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`下載失敗 ${res.status}`);
    const blob = await res.blob();
    if (cache) await cache.put(key, new Response(blob, { headers: { 'Content-Type': blob.type } })).catch(() => {});
    return blob;
  }

  async function wob_cleanCache(cache, items) {
    if (!cache) return;
    const keep = new Set(items.map(i => new URL(`__wob_cache__/${i.path}`, location.href).href));
    for (const req of await cache.keys()) if (!keep.has(req.url)) cache.delete(req);
  }

  async function wob_load(password) {
    wob_els.go.hidden = true;
    wob_els.form.hidden = true;
    wob_status('連線中…', 0);

    let data;
    try {
      const res = await fetch(WOB_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.status === 401) {
        wob_pwSet('');
        wob_els.form.hidden = false;
        wob_els.forget.hidden = true;
        wob_status('密碼不對，請再試一次。');
        return;
      }
      if (res.status === 500) {
        wob_els.form.hidden = false;
        wob_status('預設內容還沒設定好（家長還沒設定家庭密碼）。');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
    } catch (err) {
      wob_els.form.hidden = false;
      wob_status('連不上，請確認網路後再按一次「載入」。');
      return;
    }

    wob_pwSet(password);
    wob_els.forget.hidden = false;
    const items = data.items || [];
    if (!items.length) { wob_status('還沒有預設內容。'); return; }

    const cache = window.caches ? await caches.open(WOB_CACHE).catch(() => null) : null;
    const out = new Array(items.length);
    let done = 0, failed = 0, next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        try {
          const blob = await wob_fetchBlob(cache, items[i]);
          out[i] = { kind: items[i].kind, url: URL.createObjectURL(blob), name: items[i].path };
        } catch { failed++; }
        done++;
        wob_status(`準備中 ${done} / ${items.length}`, (done / items.length) * 100);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    wob_cleanCache(cache, items);

    wob_items.forEach(m => URL.revokeObjectURL(m.url));
    wob_items = out.filter(Boolean);
    if (!wob_items.length) {
      wob_els.form.hidden = false;
      wob_status('下載失敗，請確認網路後再按一次「載入」。');
      return;
    }
    wob_status(`✅ ${wob_items.length} 個照片/影片準備好了` + (failed ? `（${failed} 個下載失敗）` : ''));
    wob_els.go.hidden = false;
  }

  function init() {
    wob_els.form.addEventListener('submit', e => {
      e.preventDefault();
      const pw = wob_els.pw.value.trim();
      if (pw) wob_load(pw);
    });
    wob_els.forget.addEventListener('click', () => {
      wob_pwSet('');
      wob_els.pw.value = '';
      wob_els.go.hidden = true;
      wob_els.forget.hidden = true;
      wob_els.form.hidden = false;
      wob_status('');
    });
    wob_els.go.addEventListener('click', () => {
      wob_state.media = wob_items;
      window.wob_launch();
    });
    const saved = wob_pwGet();
    if (saved) wob_load(saved);
  }

  return { init };
})();
