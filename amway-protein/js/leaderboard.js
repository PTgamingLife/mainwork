// 排行榜 + 戳夥伴。
// 戳的當下不推播,由 amp-poke-digest 每天台北 17:00 彙總成一張卡片發出去,
// 所以這裡按下去只回「已戳」,並提示對方傍晚會收到。
(function () {
  const $ = (id) => document.getElementById(id);
  const poked = new Set();

  window.AMP.loadBoard = async function () {
    const list = $('boardList');
    list.innerHTML = '<li class="board-row"><span class="board-meta">載入中…</span></li>';

    const data = await window.AMP.api('leaderboard');
    if (!data.ok) {
      list.innerHTML = '<li class="board-row"><span class="board-meta">載入失敗</span></li>';
      return;
    }

    const esc = window.AMP.esc;
    const top = data.rows.length ? data.rows[0].points : 0;

    list.innerHTML = data.rows.map((r) => {
      const isMe = r.memberId === data.me;
      const gap = top - r.points;
      const avatar = r.avatar
        ? `<img class="board-avatar" src="${esc(r.avatar)}" alt="" />`
        : '<div class="board-avatar"></div>';
      const meta = isMe
        ? (gap > 0 ? `距離第一名 ${gap} 分` : '目前領先,守住!')
        : `${r.activeDays} 天有行動`;
      const action = isMe
        ? '<span class="board-meta">就是你</span>'
        : `<button class="poke-btn" data-poke="${esc(r.memberId)}" data-name="${esc(r.name)}">戳一下 👉</button>`;
      return `
        <li class="board-row ${isMe ? 'is-me' : ''}">
          <span class="board-rank ${r.rank <= 3 ? 'top' : ''}">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
          ${avatar}
          <span class="board-main">
            <span class="board-name">${esc(r.name)}</span>
            <span class="board-meta">${meta}</span>
          </span>
          <span class="board-points">${r.points}</span>
          ${action}
        </li>`;
    }).join('');

    list.querySelectorAll('[data-poke]').forEach((btn) => {
      if (poked.has(btn.dataset.poke)) {
        btn.disabled = true;
        btn.textContent = '已戳 ✓';
      }
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        const res = await window.AMP.api('poke', { toMemberId: btn.dataset.poke });
        if (!res.ok) {
          btn.disabled = false;
          window.AMP.toast('戳失敗:' + (res.error || '未知錯誤'));
          return;
        }
        poked.add(btn.dataset.poke);
        btn.textContent = '已戳 ✓';
        window.AMP.toast(`已戳 ${res.target}!他今天 17:00 會收到「一起加油」`);
      });
    });
  };
})();
