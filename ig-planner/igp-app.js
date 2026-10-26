// IG Planner — 月曆 / 清單、登入、存檔同步

const igpState = {
  eps: {},
  month: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  view: igpStore.get('igp_view', 'cal'),
  sync: 'idle', // idle | saving | saved | offline
};

const $ = id => document.getElementById(id);

function igpToast(msg) {
  const t = document.createElement('div');
  t.className = 'igp-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ── 存檔:先寫本機,0.8 秒後同步雲端 ──
let igpFlushTimer = null;

function igpShowSaveState() {
  const el = $('igp-save-state');
  if (!el) return;
  el.textContent = { idle: '', saving: '儲存中…', saved: '已同步 ✓', offline: '離線,已存本機,稍後同步' }[igpState.sync];
}

function igpScheduleFlush() {
  igpState.sync = 'saving';
  igpShowSaveState();
  clearTimeout(igpFlushTimer);
  igpFlushTimer = setTimeout(async () => {
    const ok = await igpApi.flush();
    igpState.sync = ok ? 'saved' : 'offline';
    igpShowSaveState();
  }, 800);
}

function igpSaveEp(ep) {
  igpState.eps[ep.igp_date] = ep;
  igpApi.writeCache(ep);
  igpScheduleFlush();
}

function igpRemoveEp(date) {
  delete igpState.eps[date];
  igpApi.writeCache({ igp_date: date }, true);
  igpScheduleFlush();
}

// ── 畫面 ──
function igpStatusDot(status) {
  return `<span class="igp-dot igp-s-${status}" title="${IGP_STATUSES[status] || ''}"></span>`;
}

function igpTypeColor(type) {
  return { story: 'var(--igp-orange)', tool: 'var(--igp-navy)', life: 'var(--igp-green)' }[type] || 'transparent';
}

function igpMonthDates() {
  const first = igpState.month;
  const offset = (first.getDay() + 6) % 7; // 週一開頭
  const start = new Date(first);
  start.setDate(1 - offset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  // 最後一整週都在下個月就不顯示
  return days.slice(35).every(d => d.getMonth() !== first.getMonth()) ? days.slice(0, 35) : days;
}

function igpRenderCalendar() {
  const today = igpIso(new Date());
  const cells = igpMonthDates().map(d => {
    const iso = igpIso(d);
    const ep = igpState.eps[iso];
    const out = d.getMonth() !== igpState.month.getMonth();
    const day = igpDayNumber(iso);
    return `
      <button class="igp-cell${out ? ' igp-out' : ''}${iso === today ? ' igp-today' : ''}" data-date="${iso}">
        <span class="igp-dnum">${d.getDate()}${ep ? igpStatusDot(ep.igp_status) : ''}</span>
        ${day ? `<span><span class="igp-day">D${day}</span></span>` : ''}
        ${ep?.igp_title ? `<span class="igp-ctitle">${igpEsc(ep.igp_title)}</span>` : '<span class="igp-add">＋</span>'}
        ${ep ? `<span class="igp-bar" style="background:${igpTypeColor(ep.igp_type)}"></span>` : ''}
      </button>`;
  }).join('');
  return `
    <div class="igp-cal">
      <div class="igp-week">${['一', '二', '三', '四', '五', '六', '日'].map(w => `<div>${w}</div>`).join('')}</div>
      <div class="igp-grid">${cells}</div>
    </div>`;
}

function igpRenderList() {
  const m = igpState.month;
  const prefix = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  const eps = Object.values(igpState.eps).filter(e => e.igp_date.startsWith(prefix)).sort((a, b) => a.igp_date.localeCompare(b.igp_date));
  if (!eps.length) return '<div class="igp-empty">這個月還沒有排內容。切回月曆點任一天新增。</div>';
  return `<div class="igp-list">${eps.map(ep => {
    const d = new Date(ep.igp_date + 'T00:00:00');
    const t = IGP_TYPES[ep.igp_type];
    const sec = igpMeter(ep.igp_script_short || ep.igp_script).sec;
    return `
      <button class="igp-card" data-date="${ep.igp_date}">
        <div class="igp-date"><b>${d.getMonth() + 1}/${d.getDate()}</b><small>${ep.igp_day ? `DAY ${ep.igp_day}` : ''}</small></div>
        <div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span class="igp-tag igp-t-${ep.igp_type}">${t?.emoji} ${t?.name}</span>
            ${igpStatusDot(ep.igp_status)}<span style="font-size:.75rem">${IGP_STATUSES[ep.igp_status]}</span>
            ${sec ? `<span style="font-size:.75rem;color:var(--igp-muted)">約 ${sec} 秒</span>` : ''}
          </div>
          <h3>${igpEsc(ep.igp_title || '(未命名)')}</h3>
          <p>${igpEsc(ep.igp_hook)}</p>
        </div>
      </button>`;
  }).join('')}</div>`;
}

function igpRenderStats() {
  const today = igpIso(new Date());
  const day = igpDayNumber(today);
  const wait = Math.round((new Date(IGP_START_DATE + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  $('igp-st-day').textContent = day ?? wait;
  $('igp-st-day').nextElementSibling.textContent = day ? '今天是 Day' : '天後開始 Day 1';
  const m = igpState.month;
  const prefix = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  const eps = Object.values(igpState.eps);
  $('igp-st-posted').textContent = eps.filter(e => e.igp_date.startsWith(prefix) && e.igp_status === 'posted').length;
  $('igp-st-ready').textContent = eps.filter(e => e.igp_status === 'script').length;
}

function igpRender() {
  const m = igpState.month;
  $('igp-month').textContent = `${m.getFullYear()} 年 ${m.getMonth() + 1} 月`;
  $('igp-view').innerHTML = igpState.view === 'cal' ? igpRenderCalendar() : igpRenderList();
  $('igp-v-cal').classList.toggle('igp-on', igpState.view === 'cal');
  $('igp-v-list').classList.toggle('igp-on', igpState.view === 'list');
  igpRenderStats();
}

function igpRenderLegend() {
  $('igp-legend').innerHTML =
    Object.entries(IGP_STATUSES).map(([k, v]) => `<span>${igpStatusDot(k)}${v}</span>`).join('') +
    Object.entries(IGP_TYPES).map(([k, v]) => `<span><span style="width:14px;height:4px;background:${igpTypeColor(k)};display:inline-block"></span>${v.name}</span>`).join('');
}

// ── 登入 ──
function igpShowLogin() {
  $('igp-login').classList.remove('igp-hidden');
  $('igp-main').classList.add('igp-hidden');
  $('igp-user').classList.add('igp-hidden');
}

function igpLoginMsg(text, err = false) {
  $('igp-login-msg').textContent = text;
  $('igp-login-msg').classList.toggle('igp-err', err);
}

$('igp-email-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('igp-email').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return igpLoginMsg('Email 格式不對', true);
  igpLoginMsg('寄送中…');
  try {
    await igpAuth.sendLink(email);
    igpStore.set('igp_last_email', email);
    igpLoginMsg('已寄出!請用同一個瀏覽器打開信中的登入連結。');
  } catch (err) {
    igpLoginMsg(err.message, true);
  }
});

$('igp-google').onclick = () => {
  igpLoginMsg('前往 Google…');
  igpAuth.google();
};

$('igp-logout').onclick = async () => {
  if (!confirm('確定登出?')) return;
  await igpApi.flush();
  await igpAuth.logout();
  location.reload();
};

// ── 操作 ──
$('igp-prev').onclick = () => { igpState.month.setMonth(igpState.month.getMonth() - 1); igpRender(); };
$('igp-next').onclick = () => { igpState.month.setMonth(igpState.month.getMonth() + 1); igpRender(); };
$('igp-today').onclick = () => { const d = new Date(); igpState.month = new Date(d.getFullYear(), d.getMonth(), 1); igpRender(); };
$('igp-v-cal').onclick = () => { igpState.view = 'cal'; igpStore.set('igp_view', 'cal'); igpRender(); };
$('igp-v-list').onclick = () => { igpState.view = 'list'; igpStore.set('igp_view', 'list'); igpRender(); };
$('igp-view').addEventListener('click', e => {
  const t = e.target.closest('[data-date]');
  if (t) igpDetail.open(t.dataset.date);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && igpDetail.ep && !document.querySelector('.igp-prompter')) igpDetail.close();
});
window.addEventListener('online', () => igpScheduleFlush());

// ── 啟動 ──
async function igpStart() {
  $('igp-login').classList.add('igp-hidden');
  $('igp-main').classList.remove('igp-hidden');
  $('igp-user').classList.remove('igp-hidden');
  $('igp-user-email').textContent = igpAuth.user.email;
  igpRenderLegend();

  igpState.eps = igpApi.cached();
  igpRender();
  try {
    igpState.eps = await igpApi.loadAll();
  } catch (err) {
    if (String(err.message).includes('NO_SESSION')) { igpAuth.clear(); return igpShowLogin(); }
    igpToast('連不上雲端,先顯示本機資料');
  }

  // 第一次使用:放入 Day 1 + 30 天草稿
  const seededKey = `igp_seeded_${igpAuth.user.id}`;
  if (!Object.keys(igpState.eps).length && !igpStore.get(seededKey, false)) {
    igpBuildSeed().forEach(ep => { igpState.eps[ep.igp_date] = ep; igpApi.writeCache(ep); });
    igpStore.set(seededKey, true);
    igpScheduleFlush();
    igpToast('已放入 Day 1 與 30 天主題草稿');
  } else {
    igpApi.flush();
  }
  igpRender();
}

(async function igpInit() {
  $('igp-email').value = igpStore.get('igp_last_email', '');
  const hashErr = new URLSearchParams(location.hash.slice(1)).get('error_description');
  if (hashErr) {
    history.replaceState(null, '', location.pathname + location.search);
    igpShowLogin();
    return igpLoginMsg(`登入失敗:${hashErr}`, true);
  }
  try {
    await igpAuth.fromUrlHash();
  } catch { /* 連結失效就回登入頁 */ }
  if (igpAuth.user) igpStart(); else igpShowLogin();
})();
