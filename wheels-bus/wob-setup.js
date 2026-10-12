// wob_setup：設定頁（上傳歌曲/素材、排序、靈敏度）
const WOB_SLOT_SEC = 3;

const wob_state = {
  song: null,   // { id, blob, url, duration, name }
  media: [],    // [{ id, kind:'image'|'video', blob, url, mtime, name }]
  sens: 0.08,
};

const wob_setup = (() => {
  const $ = id => document.getElementById(id);
  const wob_els = {
    songInput: $('wob_song_input'), songInfo: $('wob_song_info'),
    mediaInput: $('wob_media_input'), mediaInfo: $('wob_media_info'),
    grid: $('wob_grid'), sortDate: $('wob_sort_date'), clear: $('wob_clear'),
    sens: $('wob_sens'), go: $('wob_go'),
  };

  function wob_fmt(sec) {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function wob_duration(url) {
    return new Promise(resolve => {
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => resolve(a.duration);
      a.onerror = () => resolve(0);
      a.src = url;
    });
  }

  async function wob_setSong(rec) {
    if (wob_state.song) URL.revokeObjectURL(wob_state.song.url);
    const url = URL.createObjectURL(rec.blob);
    wob_state.song = { ...rec, url, duration: await wob_duration(url) };
  }

  // 儲存失敗（無痕模式、空間不足）不影響這次使用
  function wob_safe(p) {
    return p.catch(() => {
      wob_els.mediaInfo.dataset.warn = '⚠ 這台裝置無法儲存素材，重新整理後需要再選一次。';
    });
  }

  function wob_saveOrder() {
    return wob_safe(wob_store.setMeta('order', wob_state.media.map(m => m.id)));
  }

  function wob_render() {
    const song = wob_state.song;
    wob_els.songInfo.textContent = song ? `${song.name}（${wob_fmt(song.duration)}）` : '尚未選擇';

    const n = wob_state.media.length;
    const need = song ? Math.ceil(song.duration / WOB_SLOT_SEC) : 0;
    let info = `目前 ${n} 個素材`;
    if (song && n) {
      if (n < need) info += `，歌曲約需 ${need} 個：還差 ${need - n} 個（不夠時會從頭循環）`;
      else if (n > need) info += `，歌曲約需 ${need} 個：多出 ${n - need} 個播不到（淡色顯示）`;
      else info += '，剛好配滿整首歌 👍';
    }
    wob_els.mediaInfo.textContent = info + (wob_els.mediaInfo.dataset.warn ? `　${wob_els.mediaInfo.dataset.warn}` : '');

    wob_els.grid.innerHTML = '';
    wob_state.media.forEach((m, i) => {
      const li = document.createElement('li');
      li.className = 'wob-thumb' + (song && i >= need ? ' is-extra' : '');
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

    wob_els.go.disabled = !(song && n);
  }

  async function wob_onSong(e) {
    const f = e.target.files[0];
    if (!f) return;
    const rec = { id: 'song', kind: 'song', blob: f, name: f.name, mtime: f.lastModified };
    await wob_safe(wob_store.putFiles([rec]));
    await wob_setSong(rec);
    wob_render();
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
    recs.forEach(r => wob_state.media.push({ ...r, url: URL.createObjectURL(r.blob) }));
    await wob_saveOrder();
    e.target.value = '';
    wob_render();
  }

  async function wob_onGrid(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const i = Number(btn.dataset.i), list = wob_state.media;
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
    wob_state.media.sort((a, b) => a.mtime - b.mtime);
    await wob_saveOrder();
    wob_render();
  }

  async function wob_onClear() {
    if (!confirm('確定清除這台裝置上的歌曲和所有照片/影片？')) return;
    wob_state.media.forEach(m => URL.revokeObjectURL(m.url));
    if (wob_state.song) URL.revokeObjectURL(wob_state.song.url);
    wob_state.media = [];
    wob_state.song = null;
    await wob_safe(wob_store.clearAll());
    wob_render();
  }

  function wob_onSens(e) {
    if (e.target.name !== 'wob_sens') return;
    wob_state.sens = Number(e.target.value);
    wob_safe(wob_store.setMeta('sens', wob_state.sens));
  }

  async function init() {
    wob_els.songInput.addEventListener('change', wob_onSong);
    wob_els.mediaInput.addEventListener('change', wob_onMedia);
    wob_els.grid.addEventListener('click', wob_onGrid);
    wob_els.sortDate.addEventListener('click', wob_onSortDate);
    wob_els.clear.addEventListener('click', wob_onClear);
    wob_els.sens.addEventListener('change', wob_onSens);

    try {
      const [files, order, sens] = await Promise.all([
        wob_store.getAllFiles(), wob_store.getMeta('order'), wob_store.getMeta('sens'),
      ]);
      const song = files.find(f => f.kind === 'song');
      if (song) await wob_setSong(song);
      const byId = new Map(files.filter(f => f.kind !== 'song').map(f => [f.id, f]));
      const ids = (order || []).filter(id => byId.has(id));
      byId.forEach((_, id) => { if (!ids.includes(id)) ids.push(id); });
      wob_state.media = ids.map(id => ({ ...byId.get(id), url: URL.createObjectURL(byId.get(id).blob) }));
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
