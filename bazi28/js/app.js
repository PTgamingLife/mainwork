// ════════════════════════════════════════════════════════
//  28天品牌故事挑戰 — 核心應用邏輯
// ════════════════════════════════════════════════════════

const App = window.App = {
  sb:       null,
  cfg:      null,   // { start_date, team_name, expected_members }
  me:       null,   // { id, name, pin, avatar_index, bazi_profile }
  bazi:     null,   // { pillars, profile, masterType, formatted }
  todayDay: 1,
  currentPage: 'task',
};

/* ── Tiny helpers ── */
const $  = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];
App.esc = (t) => String(t??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

App.toast = (msg, dur=2400) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(App._tt);
  App._tt = setTimeout(() => t.classList.remove('show'), dur);
};

App.openModal = (html) => {
  $('#modalCard').innerHTML = html;
  $('#modalOverlay').classList.remove('hidden');
};
App.closeModal = () => $('#modalOverlay').classList.add('hidden');

/* ── Simple markdown-ish renderer ── */
App.renderPrompt = (text) => {
  let html = App.esc(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^•\s/gm, '<li>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  return `<div class="rendered-prompt"><p>${html}</p></div>`;
};

/* ── Quadrant colour helper ── */
App.qColor = (id) => ['#C0392B','#8E44AD','#27AE60','#2980B9','#E67E22'][id] || '#C9A84C';

/* ── Day calculation ── */
App.dayFromDate = () => {
  const start = new Date(App.cfg.start_date + 'T00:00:00');
  const now   = new Date(); now.setHours(0,0,0,0);
  const diff  = Math.floor((now - start) / 86400000) + 1;
  return Math.max(1, Math.min(28, diff));
};

/* ── SHA-256 (for PIN hashing — optional, kept simple) ── */
App.sha256 = async (txt) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
};

/* ════════════════════════════════════════
   Background floating icons
════════════════════════════════════════ */
function paintMotifs() {
  const icons = ['🌍','💰','👥','🏆','📚','🌍','💰','👥','🏆','📚','✨','💎','🔥'];
  const wrap = $('#bgMotifs'); let html = '';
  for (let i = 0; i < 28; i++) {
    const ic  = icons[i % icons.length];
    const sz  = 24 + Math.random() * 44;
    const lft = Math.random() * 100, top = Math.random() * 100;
    const dur = 7 + Math.random() * 9, del = -Math.random() * 9;
    html += `<span style="left:${lft}%;top:${top}%;font-size:${sz}px;animation-duration:${dur}s;animation-delay:${del}s">${ic}</span>`;
  }
  wrap.innerHTML = html;
}

/* ════════════════════════════════════════
   Supabase DB layer
════════════════════════════════════════ */
function initDB() {
  App.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

App.db = {
  async loadConfig() {
    const { data } = await App.sb.from('bazi28_config').select('*').eq('id',1).maybeSingle();
    App.cfg = data || { start_date: new Date().toISOString().slice(0,10), team_name:'28天品牌故事', expected_members:10 };
  },
  async findMember(name) {
    const { data } = await App.sb.from('bazi28_members').select('*').eq('name',name).maybeSingle();
    return data;
  },
  async createMember(name, pin, birthYear, birthMonth, birthDay, birthHour, avatarIdx, baziProfile) {
    const { data, error } = await App.sb.from('bazi28_members').insert({
      name, pin, birth_year:birthYear, birth_month:birthMonth, birth_day:birthDay,
      birth_hour:birthHour, avatar_index:avatarIdx, bazi_profile:baziProfile,
    }).select().single();
    if (error) throw error;
    return data;
  },
  async getMyTask(day) {
    const { data } = await App.sb.from('bazi28_tasks').select('*').eq('member_id',App.me.id).eq('day_index',day).maybeSingle();
    return data;
  },
  async saveTask(day, response) {
    const { error } = await App.sb.from('bazi28_tasks').upsert({
      member_id:App.me.id, member_name:App.me.name, day_index:day,
      response, completed_at:new Date().toISOString(),
    }, { onConflict:'member_id,day_index' });
    if (error) throw error;
  },
  async myTasks() {
    const { data } = await App.sb.from('bazi28_tasks').select('*').eq('member_id',App.me.id);
    return data || [];
  },
  async todayDoneMembers(day) {
    const { data } = await App.sb.from('bazi28_tasks').select('member_id,member_name,response').eq('day_index',day).neq('response','');
    return data || [];
  },
  async memberProfile(memberId) {
    const { data } = await App.sb.from('bazi28_members').select('id,name,avatar_index').eq('id',memberId).maybeSingle();
    return data;
  },
  async allMembersScores() {
    const { data } = await App.sb.from('bazi28_tasks').select('member_id,member_name').neq('response','');
    if (!data) return [];
    const map = {};
    data.forEach(r => {
      if (!map[r.member_id]) map[r.member_id] = { member_name:r.member_name, count:0 };
      map[r.member_id].count++;
    });
    return Object.entries(map).map(([id,v]) => ({ id, name:v.member_name, days:v.count }))
                              .sort((a,b) => b.days - a.days);
  },
  async allMembers() {
    const { data } = await App.sb.from('bazi28_members').select('id,name,avatar_index').order('created_at');
    return data || [];
  },
  async givePraise(toId, toName, dayIndex, emoji) {
    const { error } = await App.sb.from('bazi28_praises').insert({
      from_id:App.me.id, from_name:App.me.name,
      to_id:toId, to_name:toName, day_index:dayIndex, emoji,
    });
    if (error) throw error;
  },
  async praisesForTask(toId, dayIndex) {
    const { data } = await App.sb.from('bazi28_praises').select('*').eq('to_id',toId).eq('day_index',dayIndex);
    return data || [];
  },
};

/* ════════════════════════════════════════
   Auth Flow
════════════════════════════════════════ */
async function handleCheckName() {
  const name = $('#loginName').value.trim();
  const msg  = $('#loginMsg');
  msg.textContent = '';
  if (!name) return (msg.textContent = '請輸入你的名字');
  const btn = $('#checkNameBtn');
  btn.disabled = true; $('span',btn).textContent = '查詢中…';
  try {
    const member = await App.db.findMember(name);
    if (member) {
      // Returning user → show PIN step
      $('#stepName').classList.add('hidden');
      $('#stepPin').classList.remove('hidden');
    } else {
      // New user → show register form
      $('#stepName').classList.add('hidden');
      $('#stepRegister').classList.remove('hidden');
    }
  } catch(e) {
    msg.textContent = '連線失敗，請稍後重試';
  } finally {
    btn.disabled = false; $('span',btn).textContent = '開始 →';
  }
}

async function handlePinLogin() {
  const name = $('#loginName').value.trim();
  const pin  = $('#loginPin').value.trim();
  const msg  = $('#loginMsg');
  msg.textContent = '';
  if (!/^\d{4}$/.test(pin)) return (msg.textContent = 'PIN 請輸入4位數字');
  const btn = $('#pinLoginBtn');
  btn.disabled = true; $('span',btn).textContent = '驗證中…';
  try {
    const member = await App.db.findMember(name);
    if (!member || member.pin !== pin) return (msg.textContent = 'PIN 錯誤，請再試一次');
    App.me = member;
    restoreBazi();
    localStorage.setItem('bazi28_me', JSON.stringify({ name, pin }));
    enterApp();
  } catch(e) {
    msg.textContent = '連線失敗，請稍後重試';
  } finally {
    btn.disabled = false; $('span',btn).textContent = '進入 →';
  }
}

async function handleRegister() {
  const name  = $('#loginName').value.trim();
  const year  = parseInt($('#regYear').value);
  const month = parseInt($('#regMonth').value);
  const day   = parseInt($('#regDay').value);
  const hour  = parseInt($('#regHour').value);
  const pin   = $('#regPin').value.trim();
  const msg   = $('#loginMsg');
  msg.textContent = '';

  if (!year || year<1940 || year>2010) return (msg.textContent = '請輸入有效的出生年份（1940-2010）');
  if (!month) return (msg.textContent = '請選擇出生月份');
  if (!day   || day<1 || day>31)  return (msg.textContent = '請輸入有效的出生日期');
  if (!/^\d{4}$/.test(pin))       return (msg.textContent = 'PIN 請設定4位數字');

  const btn = $('#registerBtn');
  btn.disabled = true; $('span',btn).textContent = '計算中 ✨';
  try {
    // Calculate BaZi
    const result = BAZI.calculate(year, month, day, hour);
    App.bazi = result;

    const avatarIdx = Math.floor(Math.random() * DATA28.AVATARS.length);
    const baziProfile = { percents: result.profile.percents, selfElem: result.profile.selfElem, formatted: result.formatted };

    const member = await App.db.createMember(name, pin, year, month, day, hour, avatarIdx, baziProfile);
    App.me = member;
    localStorage.setItem('bazi28_me', JSON.stringify({ name, pin }));

    // Show profile reveal
    $('#loginOverlay').classList.add('hidden');
    showProfileReveal(result, member);
  } catch(e) {
    msg.textContent = '名字已被使用或連線失敗，請換一個名字';
    console.error(e);
  } finally {
    btn.disabled = false; $('span',btn).textContent = '計算我的能量 ✨';
  }
}

function restoreBazi() {
  if (!App.me?.bazi_profile) return;
  const p = App.me.bazi_profile;
  // Reconstruct minimal bazi object from stored profile
  App.bazi = {
    profile: { percents: p.percents, selfElem: p.selfElem },
    masterType: BAZI.getDayMasterType(p.selfElem),
    formatted: p.formatted,
  };
}

function logout() {
  localStorage.removeItem('bazi28_me');
  App.me = null; App.bazi = null;
  $('#app').classList.add('hidden');
  // Reset login form
  ['stepPin','stepRegister'].forEach(id => $('#'+id).classList.add('hidden'));
  $('#stepName').classList.remove('hidden');
  $('#loginName').value = ''; $('#loginPin').value = ''; $('#loginMsg').textContent = '';
  $('#loginOverlay').classList.remove('hidden');
}

/* ════════════════════════════════════════
   Profile Reveal Animation
════════════════════════════════════════ */
function showProfileReveal(bazi, member) {
  const { profile, masterType, formatted } = bazi;
  const overlay = $('#profileRevealOverlay');
  overlay.classList.remove('hidden');

  $('#revealMasterIcon').textContent = masterType.icon;
  $('#revealMasterName').textContent = masterType.name + ' · ' + masterType.elem + '日主';
  $('#revealMasterName').style.color  = masterType.color;
  $('#revealMasterDesc').textContent  = masterType.desc;

  // Four pillars
  const pLabels = ['年柱','月柱','日柱','時柱'];
  const pVals   = [formatted.year, formatted.month, formatted.day, formatted.hour];
  $('#revealPillars').innerHTML = pLabels.map((l,i) =>
    `<div class="pillar-box" style="box-shadow:3px 3px 0 ${masterType.color}">
       ${App.esc(pVals[i])}<small>${l}</small>
     </div>`
  ).join('');

  // Radar SVG
  const colors = DATA28.QUADRANTS.map(q => q.color);
  $('#revealRadar').innerHTML = BAZI.buildRadarSVG(profile.percents, colors);

  // Energy bars (animate after short delay)
  const barsEl = $('#revealBars');
  barsEl.innerHTML = DATA28.QUADRANTS.map((q, i) => {
    const pct = profile.percents[i];
    const lbl = DATA28.energyLabel(pct);
    return `<div class="qbar-row">
      <span class="qbar-icon">${q.icon}</span>
      <div class="qbar-info">
        <div class="qbar-name">${q.name} <span class="qbar-tag ${lbl.cls}">${lbl.text}</span></div>
        <div class="qbar-track">
          <div class="qbar-fill" id="bar${i}" style="width:0%;--bar-color:${q.color}"></div>
        </div>
      </div>
      <div class="qbar-pct">${pct}%</div>
    </div>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    DATA28.QUADRANTS.forEach((_,i) => {
      const el = $(`#bar${i}`);
      if (el) el.style.width = profile.percents[i] + '%';
    });
  }, 200);

  $('#startJourneyBtn').onclick = () => {
    overlay.classList.add('hidden');
    enterApp();
  };
}

/* ════════════════════════════════════════
   Enter Main App
════════════════════════════════════════ */
function enterApp() {
  App.todayDay = App.dayFromDate();
  $('#loginOverlay').classList.add('hidden');
  $('#profileRevealOverlay').classList.add('hidden');
  const topAvatar = $('#topAvatar');
  topAvatar.textContent = DATA28.AVATARS[App.me.avatar_index || 0];
  $('#topName').textContent  = App.me.name;
  $('#topTeam').textContent  = App.cfg.team_name || '品牌故事';
  $('#dayBadge').textContent = `Day ${App.todayDay}`;
  $('#app').classList.remove('hidden');
  showPage('task');
}

/* ════════════════════════════════════════
   Navigation
════════════════════════════════════════ */
function showPage(page) {
  App.currentPage = page;
  $$('.page').forEach(p => p.classList.add('hidden'));
  $(`#page-${page}`).classList.remove('hidden');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));

  if (page === 'task')   renderTaskPage();
  if (page === 'record') renderRecordPage();
  if (page === 'social') renderSocialPage();
  if (page === 'team')   renderTeamPage();
}

/* ════════════════════════════════════════
   任務頁 (Task Page)
════════════════════════════════════════ */
async function renderTaskPage() {
  const pg = $('#page-task');
  pg.innerHTML = '<div class="empty-tip"><span class="spinning">⏳</span> 載入任務中…</div>';

  const task     = DATA28.getTask(App.todayDay);
  const existing = await App.db.getMyTask(App.todayDay);
  const ctx      = App.bazi ? DATA28.getPersonalizedContext(task, App.bazi.profile.percents) : null;

  // Determine accent colours
  let accentColor = '#C9A84C', accentIcon = task.icon;
  if (task.type === 'quadrant') {
    accentColor = DATA28.QUADRANTS[task.quadrantId].color;
  }

  const doneCount = (await App.db.myTasks()).filter(t => t.response).length;
  const pct = Math.round(doneCount / 28 * 100);

  pg.innerHTML = `
    <!-- Hero card -->
    <div class="card-hero">
      <div class="speed-lines"></div>
      <div class="task-day-header">
        <span class="task-day-no">Day ${App.todayDay} / 28</span>
        ${task.type === 'quadrant' ? `<span class="task-quadrant-chip" style="background:${accentColor}">${DATA28.QUADRANTS[task.quadrantId].name}</span>` : ''}
        ${task.type === 'warmup'   ? `<span class="task-quadrant-chip" style="background:#C9A84C;color:#1A0F00">暖身</span>` : ''}
        ${task.type === 'summary'  ? `<span class="task-quadrant-chip" style="background:#8B6B1A">大總結</span>` : ''}
        ${task.type === 'brand'    ? `<span class="task-quadrant-chip" style="background:linear-gradient(135deg,#C0392B,#8E44AD)">品牌故事</span>` : ''}
      </div>
      ${task.type === 'quadrant' ? `<div class="task-quadrant-label">${task.icon} ${DATA28.QUADRANTS[task.quadrantId].subtitle}</div>` : ''}
      <div class="task-title">${App.esc(task.title)}</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-label">${doneCount} / 28 天完成 · ${pct}%</div>
      ${ctx ? `<div class="task-context-box">${App.esc(ctx)}</div>` : ''}
    </div>

    <!-- Prompt card -->
    <div class="card" id="promptCard">
      <div class="card-title">${task.icon} 今日任務</div>
      ${App.renderPrompt(task.prompt)}
    </div>

    <!-- Response area -->
    <div class="card">
      <div class="card-title">✍️ 寫下你的故事</div>
      ${existing?.response ? `<div class="task-already-done">✅ 今天已完成！你可以繼續編輯。</div>` : ''}
      <div class="task-textarea-wrap" style="margin-top:10px">
        <textarea class="task-textarea" id="taskResponse" placeholder="在這裡寫下你的故事……不需要完美，只需要真實。">${App.esc(existing?.response || '')}</textarea>
        <span class="word-count" id="wordCount">0 字</span>
      </div>
      <button class="btn btn-gold btn-block" id="saveTaskBtn" style="margin-top:12px">
        <span>${existing?.response ? '更新故事 ✨' : '提交今日故事 ✨'}</span>
      </button>
    </div>
  `;

  // Word count
  const ta = $('#taskResponse'), wc = $('#wordCount');
  const updateWC = () => {
    const n = ta.value.replace(/\s/g,'').length;
    wc.textContent = n + ' 字';
    wc.classList.toggle('over', n > 1200);
  };
  ta.addEventListener('input', updateWC);
  updateWC();

  // Save
  $('#saveTaskBtn').onclick = async () => {
    const text = $('#taskResponse').value.trim();
    if (text.length < 20) return App.toast('請寫多一點（至少20字）😊');
    const btn = $('#saveTaskBtn'); btn.disabled = true;
    $('span',btn).textContent = '儲存中…';
    try {
      await App.db.saveTask(App.todayDay, text);
      App.toast('故事已記錄！🌟');
      launchConfetti();
      $('span',btn).textContent = '更新故事 ✨';
      // Re-render to show "done" badge
      await renderTaskPage();
    } catch(e) {
      App.toast('儲存失敗，請重試');
      btn.disabled = false; $('span',btn).textContent = '提交今日故事 ✨';
    }
  };
}

/* ════════════════════════════════════════
   記錄頁 (Record Page)
════════════════════════════════════════ */
async function renderRecordPage() {
  const pg = $('#page-record');
  pg.innerHTML = '<div class="empty-tip"><span class="spinning">⏳</span> 載入記錄中…</div>';

  const tasks = await App.db.myTasks();
  const doneMap = {};
  tasks.forEach(t => { if (t.response) doneMap[t.day_index] = t; });

  const cells = Array.from({length:28}, (_,i) => {
    const d = i+1;
    const task = DATA28.getTask(d);
    const done = doneMap[d];
    const isToday = d === App.todayDay;
    const isFuture = d > App.todayDay;
    const cls = done ? 'done' : isToday ? 'today' : isFuture ? 'future' : '';
    const bg  = done && task.quadrantId != null ? App.qColor(task.quadrantId) : '';
    const excerpt = done ? done.response.slice(0,40) + '…' : '';
    return `<div class="record-cell ${cls}" data-day="${d}"
              ${bg ? `style="background:${bg};border-color:${bg}"` : ''}>
      <div class="record-cell-day">Day ${d}</div>
      <div class="record-cell-icon">${task.icon}</div>
      ${done ? `<div class="record-cell-excerpt">${App.esc(excerpt)}</div>` : ''}
    </div>`;
  }).join('');

  pg.innerHTML = `
    <div class="card">
      <div class="card-title">📜 我的28天記錄</div>
      <div class="record-grid">${cells}</div>
    </div>
    <div id="recordDetail"></div>
  `;

  $$('.record-cell:not(.future)', pg).forEach(cell => {
    cell.addEventListener('click', () => showRecordDetail(+cell.dataset.day, doneMap, pg));
  });
}

function showRecordDetail(day, doneMap, pg) {
  const task = DATA28.getTask(day);
  const done = doneMap[day];
  const det  = $('#recordDetail', pg);
  if (!det) return;

  if (!done) {
    const isToday = day === App.todayDay;
    det.innerHTML = `<div class="card"><div class="card-title">Day ${day} · ${task.title}</div>
      ${isToday ? '<p class="text-muted" style="font-size:14px">今天的任務還未完成，去任務頁寫下你的故事吧！</p>' : '<p class="text-muted" style="font-size:14px">這一天還沒有記錄。</p>'}
    </div>`;
    return;
  }

  const q = task.quadrantId != null ? DATA28.QUADRANTS[task.quadrantId] : null;
  const accentColor = q ? q.color : '#C9A84C';
  const date = new Date(done.completed_at).toLocaleDateString('zh-TW');

  det.innerHTML = `
    <div class="record-detail-card" style="border-color:${accentColor};box-shadow:3px 3px 0 ${accentColor}">
      <div class="record-detail-header">
        <div class="record-detail-icon">${task.icon}</div>
        <div>
          <div class="record-detail-title">Day ${day} · ${App.esc(task.title)}</div>
          <div class="record-detail-day">完成於 ${date} ${q?`· ${q.name}`:''}</div>
        </div>
      </div>
      <div class="record-detail-text">${App.esc(done.response)}</div>
    </div>
  `;
  det.scrollIntoView({ behavior:'smooth' });
}

/* ════════════════════════════════════════
   社交書架頁 (Social Page)
════════════════════════════════════════ */
async function renderSocialPage() {
  const pg = $('#page-social');
  pg.innerHTML = '<div class="empty-tip"><span class="spinning">⏳</span> 載入書架中…</div>';

  const day     = App.todayDay;
  const members = await App.db.todayDoneMembers(day);
  const allMem  = await App.db.allMembers();
  const task    = DATA28.getTask(day);

  // Avatar row: all members, highlight done ones
  const doneIds = new Set(members.map(m => m.member_id));
  const avatarHtml = allMem.map(m => {
    const av  = DATA28.AVATARS[m.avatar_index || 0];
    const cls = doneIds.has(m.id) ? 'c-avatar done-av' : 'c-avatar';
    const sty = doneIds.has(m.id) ? 'border-color:#27AE60;box-shadow:0 0 0 2px rgba(39,174,96,.3),2px 2px 0 #1E7A44' : 'opacity:0.45';
    return `<div class="${cls}" title="${App.esc(m.name)}" style="${sty}">${av}</div>`;
  }).join('');

  const bookHtml = members.length === 0
    ? `<div class="empty-tip">今天還沒有夥伴完成任務，成為第一個吧！📖</div>`
    : `<div class="bookshelf">${members.map(m => buildBookCard(m, task, allMem)).join('')}</div>`;

  pg.innerHTML = `
    <div class="card">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>今日完成的夥伴</span>
        <span style="font-size:13px;font-weight:700;color:var(--gold-deep)">${doneIds.size} / ${allMem.length}</span>
      </div>
      <div class="completed-avatars">${avatarHtml}</div>
    </div>
    <div class="card">
      <div class="card-title">📚 今日書架 · Day ${day} · ${App.esc(task.title)}</div>
      ${bookHtml}
    </div>
  `;

  // Attach click handlers to books
  $$('[data-book-id]', pg).forEach(el => {
    el.addEventListener('click', () => {
      const memberId   = el.dataset.bookId;
      const memberName = el.dataset.bookName;
      const response   = el.dataset.bookResponse;
      openBookModal(memberId, memberName, response, day, task, allMem);
    });
  });
}

function buildBookCard(member, task, allMem) {
  const q  = task.quadrantId != null ? DATA28.QUADRANTS[task.quadrantId] : null;
  const bg = q ? q.color : '#1A0F00';
  const memberInfo = allMem.find(m => m.id === member.member_id);
  const av  = memberInfo ? DATA28.AVATARS[memberInfo.avatar_index || 0] : '📖';
  const day = App.todayDay;

  // Safe encode the response for data attribute
  const responseEncoded = encodeURIComponent(member.response || '');

  return `<div class="book" data-book-id="${member.member_id}"
               data-book-name="${App.esc(member.member_name)}"
               data-book-response="${responseEncoded}">
    <div class="book-cover" style="background:${bg}">
      <div class="book-spine"></div>
      <div class="book-pattern"></div>
      <div class="book-icon">${av}</div>
      <div>
        <div class="book-name">${App.esc(member.member_name)}</div>
        <div class="book-day">Day ${day}</div>
        <div class="book-stars">⭐⭐⭐⭐⭐</div>
      </div>
    </div>
  </div>`;
}

async function openBookModal(memberId, memberName, responseEncoded, day, task, allMem) {
  const response = decodeURIComponent(responseEncoded);
  const q  = task.quadrantId != null ? DATA28.QUADRANTS[task.quadrantId] : null;
  const bg = q ? q.color : '#1A0F00';
  const memberInfo = allMem.find(m => m.id === memberId);
  const av = memberInfo ? DATA28.AVATARS[memberInfo.avatar_index || 0] : '📖';

  const praises = await App.db.praisesForTask(memberId, day);
  const myPraise = praises.find(p => p.from_id === App.me.id);

  const praiseEmojis = ['👏','🔥','💎','✨','🌟','💪','🙏','❤️'];

  App.openModal(`
    <div class="book-modal" style="padding:0;max-height:none">
      <div class="book-modal-header" style="background:${bg}">
        <div class="book-modal-avatar">${av}</div>
        <div class="book-modal-name">${App.esc(memberName)}</div>
        <div class="book-modal-meta">Day ${day} · ${task.icon} ${App.esc(task.title)}</div>
      </div>
      <div class="book-modal-body">
        <div class="book-modal-task-name">${task.icon} ${App.esc(task.title)}</div>
        <div class="book-modal-text">${App.esc(response)}</div>
      </div>
      <div class="praise-section">
        <div class="praise-count">收到 ${praises.length} 個鼓勵 ${praises.map(p=>p.emoji).join('')}</div>
        ${memberId !== App.me.id ? `
          <div style="font-size:13px;font-weight:700;color:var(--ink-mid);margin-bottom:4px">給予鼓勵：</div>
          <div class="praise-btn-row">
            ${praiseEmojis.map(e => `<button class="praise-btn ${myPraise?.emoji===e?'sent':''}" data-emoji="${e}">${e}</button>`).join('')}
          </div>` : '<div style="font-size:13px;color:var(--ink-light)">這是你自己的故事 ❤️</div>'}
        <button class="btn btn-outline btn-block btn-sm" onclick="App.closeModal()">關閉</button>
      </div>
    </div>
  `);

  $$('.praise-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emoji = btn.dataset.emoji;
      try {
        await App.db.givePraise(memberId, memberName, day, emoji);
        $$('.praise-btn').forEach(b => { b.classList.remove('sent'); b.disabled = true; });
        btn.classList.add('sent');
        App.toast(`已送出 ${emoji} 鼓勵給 ${memberName}！`);
      } catch(e) {
        App.toast('鼓勵發送失敗');
      }
    });
  });
}

/* ════════════════════════════════════════
   積分頁 (Team Page)
════════════════════════════════════════ */
async function renderTeamPage() {
  const pg = $('#page-team');
  pg.innerHTML = '<div class="empty-tip"><span class="spinning">⏳</span> 計算積分中…</div>';

  const [scores, allMem, todayDone] = await Promise.all([
    App.db.allMembersScores(),
    App.db.allMembers(),
    App.db.todayDoneMembers(App.todayDay),
  ]);

  const totalDays = allMem.length > 0
    ? scores.reduce((s,r) => s+r.days, 0)
    : 0;

  const doneToday = todayDone.filter(t => t.response).length;
  const total     = allMem.length;
  const allDone   = doneToday >= total && total > 0;

  // Team score = days where all completed (simplified: use today's status)
  // Accumulated team score = sum of completed days across all members
  const teamScore = totalDays;

  pg.innerHTML = `
    <div class="team-score-big">
      <div class="team-score-label">團隊累計能量點</div>
      <div class="team-score-number">${teamScore}</div>
      <div class="team-score-sub">全員完成任務即得當日積分 🏆</div>
    </div>

    <div class="today-status">
      <div class="status-title">今日進度 · Day ${App.todayDay}</div>
      <div class="status-fraction">
        <span class="status-done">${doneToday}</span>
        <span class="status-total">/ ${total} 位完成</span>
      </div>
      <span class="status-msg ${allDone?'all-done':'pending'}">
        ${allDone ? '🎉 全員完成！今日積分已解鎖！' : `還差 ${total - doneToday} 位，一起加油！`}
      </span>
    </div>

    <div class="card">
      <div class="card-title">🏆 個人記錄排行</div>
      <div class="leaderboard">
        ${scores.map((s,i) => {
          const memberInfo = allMem.find(m => m.id === s.id);
          const av  = memberInfo ? DATA28.AVATARS[memberInfo.avatar_index || 0] : '📖';
          const rankCls = i===0?'top1':i===1?'top2':i===2?'top3':'';
          const isMe = s.id === App.me.id;
          return `<div class="lb-row" style="${isMe?'border-color:var(--gold);box-shadow:3px 3px 0 var(--gold-deep)':''}">
            <div class="lb-rank ${rankCls}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
            <div class="lb-avatar">${av}</div>
            <div class="lb-name">${App.esc(s.name)}${isMe?' <span style="font-size:11px;color:var(--gold)">(你)</span>':''}</div>
            <div>
              <div class="lb-score">${s.days}</div>
              <div class="lb-days">天</div>
            </div>
          </div>`;
        }).join('')}
        ${scores.length === 0 ? '<div class="empty-tip">還沒有記錄，成為第一個完成任務的人吧！</div>' : ''}
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════
   Profile Modal
════════════════════════════════════════ */
function showProfileModal() {
  if (!App.bazi) return App.toast('能量檔案載入中…');
  const { profile, masterType, formatted } = App.bazi;
  const av  = DATA28.AVATARS[App.me.avatar_index || 0];
  const colors = DATA28.QUADRANTS.map(q => q.color);

  const barsHtml = DATA28.QUADRANTS.map((q,i) => {
    const pct = profile.percents[i];
    const lbl = DATA28.energyLabel(pct);
    return `<div class="qbar-row">
      <span class="qbar-icon">${q.icon}</span>
      <div class="qbar-info">
        <div class="qbar-name">${q.name} <span class="qbar-tag ${lbl.cls}">${lbl.text}</span></div>
        <div class="qbar-track">
          <div class="qbar-fill" style="width:${pct}%;--bar-color:${q.color}"></div>
        </div>
      </div>
      <div class="qbar-pct">${pct}%</div>
    </div>`;
  }).join('');

  $('#profileModalCard').innerHTML = `
    <div style="position:relative">
      <button class="modal-close" onclick="$('#profileModal').classList.add('hidden')">✕</button>
      <div class="pm-header">
        <div class="pm-avatar">${av}</div>
        <div class="pm-name">${App.esc(App.me.name)}</div>
        <div class="pm-type" style="color:${masterType.color}">${masterType.icon} ${masterType.name} · ${masterType.elem}日主</div>
      </div>
      <p style="font-size:13px;color:var(--ink-mid);line-height:1.6;background:var(--cream);border-radius:var(--radius-sm);padding:10px 12px;border-left:4px solid var(--gold);margin:0 0 14px">${App.esc(masterType.desc)}</p>
      <div class="pillars-row" style="margin-bottom:16px">
        ${['年柱','月柱','日柱','時柱'].map((l,i) => {
          const v = [formatted?.year,formatted?.month,formatted?.day,formatted?.hour][i] || '?';
          return `<div class="pillar-box" style="box-shadow:3px 3px 0 ${masterType.color}">${App.esc(v)}<small>${l}</small></div>`;
        }).join('')}
      </div>
      <div class="reveal-section-title">五大能量圖譜</div>
      <div class="radar-wrap">${BAZI.buildRadarSVG(profile.percents, colors)}</div>
      <div class="quadrant-bars">${barsHtml}</div>
    </div>
  `;
  $('#profileModal').classList.remove('hidden');
}

/* ════════════════════════════════════════
   Confetti Animation
════════════════════════════════════════ */
function launchConfetti() {
  const canvas = $('#confettiCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#C9A84C','#E8C96A','#C0392B','#27AE60','#8E44AD','#2980B9','#FFF8EE'];
  const particles = Array.from({length:90}, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    vx: (Math.random()-0.5) * 4,
    vy: Math.random() * 3 + 2,
    r: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random()*colors.length)],
    spin: (Math.random()-0.5) * 0.3,
    angle: Math.random() * Math.PI * 2,
    shape: Math.random() > 0.5 ? 'rect' : 'star',
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x  += p.vx; p.y += p.vy; p.vy += 0.06; p.angle += p.spin;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r/2, -p.r/4, p.r, p.r/2);
      } else {
        ctx.beginPath();
        for (let j=0;j<5;j++) {
          const a = (j*4*Math.PI/5)-Math.PI/2;
          const ai= ((j*4+2)*Math.PI/5)-Math.PI/2;
          if (j===0) ctx.moveTo(Math.cos(a)*p.r, Math.sin(a)*p.r);
          else ctx.lineTo(Math.cos(a)*p.r, Math.sin(a)*p.r);
          ctx.lineTo(Math.cos(ai)*p.r*.45, Math.sin(ai)*p.r*.45);
        }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
    frame++;
    if (frame < 100) requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  draw();
}

/* ════════════════════════════════════════
   Boot
════════════════════════════════════════ */
async function boot() {
  paintMotifs();
  initDB();
  await App.db.loadConfig();

  // Wire up login steps
  $('#checkNameBtn').onclick = handleCheckName;
  $('#loginName').onkeydown = (e) => { if(e.key==='Enter') handleCheckName(); };
  $('#pinLoginBtn').onclick  = handlePinLogin;
  $('#loginPin').onkeydown   = (e) => { if(e.key==='Enter') handlePinLogin(); };
  $('#registerBtn').onclick  = handleRegister;
  $('#backToName').onclick   = () => { $('#stepPin').classList.add('hidden'); $('#stepName').classList.remove('hidden'); };
  $('#backToName2').onclick  = () => { $('#stepRegister').classList.add('hidden'); $('#stepName').classList.remove('hidden'); };

  // Nav
  $$('.tab').forEach(t => t.onclick = () => showPage(t.dataset.page));
  $('#logoutBtn').onclick = logout;
  $('#topAvatar').onclick = showProfileModal;
  $('#profileModal').onclick = (e) => { if(e.target.id==='profileModal') $('#profileModal').classList.add('hidden'); };
  $('#modalOverlay').onclick = (e) => { if(e.target.id==='modalOverlay') App.closeModal(); };

  // Auto login
  const saved = JSON.parse(localStorage.getItem('bazi28_me') || 'null');
  if (saved) {
    try {
      const m = await App.db.findMember(saved.name);
      if (m && m.pin === saved.pin) {
        App.me = m;
        restoreBazi();
        enterApp();
        return;
      }
    } catch(_) {}
  }
  // Show login
  $('#loginOverlay').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', boot);
