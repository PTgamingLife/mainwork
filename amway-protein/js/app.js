// 安麗蛋白素挑戰 — 主控:LIFF 初始化、API 呼叫、分頁切換、首頁渲染。
(function () {
  const CFG = window.AMP_CONFIG;
  const HONESTY = '自律且誠實,騙人胖十斤';

  const AMP = window.AMP = {
    state: null,
    idToken: '',
    view: 'home',
  };

  const $ = (id) => document.getElementById(id);

  // ---------- 共用小工具 ----------
  AMP.toast = function (msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(AMP._toastTimer);
    AMP._toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
  };

  AMP.fail = function (msg) {
    $('loading').classList.add('hidden');
    $('app').classList.add('hidden');
    $('errorScreen').classList.remove('hidden');
    $('errorMsg').textContent = msg;
  };

  // 所有後端呼叫都走這裡:mock 模式轉給 js/mock.js,正式走 amp-api。
  AMP.api = async function (action, payload) {
    if (CFG.MOCK) return window.AMP_MOCK(action, payload || {});
    const res = await fetch(CFG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, idToken: AMP.idToken }, payload || {})),
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'BAD_RESPONSE' }));
    if (!data.ok && data.error === 'UNAUTHORIZED') {
      // ID token 有效期短,過期就請 LIFF 重新拿一次。
      AMP.idToken = (window.liff && liff.getIDToken()) || '';
    }
    return data;
  };

  // ---------- 分頁 ----------
  // share 沒有自己的底部分頁(四格已滿),從首頁按鈕或 OA 打「分享」進來。
  const VIEWS = ['home', 'score', 'board', 'quiz', 'share'];

  AMP.go = function (view) {
    AMP.view = view;
    VIEWS.forEach((v) => {
      $('view-' + v).classList.toggle('hidden', v !== view);
    });
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('is-on', t.dataset.view === view);
    });
    if (view === 'board') AMP.loadBoard();
    if (view === 'quiz') AMP.loadQuiz();
    if (view === 'share') AMP.loadShare();
  };

  // ---------- 首頁 ----------
  const TYPE_LABEL = { eat: '🥄 自己吃一湯匙', share: '📣 分享', refer: '🏆 推薦一罐', quiz: '❓ 答對問答' };

  function daysLeft(round, today) {
    const end = Date.parse(round.end + 'T00:00:00Z');
    const now = Date.parse(today + 'T00:00:00Z');
    return Math.max(0, Math.round((end - now) / 86400000) + 1);
  }

  AMP.render = function () {
    const s = AMP.state;
    if (!s) return;

    $('meName').textContent = s.member.name || '夥伴';
    if (s.member.avatar) $('meAvatar').src = s.member.avatar;
    $('roundRange').textContent = `${s.round.start} ~ ${s.round.end}`;

    $('homePoints').textContent = s.totalPoints;
    $('homeRank').textContent = s.rank || '-';
    $('homeStreak').textContent = s.streak;
    $('homeLeft').textContent = daysLeft(s.round, s.today);

    const c = s.todayCounts;
    $('todayGrid').innerHTML = [
      ['🥄', '吃一匙', c.eat], ['📣', '分享', c.share],
      ['🏆', '推薦', c.refer], ['❓', '問答', c.quiz],
    ].map(([emoji, label, n]) => `
      <div class="today-item ${n > 0 ? 'is-done' : ''}">
        <b>${n}</b><span>${emoji} ${label}</span>
      </div>`).join('');

    const list = $('logList');
    if (!s.recent.length) {
      list.innerHTML = '<li class="log-empty">還沒有紀錄,去加第一分吧!</li>';
    } else {
      list.innerHTML = s.recent.map((r) => `
        <li>
          <span>${r.date.slice(5)} ${TYPE_LABEL[r.type] || r.type}${r.target ? ' · ' + esc(r.target) : ''}</span>
          <span class="log-pt">+${r.points}</span>
        </li>`).join('');
    }
  };

  const esc = AMP.esc = function (str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  };

  // 把 api 回傳的完整狀態(add-action / quiz-answer 都會附)寫回並重畫。
  AMP.applyState = function (data) {
    if (data && data.member && data.round) {
      AMP.state = data;
      AMP.render();
    }
  };

  // ---------- 啟動 ----------
  async function boot() {
    ['homeHonesty', 'scoreHonesty', 'boardHonesty', 'quizHonesty', 'sheetHonesty', 'shareHonesty']
      .forEach((id) => { const el = $(id); if (el) el.textContent = HONESTY; });

    document.querySelectorAll('.tab').forEach((t) => {
      t.addEventListener('click', () => AMP.go(t.dataset.view));
    });
    $('retryBtn').addEventListener('click', () => location.reload());

    if (!CFG.MOCK) {
      // 四個分頁都在同一個半頁 LIFF 裡切換,不再開全頁。
      const liffId = CFG.LIFF_ID_COMPACT || CFG.LIFF_ID_FULL;
      if (!liffId) return AMP.fail('尚未設定 LIFF ID(js/config.js)。要離線試玩請在網址加 ?mock=1');
      try {
        $('loadingMsg').textContent = '連線 LINE…';
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) return liff.login({ redirectUri: location.href });
        AMP.idToken = liff.getIDToken() || '';
        if (!AMP.idToken) return AMP.fail('拿不到 LINE 身分,請重新開啟一次。');
      } catch (e) {
        return AMP.fail('LIFF 初始化失敗:' + (e && e.message ? e.message : e));
      }
    }

    $('loadingMsg').textContent = '載入分數…';
    const data = await AMP.api('me');
    if (!data.ok) {
      if (data.error === 'NO_ACTIVE_ROUND') return AMP.fail('目前沒有進行中的賽季,請聯絡團隊管理員開新一輪。');
      return AMP.fail('載入失敗:' + (data.error || '未知錯誤'));
    }
    AMP.state = data;
    AMP.render();

    $('loading').classList.add('hidden');
    $('app').classList.remove('hidden');

    const wanted = new URLSearchParams(location.search).get('view');
    AMP.go(VIEWS.includes(wanted) ? wanted : 'home');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
