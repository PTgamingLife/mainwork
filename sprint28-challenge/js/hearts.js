// ===== 第2頁：愛心漂浮（每顆 = 當天完成任務的夥伴） =====
App.renderHearts = async function () {
  const day = App.todayDay;
  const wrap = $('#page-hearts');
  wrap.innerHTML = `
    <div class="day-nav">
      <span style="font-weight:900;color:var(--blue-900)">💗 Day ${day} 完成任務的夥伴</span>
      <button class="btn btn-ghost btn-sm" id="heartsRefresh"><span>🔄 更新</span></button>
    </div>
    <div class="hearts-stage" id="heartsStage"></div>
    <div class="legend">
      <span>🌟 越亮 = 當日分數越高</span>
      <span>👆 點愛心送鼓勵</span>
    </div>`;
  $('#heartsRefresh').onclick = App.renderHearts;

  const stage = $('#heartsStage');
  let entries = await App.db.dayEntries(day);
  entries = entries.filter((e) => e.score > 0);

  if (!entries.length) {
    stage.innerHTML = `<div class="hearts-empty">
      <div style="font-size:54px">💗</div>
      <p>今天還沒有夥伴登記成果<br/>快去「任務」頁完成第一筆，點亮你的愛心！</p>
    </div>`;
    return;
  }

  const maxScore = Math.max(...entries.map((e) => e.score));
  const W = stage.clientWidth || 360, H = stage.clientHeight || 380;

  entries.forEach((e, i) => {
    const ratio = maxScore > 0 ? e.score / maxScore : 1;        // 0..1
    const opacity = (0.45 + ratio * 0.55).toFixed(2);            // 分數越高越不透明
    const size = Math.round(34 + ratio * 30);                    // 34..64px
    const glow = Math.round(4 + ratio * 22);                     // 光暈
    const mine = e.member_id === App.me.id;

    const x = 8 + Math.random() * 78, y = 6 + Math.random() * 70;
    const dur = (6 + Math.random() * 5).toFixed(1), delay = (-Math.random() * 5).toFixed(1);

    const h = document.createElement('div');
    h.className = 'float-heart';
    h.style.cssText =
      `left:${x}%;top:${y}%;opacity:${opacity};--size:${size}px;--glow:${glow}px;--dur:${dur}s;animation-delay:${delay}s`;
    h.innerHTML = `<span class="h-ico">${mine ? '💖' : '❤️'}</span><span class="h-name">${App.esc(e.member_name)}·${e.score}</span>`;
    h.onclick = (ev) => openPraise(e, ev);
    stage.appendChild(h);
  });
};

async function openPraise(entry, ev) {
  // 點擊處愛心爆裂特效
  burstAt(ev.clientX, ev.clientY);
  const isSelf = entry.member_id === App.me.id;
  const praises = await App.db.praisesFor(entry.member_id);
  App.openModal(`
    <div class="praise-target">
      <div class="pt-ava">${entry.member_id === App.me.id ? '💖' : '❤️'}</div>
      <h2 style="margin:6px 0 0;color:var(--blue-900)">${App.esc(entry.member_name)}</h2>
      <p class="empty-tip">Day ${entry.day_index}・今日 ${entry.score} 分　${'⭐'.repeat(Math.min(5, Math.ceil(entry.score / 6)))}</p>
    </div>
    ${isSelf ? '<p class="empty-tip" style="text-align:center">這是你自己的愛心！看看夥伴給你的鼓勵 👇</p>'
      : '<p class="section-label">送出鼓勵（點一句即送）</p><div class="praise-chip-row" id="praiseChips"></div>'}
    <p class="section-label">收到的鼓勵 (${praises.length})</p>
    <div class="praise-feed" id="praiseFeed"></div>
    <button class="btn btn-ghost btn-block" id="praiseClose" style="margin-top:10px"><span>關閉</span></button>`);

  const feed = $('#praiseFeed');
  const drawFeed = (list) => {
    feed.innerHTML = list.length
      ? list.map((p) => `<div class="praise-item"><b>${App.esc(p.from_name)}</b>：${App.esc(p.message)}</div>`).join('')
      : '<p class="empty-tip">還沒有人留言，當第一個鼓勵他的人吧！</p>';
  };
  drawFeed(praises);
  $('#praiseClose').onclick = App.closeModal;

  if (!isSelf) {
    const pool = [...DATA.PRAISE_POOL].sort(() => Math.random() - 0.5).slice(0, 6);
    $('#praiseChips').innerHTML = pool.map((p, i) => `<button class="praise-chip" data-i="${i}">${App.esc(p)}</button>`).join('');
    $$('.praise-chip').forEach((c) => c.onclick = async () => {
      const text = pool[+c.dataset.i];
      c.disabled = true;
      try {
        await App.db.savePraise(entry.member_id, entry.member_name, text, entry.day_index);
        App.toast('鼓勵已送出 💌');
        burstAt(window.innerWidth / 2, window.innerHeight / 2);
        drawFeed([{ from_name: App.me.name, message: text }, ...praises]);
      } catch (e) { App.toast('送出失敗'); c.disabled = false; }
    });
  }
}

function burstAt(x, y) {
  const icons = ['💖', '⭐', '🌟', '✨', '💗'];
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('div');
    b.className = 'burst'; b.textContent = icons[i % icons.length];
    b.style.left = x + 'px'; b.style.top = y + 'px';
    b.style.setProperty('--bx', (Math.random() * 160 - 80) + 'px');
    b.style.setProperty('--by', (-60 - Math.random() * 80) + 'px');
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 900);
  }
}
