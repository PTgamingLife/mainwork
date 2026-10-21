// IG Planner — 單日詳情(逐字稿、分段腳本、拍攝注意事項、B-roll)+ 提詞器

const IGP_WPM = 250; // 中文口播每分鐘約 250 字

function igpEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 中日韓字每字算 1,英文/數字每個單字算 1
function igpCount(text) {
  const t = String(text || '');
  const cjk = (t.match(/[㐀-鿿豈-﫿]/g) || []).length;
  const words = (t.replace(/[㐀-鿿豈-﫿]/g, ' ').match(/[A-Za-z0-9]+(?:['’`][A-Za-z]+)?/g) || []).length;
  return cjk + words;
}

function igpMeter(text) {
  const n = igpCount(text);
  const sec = Math.round(n / IGP_WPM * 60);
  return { n, sec, over: sec > 60, label: `${n} 字 · 約 ${sec} 秒${sec > 60 ? ' ⚠ 超過 60 秒' : ''}` };
}

function igpOptions(map, cur) {
  return Object.entries(map).map(([v, t]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${igpEsc(t)}</option>`).join('');
}

function igpChecklist(key, items, placeholder) {
  const done = items.filter(x => x.done).length;
  return `
    <div class="igp-checks">
      ${items.map((x, i) => `
        <div class="igp-check${x.done ? ' igp-done' : ''}">
          <input type="checkbox" data-list="${key}" data-i="${i}" data-k="done"${x.done ? ' checked' : ''}>
          <input type="text" data-list="${key}" data-i="${i}" data-k="text" value="${igpEsc(x.text)}">
          <button class="igp-x" data-del="${key}" data-i="${i}" aria-label="刪除">✕</button>
        </div>`).join('')}
    </div>
    <div class="igp-box-head" style="margin:8px 0 0">
      <button class="igp-btn igp-small" data-add="${key}">＋ ${placeholder}</button>
      <span class="igp-progress igp-right">${done} / ${items.length} 完成</span>
    </div>`;
}

function igpDetailHtml(ep) {
  const m1 = igpMeter(ep.igp_script);
  const m2 = igpMeter(ep.igp_script_short);
  const style = IGP_STYLES.find(s => s.id === ep.igp_style);
  const d = new Date(ep.igp_date + 'T00:00:00');
  const wd = '日一二三四五六'[d.getDay()];
  return `
  <div class="igp-sheet" role="dialog" aria-modal="true">
    <div class="igp-sheet-head">
      <b>${d.getMonth() + 1}/${d.getDate()}(${wd})${ep.igp_day ? ` · Day ${ep.igp_day}` : ''}</b>
      <span class="igp-save" id="igp-save-state"></span>
      <button id="igp-close" aria-label="關閉">✕</button>
    </div>
    <div class="igp-sheet-body">
      <div class="igp-field">
        <label>主題標題</label>
        <input type="text" class="igp-title-input" data-f="igp_title" value="${igpEsc(ep.igp_title)}" placeholder="今天的主題" maxlength="120">
      </div>

      <div class="igp-row">
        <div class="igp-field"><label>狀態</label><select data-f="igp_status">${igpOptions(IGP_STATUSES, ep.igp_status)}</select></div>
        <div class="igp-field"><label>類型</label><select data-f="igp_type">${igpOptions(Object.fromEntries(Object.entries(IGP_TYPES).map(([k, v]) => [k, `${v.emoji} ${v.name}`])), ep.igp_type)}</select></div>
        <div class="igp-field"><label>寫法</label><select data-f="igp_style">${igpOptions(Object.fromEntries(IGP_STYLES.map(s => [s.id, s.name])), ep.igp_style)}</select></div>
        <div class="igp-field"><label>📊 主要互動目標</label><select data-f="igp_signal">${igpOptions(Object.fromEntries(IGP_SIGNALS.map(s => [s, s])), ep.igp_signal)}</select></div>
      </div>

      <div class="igp-box igp-hook">
        <div class="igp-box-head"><span class="igp-label">🎯 Hook(前 3 秒)</span></div>
        <textarea data-f="igp_hook" maxlength="300" placeholder="第一句話就要讓人停下來">${igpEsc(ep.igp_hook)}</textarea>
        <div class="igp-hint">寫法公式:${igpEsc(style?.formula || '')}</div>
      </div>

      <div class="igp-box">
        <div class="igp-box-head">
          <span class="igp-label">📝 逐字稿(完整版)</span>
          <span class="igp-right">
            <span class="igp-meter${m1.over ? ' igp-over' : ''}" data-meter="igp_script">${m1.label}</span>
            <button class="igp-btn igp-small" data-copy="igp_script">複製</button>
          </span>
        </div>
        <textarea class="igp-tall" data-f="igp_script" maxlength="5000" placeholder="把想講的話完整寫下來">${igpEsc(ep.igp_script)}</textarea>
      </div>

      <div class="igp-box">
        <div class="igp-box-head">
          <span class="igp-label">⏱ 60 秒拍攝版</span>
          <span class="igp-right">
            <span class="igp-meter${m2.over ? ' igp-over' : ''}" data-meter="igp_script_short">${m2.label}</span>
            <button class="igp-btn igp-small" data-copy="igp_script_short">複製</button>
            <button class="igp-btn igp-small igp-primary" id="igp-prompt-open">提詞器</button>
          </span>
        </div>
        <textarea class="igp-tall" data-f="igp_script_short" maxlength="3000" placeholder="濃縮到 60 秒內(約 250 字)">${igpEsc(ep.igp_script_short)}</textarea>
        <div class="igp-hint">以每分鐘 ${IGP_WPM} 字估算;建議控制在 230 字內,留結尾停頓。</div>
      </div>

      <div class="igp-box">
        <div class="igp-box-head"><span class="igp-label">📐 分段腳本</span></div>
        <ol class="igp-steps">
          ${ep.igp_segments.map((s, i) => `
            <li>
              <div>
                <input type="text" data-list="igp_segments" data-i="${i}" data-k="label" value="${igpEsc(s.label)}" placeholder="段落 / 秒數">
                <textarea data-list="igp_segments" data-i="${i}" data-k="text" placeholder="這段要講什麼、畫面是什麼">${igpEsc(s.text)}</textarea>
              </div>
              <button class="igp-x" data-del="igp_segments" data-i="${i}" aria-label="刪除">✕</button>
            </li>`).join('')}
        </ol>
        <div class="igp-box-head" style="margin:8px 0 0"><button class="igp-btn igp-small" data-add="igp_segments">＋ 段落</button></div>
      </div>

      <div class="igp-box">
        <div class="igp-box-head"><span class="igp-label">🎬 拍攝注意事項</span></div>
        ${igpChecklist('igp_shoot', ep.igp_shoot, '注意事項')}
      </div>

      <div class="igp-box">
        <div class="igp-box-head"><span class="igp-label">🤖 AI B-roll / 工具展示</span></div>
        ${igpChecklist('igp_broll', ep.igp_broll, 'B-roll')}
      </div>

      <div class="igp-box">
        <div class="igp-box-head">
          <span class="igp-label">💬 發佈文案</span>
          <span class="igp-right"><button class="igp-btn igp-small" data-copy="caption">複製文案+標籤</button></span>
        </div>
        <textarea data-f="igp_caption" maxlength="2200" placeholder="IG 貼文內文">${igpEsc(ep.igp_caption)}</textarea>
        <div class="igp-field" style="margin-top:8px">
          <label>Hashtags</label>
          <input type="text" data-f="igp_hashtags" maxlength="500" value="${igpEsc(ep.igp_hashtags)}">
        </div>
        <div class="igp-field" style="margin-top:8px">
          <label>📢 CTA 選項(一行一個)</label>
          <textarea data-f="igp_cta" style="min-height:70px">${igpEsc((ep.igp_cta || []).join('\n'))}</textarea>
        </div>
      </div>

      <div class="igp-foot">
        <button class="igp-btn igp-danger" id="igp-delete">清空這一天</button>
        <button class="igp-btn igp-primary" id="igp-done">完成</button>
      </div>
    </div>
  </div>`;
}

const igpDetail = {
  ep: null,

  open(date) {
    const existing = igpState.eps[date];
    this.ep = existing ? structuredClone(existing) : igpBlankEpisode(date);
    this.ep.igp_day = igpDayNumber(date);
    this.render();
    document.body.style.overflow = 'hidden';
  },

  render(keepScroll = false) {
    const root = document.getElementById('igp-sheet-root');
    const bg = root.querySelector('.igp-sheet-bg');
    const top = keepScroll && bg ? bg.scrollTop : 0;
    root.innerHTML = `<div class="igp-sheet-bg">${igpDetailHtml(this.ep)}</div>`;
    const nbg = root.querySelector('.igp-sheet-bg');
    nbg.scrollTop = top;
    this.bind(nbg);
    igpShowSaveState();
  },

  close() {
    document.getElementById('igp-sheet-root').innerHTML = '';
    document.body.style.overflow = '';
    this.ep = null;
    igpRender();
  },

  changed() { igpSaveEp(structuredClone(this.ep)); },

  bind(bg) {
    bg.addEventListener('click', e => { if (e.target === bg) this.close(); });
    bg.querySelector('#igp-close').onclick = () => this.close();
    bg.querySelector('#igp-done').onclick = () => this.close();
    bg.querySelector('#igp-delete').onclick = () => {
      if (!confirm('確定清空這一天的所有內容?')) return;
      igpRemoveEp(this.ep.igp_date);
      this.close();
    };
    bg.querySelector('#igp-prompt-open').onclick = () => igpPrompter.open(this.ep.igp_script_short || this.ep.igp_script);

    bg.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.f) {
        const f = el.dataset.f;
        this.ep[f] = f === 'igp_cta' ? el.value.split('\n').map(s => s.trim()).filter(Boolean) : el.value;
        const meter = bg.querySelector(`[data-meter="${f}"]`);
        if (meter) {
          const m = igpMeter(el.value);
          meter.textContent = m.label;
          meter.classList.toggle('igp-over', m.over);
        }
        this.changed();
        if (f === 'igp_style') this.render(true);
      } else if (el.dataset.list) {
        const item = this.ep[el.dataset.list][+el.dataset.i];
        if (el.dataset.k === 'done') {
          item.done = el.checked;
          this.changed();
          this.render(true);
          return;
        }
        item[el.dataset.k] = el.value;
        this.changed();
      }
    });

    bg.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      const del = e.target.closest('[data-del]');
      const copy = e.target.closest('[data-copy]');
      if (add) {
        const key = add.dataset.add;
        this.ep[key].push(key === 'igp_segments' ? { label: '', text: '' } : { text: '', done: false });
        this.changed();
        this.render(true);
        const inputs = document.querySelectorAll(`[data-list="${key}"][data-k="${key === 'igp_segments' ? 'label' : 'text'}"]`);
        inputs[inputs.length - 1]?.focus();
      } else if (del) {
        this.ep[del.dataset.del].splice(+del.dataset.i, 1);
        this.changed();
        this.render(true);
      } else if (copy) {
        const k = copy.dataset.copy;
        const text = k === 'caption' ? `${this.ep.igp_caption}\n\n${this.ep.igp_hashtags}` : this.ep[k];
        navigator.clipboard?.writeText(text).then(() => igpToast('已複製'), () => igpToast('複製失敗,請手動選取'));
      }
    });
  },
};

// 全螢幕提詞器:點畫面開始/暫停自動捲動
const igpPrompter = {
  timer: null,

  open(text) {
    if (!text.trim()) { igpToast('先寫好 60 秒拍攝版'); return; }
    const el = document.createElement('div');
    el.className = 'igp-prompter';
    el.innerHTML = `
      <div class="igp-prompter-text" id="igp-pt">${igpEsc(text)}</div>
      <div class="igp-prompter-bar">
        <button class="igp-btn igp-small igp-primary" id="igp-pt-play">▶ 開始</button>
        <label>速度 <input type="range" id="igp-pt-speed" min="10" max="120" value="40"></label>
        <label>字級 <input type="range" id="igp-pt-size" min="20" max="64" value="36"></label>
        <span style="flex:1"></span>
        <button class="igp-btn igp-small" id="igp-pt-close">關閉</button>
      </div>`;
    document.body.appendChild(el);
    const pt = el.querySelector('#igp-pt');
    const play = el.querySelector('#igp-pt-play');
    const toggle = () => {
      if (this.timer) { this.stop(); play.textContent = '▶ 開始'; return; }
      play.textContent = '⏸ 暫停';
      let last = performance.now();
      const step = now => {
        const speed = +el.querySelector('#igp-pt-speed').value; // px / 秒
        pt.scrollTop += speed * (now - last) / 1000;
        last = now;
        this.timer = requestAnimationFrame(step);
      };
      this.timer = requestAnimationFrame(step);
    };
    play.onclick = toggle;
    pt.onclick = toggle;
    el.querySelector('#igp-pt-size').oninput = e => { pt.style.fontSize = `${e.target.value}px`; };
    el.querySelector('#igp-pt-close').onclick = () => { this.stop(); el.remove(); };
  },

  stop() {
    cancelAnimationFrame(this.timer);
    this.timer = null;
  },
};
