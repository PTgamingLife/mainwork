// wob_setup：歌曲（固定）、靈敏度、自己上傳照片的設定頁
const WOB_SLOT_SEC = 2;
const WOB_SONG_URL = 'song.mp3';

const wob_state = {
  song: { url: WOB_SONG_URL, duration: 124 }, // 固定歌曲；載入後更新實際長度
  media: [],    // 這次要播的素材（預設內容或自己上傳）[{ kind, url, name }]
  custom: [],   // 自己上傳的素材 [{ id, kind:'image'|'video', blob, url, mtime, name }]
  sens: 0.08,
};

const wob_setup = (() => {
  const $ = id => document.getElementById(id);
  const wob_els = {
    mediaInput: $('wob_media_input'), mediaInfo: $('wob_media_info'),
    grid: $('wob_grid'), sortDate: $('wob_sort_date'), clear: $('wob_clear'),
    sens: $('wob_sens'), go: $('wob_go'),
  };

  function wob_loadSongDuration() {
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => { wob_state.song.duration = a.duration; wob_render(); };
    a.src = WOB_SONG_URL;
  }

  // 儲存失敗（無痕模式、空間不足）不影響這次使用
  function wob_safe(p) {
    return p.catch(() => {
      wob_els.mediaInfo.dataset.warn = '⚠ 這台裝置無法儲存素材，重新整理後需要再選一次。';
    });
  }

  function wob_saveOrder() {
    return wob_safe(wob_store.setMeta('order', wob_state.custom.map(m => m.id)));
  }

  function wob_render() {
    const n = wob_state.custom.length;
    const need = Math.ceil(wob_state.song.duration / WOB_SLOT_SEC);
    let info = `目前 ${n} 個素材`;
    if (n) {
      if (n < need) info += `，歌曲約需 ${need} 個：還差 ${need - n} 個（不夠時會從頭循環）`;
      else if (n > need) info += `，歌曲約需 ${need} 個：多出 ${n - need} 個播不到（淡色顯示）`;
      else info += '，剛好配滿整首歌 👍';
    }
    wob_els.mediaInfo.textContent = info + (wob_els.mediaInfo.dataset.warn ? `　${wob_els.mediaInfo.dataset.warn}` : '');

    wob_els.grid.innerHTML = '';
    wob_state.custom.forEach((m, i) => {
      const li = document.createElement('li');
      li.className = 'wob-thumb' + (i >= need ? ' is-extra' : '');
      const el = document.createElement(m.kind === 'video' ? 'video' : 'img');
      if (m.kind === 'video') { el.muted = true; el.preload = 'metadata'; el.src = m.url + '#t=0.5'; }
      else { el.src = m.url; el.alt = m.name; el.loading = 'lazy'; }
      li.append(el);
      li.insertAdjacentHTML('beforeend',
        `<span class="wob-thumb-no">${i + 1}</span>` +
        (m.kind === 'video' ? '<span class="wob-thumb-vid">影片</span>' : '') +
        `<div class="wob-thumb-ctl">
           <button type="button" data-act="left" data-i="${i}" aria-label="往前">◀</button>
           <button type="button" data-act="del" data-i="${i}" aria-label="刪除">✕</button>
           <button type="button" data-act="right" data-i="${i}" aria-label="往後">▶</button>
         </div>`);
      wob_els.grid.append(li);
    });

    wob_els.go.disabled = !n;
  }

  async function wob_onMedia(e) {
    const files = [...e.target.files].filter(f => /^(image|video)\//.test(f.type));
    const recs = files
      .sort((a, b) => a.lastModified - b.lastModified)
      .map(f => ({
        id: wob_store.wob_id(), kind: f.type.startsWith('video') ? 'video' : 'image',
        blob: f, name: f.name, mtime: f.lastModified,
      }));
    await wob_safe(wob_store.putFiles(recs));
    recs.forEach(r => wob_state.custom.push({ ...r, url: URL.createObjectURL(r.blob) }));
    await wob_saveOrder();
    e.target.value = '';
    wob_render();
  }

  async function wob_onGrid(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const i = Number(btn.dataset.i), list = wob_state.custom;
    if (btn.dataset.act === 'del') {
      const [m] = list.splice(i, 1);
      URL.revokeObjectURL(m.url);
      await wob_safe(wob_store.deleteFile(m.id));
    } else {
      const j = btn.dataset.act === 'left' ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    }
    await wob_saveOrder();
    wob_render();
  }

  async function wob_onSortDate() {
    wob_state.custom.sort((a, b) => a.mtime - b.mtime);
    await wob_saveOrder();
    wob_render();
  }

  async function wob_onClear() {
    if (!confirm('確定清除這台裝置上自己上傳的所有照片/影片？')) return;
    wob_state.custom.forEach(m => URL.revokeObjectURL(m.url));
    wob_state.custom = [];
    await wob_safe(wob_store.clearAll());
    wob_render();
  }

  function wob_onSens(e) {
    if (e.target.name !== 'wob_sens') return;
    wob_state.sens = Number(e.target.value);
    wob_safe(wob_store.setMeta('sens', wob_state.sens));
  }

  async function init() {
    wob_loadSongDuration();
    wob_els.mediaInput.addEventListener('change', wob_onMedia);
    wob_els.grid.addEventListener('click', wob_onGrid);
    wob_els.sortDate.addEventListener('click', wob_onSortDate);
    wob_els.clear.addEventListener('click', wob_onClear);
    wob_els.sens.addEventListener('change', wob_onSens);

    try {
      const [files, order, sens] = await Promise.all([
        wob_store.getAllFiles(), wob_store.getMeta('order'), wob_store.getMeta('sens'),
      ]);
      const byId = new Map(files.filter(f => f.kind !== 'song').map(f => [f.id, f]));
      const ids = (order || []).filter(id => byId.has(id));
      byId.forEach((_, id) => { if (!ids.includes(id)) ids.push(id); });
      wob_state.custom = ids.map(id => ({ ...byId.get(id), url: URL.createObjectURL(byId.get(id).blob) }));
      if (sens) {
        wob_state.sens = sens;
        const r = wob_els.sens.querySelector(`input[value="${sens}"]`);
        if (r) r.checked = true;
      }
    } catch (err) {
      wob_els.mediaInfo.dataset.warn = '⚠ 這台裝置無法儲存素材，重新整理後需要再選一次。';
    }
    wob_render();
  }

  return { init, wob_render };
})();
