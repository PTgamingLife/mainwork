/* lf_ 好友總覽、待整理、好友詳情 */
const lfList = { q: '', category: '', tag: '', since: '', until: '', sort: 'last_chat_at', page: 1, todo: '', sel: new Set() };

function lfListUrl() {
  const p = new URLSearchParams({ lf_q: lfList.q, lf_category: lfList.category, lf_tag: lfList.tag || 0, lf_since: lfList.since,
    lf_until: lfList.until, lf_sort: lfList.sort, lf_page: lfList.page, lf_todo: lfList.todo, lf_per: 50 });
  return '/api/lf_friends?' + p;
}

function lfListShell(title, extraTop) {
  return `<h2>${title}</h2>${extraTop || ''}
  <div class="lf-card"><div class="lf-row">
    <input id="lf-q" placeholder="搜尋名稱/狀態/備註/摘要" value="${lfEsc(lfList.q)}" style="flex:1;min-width:200px">
    <select id="lf-fcat">${lfCatOptions(lfList.category, true)}</select>
    <select id="lf-ftag"><option value="">全部標籤</option>${lfState.tags.map(t => `<option value="${t.id}" ${String(t.id) === String(lfList.tag) ? 'selected' : ''}>${lfEsc(t.name)}</option>`).join('')}</select>
    <label class="lf-mute">最後聯絡 <input type="date" id="lf-since" value="${lfEsc(lfList.since)}"> ~ <input type="date" id="lf-until" value="${lfEsc(lfList.until)}"></label>
    <select id="lf-sort">
      <option value="last_chat_at">最近聯絡優先</option><option value="last_chat_asc">最久沒聯絡優先</option>
      <option value="name">名稱</option><option value="msg_count">訊息數</option></select>
  </div></div>
  <div class="lf-card">
    <div class="lf-row" style="margin-bottom:8px">
      <span class="lf-mute" id="lf-selinfo">已勾選 0 位</span>
      <select id="lf-bcat">${lfCatOptions('', false)}</select><button class="lf-btn lf-sm" id="lf-bsetcat">改分類</button>
      <select id="lf-btag">${lfState.tags.map(t => `<option value="${t.id}">${lfEsc(t.name)}</option>`).join('')}</select>
      <button class="lf-btn lf-sm" id="lf-baddtag">加標籤</button><button class="lf-btn lf-sm lf-ghost" id="lf-brmtag">移除標籤</button>
      <button class="lf-btn lf-sm lf-ghost" id="lf-bren">產生改名提案 →</button>
    </div>
    <div id="lf-table"></div><div class="lf-pager" id="lf-pager"></div>
  </div>`;
}

async function lfListRender() {
  const box = document.getElementById('lf-table'); if (!box) return;
  const d = await lfApi(lfListUrl());
  if (!d.lf_rows.length) { box.innerHTML = '<div class="lf-empty">沒有符合條件的好友</div>'; document.getElementById('lf-pager').innerHTML = ''; return; }
  box.innerHTML = `<table class="lf-table"><thead><tr>
    <th><input type="checkbox" id="lf-all"></th><th>名稱</th><th>分類</th><th class="lf-hide-sm">標籤</th>
    <th class="lf-hide-sm">AI 摘要 / 建議</th><th>最後聯絡</th><th class="lf-hide-sm">訊息</th></tr></thead><tbody>
    ${d.lf_rows.map(r => `<tr>
      <td><input type="checkbox" class="lf-ck" data-id="${r.id}" ${lfList.sel.has(r.id) ? 'checked' : ''}></td>
      <td><a class="lf-name" href="#friend/${r.id}">${lfEsc(r.name)}</a>${r.has_unread ? ' <span class="lf-chip">未讀</span>' : ''}
        <div class="lf-mute">${lfEsc((r.status_msg || '').slice(0, 40))}</div></td>
      <td><select class="lf-rcat" data-id="${r.id}">${lfCatOptions(r.category, false)}</select>${r.manual_override ? '<span class="lf-ov" title="手動設定,同步不覆蓋">✎</span>' : ''}</td>
      <td class="lf-hide-sm">${lfTagChips(r.tags)}</td>
      <td class="lf-hide-sm">${lfEsc(r.ai_summary || '')}<div class="lf-mute">${lfEsc(r.ai_next_action || '')}</div></td>
      <td>${lfDate(r.last_chat_at)}</td><td class="lf-hide-sm">${r.msg_count}</td></tr>`).join('')}
    </tbody></table>`;
  const pages = Math.max(1, Math.ceil(d.lf_total / d.lf_per));
  document.getElementById('lf-pager').innerHTML = `<span class="lf-mute">共 ${d.lf_total} 位 · 第 ${d.lf_page}/${pages} 頁</span>
    <button class="lf-btn lf-sm lf-ghost" id="lf-prev" ${d.lf_page <= 1 ? 'disabled' : ''}>上一頁</button>
    <button class="lf-btn lf-sm lf-ghost" id="lf-next" ${d.lf_page >= pages ? 'disabled' : ''}>下一頁</button>`;
  document.getElementById('lf-prev').onclick = () => { lfList.page--; lfListRender(); };
  document.getElementById('lf-next').onclick = () => { lfList.page++; lfListRender(); };
  box.querySelectorAll('.lf-ck').forEach(c => c.onchange = () => { const id = +c.dataset.id; c.checked ? lfList.sel.add(id) : lfList.sel.delete(id); lfSelInfo(); });
  document.getElementById('lf-all').onchange = (e) => { box.querySelectorAll('.lf-ck').forEach(c => { c.checked = e.target.checked; const id = +c.dataset.id; c.checked ? lfList.sel.add(id) : lfList.sel.delete(id); }); lfSelInfo(); };
  box.querySelectorAll('.lf-rcat').forEach(s => s.onchange = () => lfTry(async () => {
    await lfApi('/api/lf_friends/' + s.dataset.id, { method: 'PATCH', body: { lf_category: s.value } }); lfToast('已改分類(手動,同步不覆蓋)'); lfListRender(); }));
}
function lfSelInfo() { const el = document.getElementById('lf-selinfo'); if (el) el.textContent = `已勾選 ${lfList.sel.size} 位`; }

function lfListBind() {
  const deb = (fn) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, 300); }; };
  const set = (k, id, ev = 'change') => { const el = document.getElementById(id); el.addEventListener(ev, deb(() => { lfList[k] = el.value; lfList.page = 1; lfListRender(); })); };
  set('q', 'lf-q', 'input'); set('category', 'lf-fcat'); set('tag', 'lf-ftag'); set('since', 'lf-since'); set('until', 'lf-until'); set('sort', 'lf-sort');
  document.getElementById('lf-sort').value = lfList.sort;
  const batch = (body, msg) => lfTry(async () => {
    if (!lfList.sel.size) throw new Error('請先勾選好友');
    const r = await lfApi('/api/lf_batch', { method: 'POST', body: { lf_ids: [...lfList.sel], ...body } }); lfToast(`${msg}:${r.lf_count} 位`); lfListRender(); });
  document.getElementById('lf-bsetcat').onclick = () => batch({ lf_action: 'set_category', lf_category: document.getElementById('lf-bcat').value }, '已改分類');
  document.getElementById('lf-baddtag').onclick = () => batch({ lf_action: 'add_tag', lf_tag_id: +document.getElementById('lf-btag').value }, '已加標籤');
  document.getElementById('lf-brmtag').onclick = () => batch({ lf_action: 'remove_tag', lf_tag_id: +document.getElementById('lf-btag').value }, '已移除標籤');
  document.getElementById('lf-bren').onclick = () => lfTry(async () => {
    if (!lfList.sel.size) throw new Error('請先勾選好友');
    const r = await lfApi('/api/lf_renames/propose', { method: 'POST', body: { lf_ids: [...lfList.sel], lf_template: '{prefix}{name}' } });
    lfToast(`已產生 ${r.lf_made} 筆改名提案(略過 ${r.lf_skipped}),請到「改名」分頁勾選確認`, 4000);
  });
}

lfPages.friends = async (main) => {
  lfList.todo = ''; lfList.sel.clear(); main.innerHTML = lfListShell('好友總覽'); lfListBind(); await lfListRender();
};

lfPages.todo = async (main, arg) => {
  lfList.todo = arg || lfList.todo || 'uncategorized';
  if (!['uncategorized', 'stale', 'prospect'].includes(lfList.todo)) lfList.todo = 'uncategorized';
  lfList.page = 1; lfList.sel.clear();
  const tabs = [['uncategorized', '未分類/不認識'], ['stale', '很久沒聯絡'], ['prospect', 'AI 判斷潛在客戶']];
  main.innerHTML = lfListShell('待整理', `<div class="lf-tabs">${tabs.map(([k, v]) => `<button data-k="${k}" class="${k === lfList.todo ? 'lf-on' : ''}">${v}</button>`).join('')}</div>
    <p class="lf-mute">「很久沒聯絡」= 超過 ${lfEsc(lfState.settings.lf_dormant_days || 365)} 天(可在分類設定調整)。</p>`);
  main.querySelectorAll('.lf-tabs button').forEach(b => b.onclick = () => { location.hash = 'todo/' + b.dataset.k; });
  lfListBind(); await lfListRender();
};

/* ---------- 好友詳情 ---------- */
lfPages.friend = async (main, id) => {
  const f = await lfApi('/api/lf_friends/' + id);
  const analyses = await lfApi('/api/lf_analyses/' + id);
  const tagIds = new Set(f.tags.filter(t => t.source === 'manual').map(t => t.id));
  const days = {};
  f.messages.forEach(m => { const d = (m.sent_at || '').slice(0, 10) || '日期不明'; days[d] = (days[d] || 0) + 1; });
  main.innerHTML = `
  <p><a href="#friends">← 回好友總覽</a></p>
  <h2>${lfEsc(f.name)} ${f.orig_name && f.orig_name !== f.name ? `<span class="lf-mute">(原名 ${lfEsc(f.orig_name)})</span>` : ''}</h2>
  <div class="lf-grid">
    <div class="lf-card">
      <h3>基本資料</h3>
      <p class="lf-mute">狀態消息:${lfEsc(f.status_msg || '—')}<br>最後聊天:${lfDate(f.last_chat_at)} · 已存訊息 ${f.msg_count} 則</p>
      <label class="lf-field">分類(手動修改後,重新同步不會覆蓋)<select id="lf-dcat">${lfCatOptions(f.category, false)}</select></label>
      <p class="lf-mute">規則判斷:${lfEsc(f.rule_category || '—')} · AI 判斷:${lfEsc(f.ai_category || '—')}</p>
      <h3>標籤</h3>
      <div class="lf-row">${lfState.tags.map(t => `<label><input type="checkbox" class="lf-dtag" value="${t.id}" ${tagIds.has(t.id) ? 'checked' : ''}> ${lfEsc(t.name)}</label>`).join('') || '<span class="lf-mute">尚無標籤,到分類設定新增</span>'}</div>
      <div class="lf-mute" style="margin-top:6px">自動標籤:${lfTagChips(f.tags.filter(t => t.source !== 'manual')) || '—'}</div>
      <h3 style="margin-top:12px">備註</h3>
      <textarea id="lf-dnote">${lfEsc(f.note || '')}</textarea>
      <div class="lf-row" style="margin-top:8px"><button class="lf-btn" id="lf-dsave">儲存</button></div>
    </div>
    <div class="lf-card">
      <h3>AI 摘要</h3>
      <p>${lfEsc(f.ai_summary || '尚未 AI 分類')}</p><p class="lf-mute">建議下一步:${lfEsc(f.ai_next_action || '—')}</p>
      <h3>聯絡時間軸</h3>
      <div class="lf-timeline">${Object.entries(days).reverse().slice(0, 15).map(([d, n]) => `<div>${lfEsc(d)} · ${n} 則</div>`).join('') || '<span class="lf-mute">尚無訊息</span>'}</div>
    </div>
  </div>
  <div class="lf-card">
    <h3>個人深度分析</h3>
    <label class="lf-field">分析重點(寫下你想知道什麼)
      <textarea id="lf-inst" placeholder="例:他對保險/AI 課程有沒有興趣?最近在煩惱什麼?適合用什麼方式重新聯絡?"></textarea></label>
    <div class="lf-row" style="margin-top:8px">
      <label class="lf-mute">先從 LINE 多抓 <input id="lf-deepn" type="number" min="10" max="300" value="100" style="width:80px"> 則</label>
      <button class="lf-btn lf-ghost" id="lf-deep">抓更多訊息</button>
      <button class="lf-btn" id="lf-analyze">開始分析</button>
      <span class="lf-mute">會把這位好友已存的 ${f.msg_count} 則訊息傳到 Anthropic</span>
    </div>
    <div id="lf-anres" style="margin-top:12px">${analyses.map(a => `<div style="margin-bottom:12px"><div class="lf-mute">${lfDate(a.created_at)} · 用了 ${a.msg_used} 則 · 重點:${lfEsc(a.instruction)}</div><div class="lf-result">${lfEsc(a.result)}</div></div>`).join('')}</div>
  </div>
  <div class="lf-card"><h3>最近訊息</h3><div class="lf-msgs">${f.messages.map(m => `<div class="lf-msg ${m.sender === 'me' ? 'lf-me' : ''}"><small>${m.sender === 'me' ? '我' : '對方'} · ${lfDate(m.sent_at)}</small>${lfEsc(m.content)}</div>`).join('') || '<div class="lf-empty">尚無訊息</div>'}</div></div>`;
  const msgs = main.querySelector('.lf-msgs'); msgs.scrollTop = msgs.scrollHeight;
  document.getElementById('lf-dsave').onclick = () => lfTry(async () => {
    await lfApi('/api/lf_friends/' + id, { method: 'PATCH', body: {
      lf_category: document.getElementById('lf-dcat').value, lf_note: document.getElementById('lf-dnote').value,
      lf_tag_ids: [...main.querySelectorAll('.lf-dtag:checked')].map(c => +c.value) } });
    lfToast('已儲存');
  });
  document.getElementById('lf-deep').onclick = () => lfTry(async () => {
    await lfApi('/api/lf_deep_fetch/' + id, { method: 'POST', body: { lf_msgs: +document.getElementById('lf-deepn').value } });
    lfToast('已開始抓取,完成後重新整理此頁', 4000);
  });
  document.getElementById('lf-analyze').onclick = () => lfTry(async () => {
    const btn = document.getElementById('lf-analyze'); btn.disabled = true; btn.textContent = '分析中…';
    try {
      const r = await lfApi('/api/lf_analyze/' + id, { method: 'POST', body: { lf_instruction: document.getElementById('lf-inst').value } });
      const a = r.lf_analysis;
      document.getElementById('lf-anres').insertAdjacentHTML('afterbegin', `<div style="margin-bottom:12px"><div class="lf-mute">${lfDate(a.created_at)} · 用了 ${a.msg_used} 則 · 重點:${lfEsc(a.instruction)}</div><div class="lf-result">${lfEsc(a.result)}</div></div>`);
    } finally { btn.disabled = false; btn.textContent = '開始分析'; }
  });
};
