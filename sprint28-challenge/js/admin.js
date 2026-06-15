// ===== 管理員後台：設定開始日、看所有夥伴名單與任務執行狀態 =====
App._adminAuthed = false;

App.openAdmin = function () {
  $('#adminOverlay').classList.remove('hidden');
  $('#adminOverlay').onclick = (e) => { if (e.target.id === 'adminOverlay') closeAdmin(); };
  if (App._adminAuthed) renderAdminDash();
  else renderAdminLogin();
};
function closeAdmin() { $('#adminOverlay').classList.add('hidden'); }

function renderAdminLogin() {
  $('#adminCard').innerHTML = `
    <div class="admin-h"><h2>🔐 管理員登入</h2><button class="icon-btn" id="aClose" style="background:var(--blue-100);color:var(--blue-700)">✕</button></div>
    <div class="field"><label>管理員密碼</label><input id="aPwd" type="password" placeholder="輸入密碼" /></div>
    <p class="login-msg" id="aMsg"></p>
    <button class="btn btn-primary btn-block" id="aLogin"><span>進入後台</span></button>
    <p class="empty-tip" style="text-align:center;margin-top:10px">預設密碼為 boss1688，進入後請立即修改。</p>`;
  $('#aClose').onclick = closeAdmin;
  const tryLogin = async () => {
    const h = await App.sha256($('#aPwd').value);
    if (h === App.cfg.admin_pwd_hash) { App._adminAuthed = true; renderAdminDash(); }
    else $('#aMsg').textContent = '密碼錯誤';
  };
  $('#aLogin').onclick = tryLogin;
  $('#aPwd').onkeydown = (e) => { if (e.key === 'Enter') tryLogin(); };
}

async function renderAdminDash() {
  $('#adminCard').innerHTML = '<p class="empty-tip" style="text-align:center;padding:30px">載入中…</p>';
  const [{ data: members }, { data: daily }] = await Promise.all([
    App.sb.from('sprint28_members').select('*').order('created_at'),
    App.sb.from('sprint28_daily').select('*'),
  ]);
  const mem = members || [], all = daily || [];
  const byMember = {};
  all.forEach((d) => { (byMember[d.member_id] = byMember[d.member_id] || []).push(d); });
  const today = App.dayFromDate();

  $('#adminCard').innerHTML = `
    <div class="admin-h"><h2>⚙️ 管理後台</h2><button class="icon-btn" id="aClose" style="background:var(--blue-100);color:var(--blue-700)">✕</button></div>
    <div class="stat-grid">
      <div class="stat"><b>${mem.length}</b><span>夥伴人數</span></div>
      <div class="stat"><b>${all.length}</b><span>登記筆數</span></div>
      <div class="stat"><b>${today}</b><span>目前第幾天</span></div>
    </div>

    <p class="section-label">📅 挑戰設定</p>
    <div class="field"><label>開始日期（自動推算今天第幾天）</label><input id="setStart" type="date" value="${App.cfg.start_date}" /></div>
    <div class="field"><label>團隊名稱</label><input id="setTeam" value="${App.esc(App.cfg.team_name || '')}" maxlength="20" /></div>
    <button class="btn btn-primary btn-block" id="saveCfg"><span>儲存設定</span></button>

    <hr class="soft" />
    <p class="section-label">🔑 修改管理員密碼</p>
    <div class="field"><input id="newPwd" type="password" placeholder="輸入新密碼（至少 4 碼）" /></div>
    <button class="btn btn-ghost btn-block" id="savePwd"><span>更新密碼</span></button>

    <hr class="soft" />
    <p class="section-label">👥 夥伴任務執行狀態（綠＝當天已登記，點名字看名單）</p>
    <div id="memberList"></div>`;

  $('#aClose').onclick = closeAdmin;
  $('#saveCfg').onclick = async () => {
    const start_date = $('#setStart').value;
    const team_name = $('#setTeam').value.trim() || '衝刺團隊';
    await App.sb.from('sprint28_config').update({ start_date, team_name, updated_at: new Date().toISOString() }).eq('id', 1);
    App.cfg.start_date = start_date; App.cfg.team_name = team_name;
    App.todayDay = App.dayFromDate(); $('#dayBadge').textContent = 'Day ' + App.todayDay; $('#teamChip').textContent = team_name;
    App.toast('設定已更新 ✅'); renderAdminDash();
  };
  $('#savePwd').onclick = async () => {
    const v = $('#newPwd').value;
    if (v.length < 4) return App.toast('密碼至少 4 碼');
    const hash = await App.sha256(v);
    await App.sb.from('sprint28_config').update({ admin_pwd_hash: hash }).eq('id', 1);
    App.cfg.admin_pwd_hash = hash; App.toast('密碼已更新 🔑');
  };

  const ml = $('#memberList');
  if (!mem.length) { ml.innerHTML = '<p class="empty-tip">還沒有夥伴加入。</p>'; return; }
  ml.innerHTML = mem.map((m) => {
    const ds = byMember[m.id] || [];
    const total = ds.reduce((s, e) => s + e.score, 0);
    const doneDays = new Set(ds.map((e) => e.day_index));
    let grid = '';
    for (let d = 1; d <= 28; d++) grid += `<i class="${doneDays.has(d) ? 'on' : ''}">${d}</i>`;
    return `
      <div class="card" style="padding:12px;margin-bottom:10px">
        <div class="list-row" style="border:0;padding:0 0 6px">
          <div class="list-name" style="cursor:pointer;color:var(--blue-700)" data-m="${m.id}">${DATA.AVATARS[m.avatar_index] || '⭐'} ${App.esc(m.name)} ▾</div>
          <span class="count-bubble">${total} 分・${doneDays.size}/28 天</span>
        </div>
        <div class="day-grid">${grid}</div>
        <div id="detail-${m.id}"></div>
      </div>`;
  }).join('');

  $$('[data-m]').forEach((el) => el.onclick = () => {
    const id = el.dataset.m;
    const box = $('#detail-' + id);
    if (box.dataset.open) { box.innerHTML = ''; box.dataset.open = ''; return; }
    box.dataset.open = '1';
    const ds = (byMember[id] || []).sort((a, b) => a.day_index - b.day_index);
    box.innerHTML = '<hr class="soft" style="margin:10px 0" />' + (ds.length ? ds.map((e) => `
      <div style="margin-bottom:8px">
        <b style="color:var(--blue-700)">Day ${e.day_index}・${e.score} 分</b>
        <div class="list-meta">💗 關心：${e.care_names.length ? e.care_names.map(App.esc).join('、') : '—'}</div>
        <div class="list-meta">🤝 溝通：${e.comm_names.length ? e.comm_names.map(App.esc).join('、') : '—'}</div>
      </div>`).join('') : '<p class="empty-tip">尚無登記。</p>');
  });
}
