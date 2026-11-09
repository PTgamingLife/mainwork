/* lf_ 共用:API、路由、同步頁 */
const lfState = { cats: [], tags: [], settings: {}, timer: null };

async function lfApi(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {} };
  if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
  const r = await fetch(path, o);
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) throw new Error((data && (data.detail || data.lf_error)) || ('HTTP ' + r.status));
  return data;
}
function lfEsc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function lfToast(msg, ms = 2600) {
  const t = document.getElementById('lf-toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(lfToast._t); lfToast._t = setTimeout(() => { t.hidden = true; }, ms);
}
async function lfTry(fn) { try { return await fn(); } catch (e) { lfToast('⚠ ' + e.message, 4200); } }
function lfDate(s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; }
function lfCatColor(name) { const c = lfState.cats.find(x => x.name === name); return c ? c.color : '#E9E4DA'; }
function lfCatBadge(name, ov) {
  if (!name) return '<span class="lf-mute">未分類</span>';
  return `<span class="lf-cat" style="background:${lfEsc(lfCatColor(name))}">${lfEsc(name)}</span>${ov ? '<span class="lf-ov" title="手動設定">✎</span>' : ''}`;
}
function lfTagChips(tags) { return (tags || []).map(t => `<span class="lf-chip" style="background:${lfEsc(t.color)}">${lfEsc(t.name)}</span>`).join(''); }
function lfCatOptions(sel, withAll) {
  return (withAll ? '<option value="">全部分類</option><option value="__none__">未分類</option>' : '<option value="">(未分類)</option>') +
    lfState.cats.map(c => `<option ${c.name === sel ? 'selected' : ''}>${lfEsc(c.name)}</option>`).join('');
}
async function lfLoadMeta() {
  [lfState.cats, lfState.tags, lfState.settings] = await Promise.all([
    lfApi('/api/lf_meta/categories'), lfApi('/api/lf_meta/tags'), lfApi('/api/lf_settings')]);
}

const lfPages = {};
async function lfRoute() {
  clearInterval(lfState.timer);
  const [page, arg] = (location.hash.slice(1) || 'sync').split('/');
  document.querySelectorAll('#lf-nav a').forEach(a => a.classList.toggle('lf-on', a.dataset.lfPage === page || (page === 'friend' && a.dataset.lfPage === 'friends')));
  const main = document.getElementById('lf-main');
  const fn = lfPages[page] || lfPages.sync;
  main.innerHTML = '<div class="lf-empty">載入中…</div>';
  await lfTry(() => fn(main, arg));
}
async function lfBoot() {
  await lfTry(lfLoadMeta);
  window.addEventListener('hashchange', lfRoute);
  lfRoute();
  lfPill();
  setInterval(lfPill, 5000);
}
async function lfPill() {
  try {
    const s = await lfApi('/api/lf_status'); const w = s.lf_worker; const p = document.getElementById('lf-pill');
    p.textContent = w.lf_logged_in ? 'LINE 已登入' : (w.lf_browser_open ? '等待掃碼登入' : 'LINE 未開啟');
    p.classList.toggle('lf-good', !!w.lf_logged_in);
  } catch (e) { /* 伺服器關閉時忽略 */ }
}

/* ---------- 同步頁 ---------- */
lfPages.sync = async (main) => {
  const s = lfState.settings;
  main.innerHTML = `
  <h2>同步</h2>
  <div class="lf-card"><div class="lf-stats" id="lf-stats"></div></div>
  <div class="lf-grid">
    <div class="lf-card">
      <h3>① 登入 LINE</h3>
      <p class="lf-mute">會開一個獨立的 Chrome 視窗載入 LINE 擴充,用手機 LINE 掃 QR 碼登入。登入狀態只存在本機 lf_profile/。</p>
      <div class="lf-row"><button class="lf-btn" id="lf-open">開啟 LINE 登入</button>
      <button class="lf-btn lf-ghost" id="lf-closeb">關閉視窗</button></div>
    </div>
    <div class="lf-card">
      <h3>② 更新好友清單</h3>
      <p class="lf-mute">捲動好友與聊天清單,讀取名稱、狀態消息、最後聊天時間。不會打開任何聊天室。</p>
      <div class="lf-row"><button class="lf-btn" id="lf-list">更新好友清單</button>
      <button class="lf-btn lf-ghost" id="lf-chats">只更新聊天清單</button></div>
    </div>
    <div class="lf-card">
      <h3>③ 抓訊息(每按一次一批)</h3>
      <div class="lf-row">
        <label class="lf-field">本批人數(100–200)<input id="lf-count" type="number" min="1" max="300" value="${lfEsc(s.lf_batch_size || 150)}" style="width:110px"></label>
        <label class="lf-field">每人抓幾則<input id="lf-msgs" type="number" min="1" max="50" value="${lfEsc(s.lf_msgs_per_friend || 10)}" style="width:90px"></label>
      </div>
      <p class="lf-mute">從上次停下的地方接著抓。預設略過有未讀訊息的聊天(避免對方看到已讀)。</p>
      <div class="lf-row"><button class="lf-btn" id="lf-batch">開始這一批</button>
      <button class="lf-btn lf-ghost" id="lf-pause">暫停</button></div>
    </div>
    <div class="lf-card">
      <h3>④ 分類</h3>
      <p class="lf-mute">規則分類免費、在本機跑。AI 分類只處理新的或內容有變動的好友,聊天內容會傳到 Anthropic(模型:<span id="lf-model"></span>)。</p>
      <div class="lf-row"><button class="lf-btn lf-ghost" id="lf-rules">跑規則分類</button>
        <input id="lf-ailimit" type="number" min="1" max="3000" value="50" style="width:90px">
        <button class="lf-btn" id="lf-ai">AI 分類這幾位</button></div>
      <div class="lf-mute" id="lf-aistate"></div>
    </div>
    <div class="lf-card">
      <h3>匯入聊天記錄 txt</h3>
      <p class="lf-mute">LINE 聊天室 → 設定 → 傳送聊天記錄,把 txt 存到電腦後選取(可多選)。</p>
      <input type="file" id="lf-file" accept=".txt" multiple>
    </div>
    <div class="lf-card">
      <h3>偵測頁面結構</h3>
      <p class="lf-mute">LINE 改版抓不到資料時使用:輸出目前畫面的 DOM 骨架(文字已遮蔽)到 lf_data/,用來修正 lf_selectors.json。</p>
      <button class="lf-btn lf-ghost" id="lf-probe">偵測目前畫面</button>
    </div>
  </div>
  <div class="lf-card"><h3>進度</h3><div id="lf-phase" class="lf-mute">—</div>
    <div class="lf-bar"><i id="lf-barv"></i></div><div class="lf-log" id="lf-log"></div></div>`;
  const post = (u, b) => lfTry(async () => { await lfApi(u, { method: 'POST', body: b || {} }); lfToast('已開始'); lfSyncTick(); });
  document.getElementById('lf-open').onclick = () => post('/api/lf_login');
  document.getElementById('lf-closeb').onclick = () => post('/api/lf_close');
  document.getElementById('lf-list').onclick = () => post('/api/lf_sync_list');
  document.getElementById('lf-chats').onclick = () => post('/api/lf_sync_list', { lf_part: 'chats' });
  document.getElementById('lf-batch').onclick = () => post('/api/lf_sync_batch', {
    lf_count: +document.getElementById('lf-count').value, lf_msgs: +document.getElementById('lf-msgs').value });
  document.getElementById('lf-pause').onclick = () => post('/api/lf_pause');
  document.getElementById('lf-probe').onclick = () => post('/api/lf_probe', { lf_label: 'current' });
  document.getElementById('lf-rules').onclick = () => lfTry(async () => {
    const r = await lfApi('/api/lf_rules_run', { method: 'POST' }); lfToast(`規則分類完成:${r.lf_count} 位`); lfSyncTick(); });
  document.getElementById('lf-ai').onclick = () => {
    const n = +document.getElementById('lf-ailimit').value;
    if (!confirm(`將把最多 ${n} 位好友的名稱、狀態消息與最近訊息傳到 Anthropic 做分類,會產生 API 費用。確定?`)) return;
    post('/api/lf_ai_run', { lf_limit: n });
  };
  document.getElementById('lf-file').onchange = async (ev) => {
    for (const f of ev.target.files) {
      const text = await f.text();
      await lfTry(async () => {
        const r = await lfApi('/api/lf_import', { method: 'POST', body: { lf_text: text, lf_filename: f.name } });
        lfToast(`已匯入 ${r.lf_name}:${r.lf_kept} 則`);
      });
    }
    ev.target.value = ''; lfSyncTick();
  };
  await lfSyncTick();
  lfState.timer = setInterval(() => lfSyncTick().catch(() => { /* 伺服器重啟中 */ }), 2500);
};

async function lfSyncTick() {
  const el = document.getElementById('lf-stats'); if (!el) return;
  const s = await lfApi('/api/lf_status'); const w = s.lf_worker, st = s.lf_stats, ai = s.lf_ai;
  el.innerHTML = [['好友', st.total], ['有聊天', st.chats], ['已抓訊息', st.synced], ['未分類', st.uncategorized], ['AI 已分類', st.ai_done]]
    .map(([k, v]) => `<div class="lf-stat"><b>${v}</b>${k}</div>`).join('');
  document.getElementById('lf-model').textContent = s.lf_model;
  const phase = { idle: '閒置', friends: '讀取好友清單', chats: '讀取聊天清單', messages: '抓訊息', deep: '深度抓取', rename: '改名中' }[w.lf_phase] || w.lf_phase;
  document.getElementById('lf-phase').textContent = `${phase}${w.lf_current ? ' · ' + w.lf_current : ''}${w.lf_total ? ` · ${w.lf_done}/${w.lf_total}` : ''}${w.lf_error ? ' · ⚠ ' + w.lf_error : ''}`;
  document.getElementById('lf-barv').style.width = w.lf_total ? Math.round(100 * w.lf_done / w.lf_total) + '%' : (w.lf_busy ? '15%' : '0');
  const log = document.getElementById('lf-log'); log.textContent = (w.lf_log || []).join('\n') || '(尚無紀錄)'; log.scrollTop = log.scrollHeight;
  document.getElementById('lf-aistate').textContent = ai.running ? `AI 分類中 ${ai.done}/${ai.total}` :
    (ai.total ? `上次 AI 分類:完成 ${ai.done}/${ai.total}` : '') + (ai.error ? ' · ⚠ ' + ai.error : '');
  ['lf-list', 'lf-chats', 'lf-batch', 'lf-probe'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = w.lf_busy || !w.lf_browser_open; });
  document.getElementById('lf-ai').disabled = ai.running;
}
