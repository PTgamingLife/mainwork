// ===== 28天衝刺挑戰 — 核心：狀態、登入、導覽、第1/3/4頁 =====
const App = window.App = {
  sb: null,
  cfg: null,
  me: null,          // { id, name, avatar_index }
  todayDay: 1,       // 依開始日期推算的當前挑戰天
  viewDay: 1,        // 第1頁瀏覽中的天
  tasksDay: 1,       // 第3頁正在填寫的天
};

/* ---------- 小工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
App.esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

App.toast = (msg) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(App._tt); App._tt = setTimeout(() => t.classList.remove('show'), 2200);
};
App.openModal = (html) => { $('#modalCard').innerHTML = html; $('#modalOverlay').classList.remove('hidden'); };
App.closeModal = () => $('#modalOverlay').classList.add('hidden');

App.sha256 = async (txt) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

App.dayFromDate = () => {
  const start = new Date(App.cfg.start_date + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - start) / 86400000) + 1;
  return Math.max(1, Math.min(28, diff));
};
App.dayInfo = (d) => DATA.DAYS[d - 1];

/* ---------- 背景印花 ---------- */
function paintMotifs() {
  const icons = ['🏆', '⭐', '☀️', '🌟', '🏆', '⭐', '☀️'];
  const wrap = $('#bgMotifs');
  let html = '';
  for (let i = 0; i < 22; i++) {
    const ic = icons[i % icons.length];
    const size = 22 + Math.random() * 40;
    const left = Math.random() * 100, top = Math.random() * 100;
    const dur = 6 + Math.random() * 8, delay = -Math.random() * 8;
    html += `<span style="left:${left}%;top:${top}%;font-size:${size}px;animation-duration:${dur}s;animation-delay:${delay}s">${ic}</span>`;
  }
  wrap.innerHTML = html;
}

/* ---------- Supabase ---------- */
function initDB() {
  App.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

App.db = {
  async loadConfig() {
    const { data } = await App.sb.from('sprint28_config').select('*').eq('id', 1).maybeSingle();
    App.cfg = data || { start_date: new Date().toISOString().slice(0, 10), team_name: '衝刺團隊', challenge_title: '28天衝刺挑戰' };
    return App.cfg;
  },
  async findMember(name) {
    const { data } = await App.sb.from('sprint28_members').select('*').eq('name', name).maybeSingle();
    return data;
  },
  async createMember(name, pin) {
    const avatar_index = Math.floor(Math.random() * DATA.AVATARS.length);
    const { data, error } = await App.sb.from('sprint28_members').insert({ name, pin, avatar_index }).select().single();
    if (error) throw error;
    return data;
  },
  async getDaily(memberId, day) {
    const { data } = await App.sb.from('sprint28_daily').select('*').eq('member_id', memberId).eq('day_index', day).maybeSingle();
    return data;
  },
  async saveDaily(day, care, comm) {
    const score = 5 + care.length * 1 + comm.length * 5;
    const row = {
      member_id: App.me.id, member_name: App.me.name, day_index: day,
      entry_date: new Date().toISOString().slice(0, 10),
      care_names: care, comm_names: comm, base_score: 5, score, updated_at: new Date().toISOString(),
    };
    const { error } = await App.sb.from('sprint28_daily').upsert(row, { onConflict: 'member_id,day_index' });
    if (error) throw error;
    return score;
  },
  async myEntries() {
    const { data } = await App.sb.from('sprint28_daily').select('*').eq('member_id', App.me.id).order('day_index');
    return data || [];
  },
  async dayEntries(day) {
    const { data } = await App.sb.from('sprint28_daily').select('*').eq('day_index', day).order('score', { ascending: false });
    return data || [];
  },
  async savePraise(toMember, toName, msg, day) {
    await App.sb.from('sprint28_praises').insert({ from_name: App.me.name, to_member_id: toMember, to_name: toName, message: msg, day_index: day });
  },
  async praisesFor(memberId) {
    const { data } = await App.sb.from('sprint28_praises').select('*').eq('to_member_id', memberId).order('created_at', { ascending: false }).limit(30);
    return data || [];
  },
};

/* ---------- 登入 ---------- */
async function doLogin() {
  const name = $('#loginName').value.trim();
  const pin = $('#loginPin').value.trim();
  const msg = $('#loginMsg');
  msg.textContent = '';
  if (!name) return (msg.textContent = '請輸入名字');
  if (!/^\d{4}$/.test(pin)) return (msg.textContent = 'PIN 請輸入 4 位數字');
  const btn = $('#loginBtn'); btn.disabled = true; btn.querySelector('span').textContent = '進入中…';
  try {
    let member = await App.db.findMember(name);
    if (member) {
      if (member.pin !== pin) { msg.textContent = 'PIN 錯誤，這個名字已被使用'; return; }
    } else {
      member = await App.db.createMember(name, pin);
      App.toast('帳號建立成功，歡迎加入！🎉');
    }
    App.me = member;
    localStorage.setItem('sprint28_me', JSON.stringify({ name, pin }));
    enterApp();
  } catch (e) {
    msg.textContent = '連線發生問題，請稍後再試';
    console.error(e);
  } finally {
    btn.disabled = false; btn.querySelector('span').textContent = '進入挑戰';
  }
}

function enterApp() {
  App.todayDay = App.dayFromDate();
  App.viewDay = App.todayDay;
  App.tasksDay = App.todayDay;
  $('#loginOverlay').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#teamChip').textContent = App.cfg.team_name || '團隊';
  $('#dayBadge').textContent = 'Day ' + App.todayDay;
  App.show('theme');
}

function logout() {
  localStorage.removeItem('sprint28_me');
  App.me = null;
  $('#app').classList.add('hidden');
  $('#loginOverlay').classList.remove('hidden');
  $('#loginPin').value = '';
}

/* ---------- 導覽 ---------- */
App.show = (page) => {
  $$('.page').forEach((p) => p.classList.add('hidden'));
  $('#page-' + page).classList.remove('hidden');
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.page === page));
  if (page === 'theme') renderTheme();
  if (page === 'hearts') App.renderHearts();
  if (page === 'tasks') renderTasks();
  if (page === 'lists') renderLists();
  if (page === 'coach') App.renderCoach();
};

/* ---------- 第1頁：每日主題 ---------- */
function renderTheme() {
  const d = App.dayInfo(App.viewDay);
  const pct = Math.round((App.viewDay / 28) * 100);
  const isToday = App.viewDay === App.todayDay;
  $('#page-theme').innerHTML = `
    <div class="day-nav">
      <button class="btn btn-ghost btn-sm" id="dPrev" ${App.viewDay <= 1 ? 'disabled' : ''}>‹ 前一天</button>
      <span style="font-weight:800;color:var(--blue-700)">第 ${App.viewDay} / 28 天</span>
      <button class="btn btn-ghost btn-sm" id="dNext" ${App.viewDay >= 28 ? 'disabled' : ''}>後一天 ›</button>
    </div>
    <div class="theme-hero">
      <div class="theme-week">第${weekNo(d)}週・${App.esc(d.week.title)}</div>
      <div class="theme-dayno">Day ${d.day} <span style="font-size:18px">（${d.weekday}）</span>${isToday ? ' 🔥今天' : ''}</div>
      <div class="theme-goal">🎯 本週目標：${App.esc(d.week.goal)}</div>
      <div class="day-progress"><i style="width:${pct}%"></i></div>
    </div>
    <div class="card">
      <p class="card-title">📝 今日任務</p>
      <p class="theme-task">${App.esc(d.task)}</p>
    </div>
    <div class="card">
      <p class="card-title">🔥 寶哥的能量鼓勵</p>
      <p class="theme-cheer">${App.esc(d.cheer)}</p>
    </div>
    <button class="btn btn-gold btn-block" id="goTaskBtn"><span>✍️ 去登記今天的行動分數</span></button>`;
  $('#dPrev').onclick = () => { App.viewDay--; renderTheme(); };
  $('#dNext').onclick = () => { App.viewDay++; renderTheme(); };
  $('#goTaskBtn').onclick = () => { App.tasksDay = App.todayDay; App.show('tasks'); };
}
const weekNo = (d) => DATA.WEEKS.findIndex((w) => d.day >= w.range[0] && d.day <= w.range[1]) + 1;

/* ---------- 第3頁：每日任務計分 ---------- */
let careNames = [], commNames = [];
async function renderTasks() {
  const day = App.tasksDay;
  const existing = await App.db.getDaily(App.me.id, day);
  careNames = existing ? [...existing.care_names] : [];
  commNames = existing ? [...existing.comm_names] : [];
  const di = App.dayInfo(day);
  $('#page-tasks').innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,var(--blue-50),#fff)">
      <div class="day-nav">
        <button class="btn btn-ghost btn-sm" id="tPrev" ${day <= 1 ? 'disabled' : ''}>‹</button>
        <span style="font-weight:900;color:var(--blue-900)">Day ${day} 行動登記</span>
        <button class="btn btn-ghost btn-sm" id="tNext" ${day >= App.todayDay ? 'disabled' : ''}>›</button>
      </div>
      <p class="empty-tip" style="text-align:center">${App.esc(di.task)}</p>
      <div class="score-big" id="scoreBig">5<small> 分</small></div>
      <div class="score-break" id="scoreBreak"></div>
    </div>
    <div class="card">
      <p class="card-title">💗 今天關心的人（每位 +1 分）</p>
      <div class="name-input-row">
        <input id="careInput" placeholder="輸入名字後按新增" maxlength="20" />
        <button class="btn btn-primary btn-sm" id="careAdd"><span>新增</span></button>
      </div>
      <div class="tag-row" id="careTags"></div>
    </div>
    <div class="card">
      <p class="card-title">🤝 溝通事業價值的新人（每位 +5 分）</p>
      <div class="name-input-row">
        <input id="commInput" placeholder="輸入新人名字後按新增" maxlength="20" />
        <button class="btn btn-gold btn-sm" id="commAdd"><span>新增</span></button>
      </div>
      <div class="tag-row" id="commTags"></div>
    </div>
    <button class="btn btn-primary btn-block" id="saveTasks"><span>💾 儲存今日成果</span></button>`;

  $('#tPrev').onclick = () => { App.tasksDay--; renderTasks(); };
  $('#tNext').onclick = () => { App.tasksDay++; renderTasks(); };
  const addCare = () => { const v = $('#careInput').value.trim(); if (v) { careNames.push(v); $('#careInput').value = ''; } drawTags(); };
  const addComm = () => { const v = $('#commInput').value.trim(); if (v) { commNames.push(v); $('#commInput').value = ''; } drawTags(); };
  $('#careAdd').onclick = addCare;
  $('#commAdd').onclick = addComm;
  $('#careInput').onkeydown = (e) => { if (e.key === 'Enter') addCare(); };
  $('#commInput').onkeydown = (e) => { if (e.key === 'Enter') addComm(); };
  $('#saveTasks').onclick = saveTasks;
  drawTags();
}

function drawTags() {
  const score = 5 + careNames.length + commNames.length * 5;
  $('#scoreBig').innerHTML = `${score}<small> 分</small>`;
  $('#scoreBreak').innerHTML =
    `<span class="score-pill">基礎 5</span><span class="score-pill">關心 ${careNames.length}×1</span><span class="score-pill">溝通 ${commNames.length}×5</span>`;
  $('#careTags').innerHTML = careNames.length
    ? careNames.map((n, i) => `<span class="tag">${App.esc(n)}<span class="x" data-t="care" data-i="${i}">✕</span></span>`).join('')
    : '<span class="empty-tip">還沒有關心的人，加上來吧！</span>';
  $('#commTags').innerHTML = commNames.length
    ? commNames.map((n, i) => `<span class="tag tag-gold">${App.esc(n)}<span class="x" data-t="comm" data-i="${i}">✕</span></span>`).join('')
    : '<span class="empty-tip">還沒有溝通的新人，加油！</span>';
  $$('.tag .x').forEach((x) => x.onclick = () => {
    const i = +x.dataset.i;
    if (x.dataset.t === 'care') careNames.splice(i, 1); else commNames.splice(i, 1);
    drawTags();
  });
}

async function saveTasks() {
  const btn = $('#saveTasks'); btn.disabled = true;
  try {
    const score = await App.db.saveDaily(App.tasksDay, careNames, commNames);
    App.toast(`已儲存！今日 ${score} 分 🌟`);
  } catch (e) { App.toast('儲存失敗，請重試'); console.error(e); }
  finally { btn.disabled = false; }
}

/* ---------- 第4頁：名單彙整 ---------- */
let listsMode = 'care';
async function renderLists() {
  const entries = await App.db.myEntries();
  const agg = { care: new Map(), comm: new Map() };
  entries.forEach((e) => {
    (e.care_names || []).forEach((n) => mark(agg.care, n, e.day_index));
    (e.comm_names || []).forEach((n) => mark(agg.comm, n, e.day_index));
  });
  const total = entries.reduce((s, e) => s + e.score, 0);
  const render = () => {
    const map = agg[listsMode];
    const arr = [...map.entries()].sort((a, b) => b[1].length - a[1].length);
    $('#listBody').innerHTML = arr.length
      ? arr.map(([name, days]) => `
        <div class="list-row">
          <div><div class="list-name">${listsMode === 'comm' ? '🤝 ' : '💗 '}${App.esc(name)}</div>
          <div class="list-meta">出現在 Day ${days.join('、')}</div></div>
          <span class="count-bubble">${days.length} 次</span>
        </div>`).join('')
      : '<p class="empty-tip" style="text-align:center;padding:30px">這個名單還是空的，去第三頁登記吧！</p>';
    $$('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === listsMode));
  };
  $('#page-lists').innerHTML = `
    <div class="stat-grid">
      <div class="stat"><b>${total}</b><span>累積總分</span></div>
      <div class="stat"><b>${agg.care.size}</b><span>關心過的人</span></div>
      <div class="stat"><b>${agg.comm.size}</b><span>溝通過的新人</span></div>
    </div>
    <div class="seg">
      <button data-m="care" class="on">💗 已關心名單</button>
      <button data-m="comm">🤝 已溝通名單</button>
    </div>
    <div class="card" id="listBody"></div>`;
  $$('.seg button').forEach((b) => b.onclick = () => { listsMode = b.dataset.m; render(); });
  render();
}
function mark(map, name, day) {
  if (!map.has(name)) map.set(name, []);
  const a = map.get(name); if (!a.includes(day)) a.push(day);
}

/* ---------- 啟動 ---------- */
async function boot() {
  paintMotifs();
  initDB();
  await App.db.loadConfig();
  $('#loginTeamName').textContent = (App.cfg.team_name || '業務團隊') + '・20 位顧客';

  $('#loginBtn').onclick = doLogin;
  $('#loginPin').onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
  $('#logoutBtn').onclick = logout;
  $('#adminGear').onclick = () => App.openAdmin();
  $('#openAdminFromLogin').onclick = () => App.openAdmin();
  $('#modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') App.closeModal(); };
  $$('.tab').forEach((t) => t.onclick = () => App.show(t.dataset.page));

  // 自動登入
  const saved = JSON.parse(localStorage.getItem('sprint28_me') || 'null');
  if (saved) {
    const m = await App.db.findMember(saved.name);
    if (m && m.pin === saved.pin) { App.me = m; enterApp(); }
  }
}
document.addEventListener('DOMContentLoaded', boot);
