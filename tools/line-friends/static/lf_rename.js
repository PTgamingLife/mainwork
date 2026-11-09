/* lf_ 改名分頁:提案 → 勾選確認 → 執行。只有已確認的項目會被改。 */
const lfRen = { filter: '', sel: new Set() };

lfPages.rename = async (main) => {
  main.innerHTML = `
  <h2>改名(修改 LINE 顯示名稱)</h2>
  <div class="lf-warnbox">這是本工具<b>唯一會修改 LINE</b> 的功能。改的是「你自己看到的顯示名稱」,對方看不到。
    流程:① 在好友總覽勾選好友 →「產生改名提案」 ② 在這裡逐筆檢查、勾選 →「確認勾選項目」 ③ 勾選同意後按「執行已確認」。舊名稱會保留,可以還原。</div>
  <div class="lf-card" style="margin-top:14px">
    <h3>依分類快速產生提案</h3>
    <div class="lf-row">
      <select id="lf-rcat">${lfState.cats.map(c => `<option>${lfEsc(c.name)}</option>`).join('')}</select>
      <label class="lf-field">範本({prefix}=分類前綴、{name}=目前名稱)<input id="lf-rtpl" value="{prefix}{name}" style="width:200px"></label>
      <button class="lf-btn lf-ghost" id="lf-rgen">為這個分類全部好友產生提案</button>
    </div>
    <p class="lf-mute">分類前綴在「分類設定」修改。LINE 顯示名稱上限 20 字,超過會截斷。</p>
  </div>
  <div class="lf-card">
    <div class="lf-tabs" id="lf-rtabs">${[['', '全部'], ['pending', '待確認'], ['confirmed', '已確認'], ['done', '已完成'], ['failed', '失敗']]
      .map(([k, v]) => `<button data-k="${k}" class="${k === lfRen.filter ? 'lf-on' : ''}">${v}</button>`).join('')}</div>
    <div class="lf-row" style="margin-bottom:10px">
      <span class="lf-mute" id="lf-rsel">已勾選 0 筆</span>
      <button class="lf-btn lf-sm" id="lf-rconfirm">確認勾選項目</button>
      <button class="lf-btn lf-sm lf-ghost" id="lf-runconfirm">取消確認</button>
      <button class="lf-btn lf-sm lf-ghost" id="lf-rcancel">刪除提案</button>
    </div>
    <div id="lf-rtable"></div>
  </div>
  <div class="lf-card">
    <h3>執行</h3>
    <div class="lf-row">
      <label><input type="checkbox" id="lf-rack"> 我已逐筆檢查,確認要修改 LINE 顯示名稱</label>
      <label class="lf-mute">本次最多 <input id="lf-rlimit" type="number" min="1" max="100" value="30" style="width:70px"> 筆</label>
      <button class="lf-btn lf-danger" id="lf-rrun" disabled>執行已確認的改名(<span id="lf-rcount">0</span> 筆)</button>
    </div>
    <p class="lf-mute">執行前請先在「同步」頁開啟 LINE 並登入。每筆之間會隨機間隔數秒。</p>
  </div>`;
  main.querySelectorAll('#lf-rtabs button').forEach(b => b.onclick = () => { lfRen.filter = b.dataset.k; lfRen.sel.clear(); lfPages.rename(main); });
  document.getElementById('lf-rgen').onclick = () => lfTry(async () => {
    const cat = document.getElementById('lf-rcat').value;
    const ids = []; let page = 1;
    for (;;) {
      const d = await lfApi('/api/lf_friends?' + new URLSearchParams({ lf_category: cat, lf_per: 500, lf_page: page }));
      ids.push(...d.lf_rows.map(r => r.id)); if (ids.length >= d.lf_total || !d.lf_rows.length) break; page++;
    }
    if (!ids.length) throw new Error('這個分類沒有好友');
    const r = await lfApi('/api/lf_renames/propose', { method: 'POST', body: { lf_ids: ids, lf_template: document.getElementById('lf-rtpl').value } });
    lfToast(`已產生 ${r.lf_made} 筆提案(略過 ${r.lf_skipped} 筆已有前綴)`); lfRenRender();
  });
  const act = (url, msg) => lfTry(async () => {
    if (!lfRen.sel.size) throw new Error('請先勾選');
    await lfApi(url, { method: 'POST', body: { lf_ids: [...lfRen.sel] } }); lfRen.sel.clear(); lfToast(msg); lfRenRender(); });
  document.getElementById('lf-rconfirm').onclick = () => act('/api/lf_renames/confirm', '已確認');
  document.getElementById('lf-runconfirm').onclick = () => act('/api/lf_renames/unconfirm', '已改回待確認');
  document.getElementById('lf-rcancel').onclick = () => act('/api/lf_renames/cancel', '已刪除提案');
  const ack = document.getElementById('lf-rack'), run = document.getElementById('lf-rrun');
  ack.onchange = () => { run.disabled = !ack.checked || !+document.getElementById('lf-rcount').textContent; };
  run.onclick = () => lfTry(async () => {
    const n = Math.min(+document.getElementById('lf-rcount').textContent, +document.getElementById('lf-rlimit').value);
    if (!confirm(`即將在 LINE 修改 ${n} 位好友的顯示名稱。確定執行?`)) return;
    const r = await lfApi('/api/lf_renames/run', { method: 'POST', body: { lf_ack: true, lf_limit: +document.getElementById('lf-rlimit').value } });
    lfToast(`已開始改名 ${r.lf_count} 筆,進度可在「同步」頁查看`, 4000); ack.checked = false; run.disabled = true;
  });
  await lfRenRender();
};

async function lfRenRender() {
  const box = document.getElementById('lf-rtable'); if (!box) return;
  const all = await lfApi('/api/lf_renames');
  const rows = lfRen.filter ? all.filter(r => r.status === lfRen.filter) : all;
  const conf = all.filter(r => r.status === 'confirmed').length;
  document.getElementById('lf-rcount').textContent = conf;
  document.getElementById('lf-rrun').disabled = !document.getElementById('lf-rack').checked || !conf;
  const stName = { pending: '待確認', confirmed: '已確認', done: '已完成', failed: '失敗' };
  if (!rows.length) { box.innerHTML = '<div class="lf-empty">沒有改名提案。到「好友總覽」勾選好友後按「產生改名提案」。</div>'; return; }
  box.innerHTML = `<table class="lf-table"><thead><tr><th><input type="checkbox" id="lf-rall"></th><th>目前名稱</th><th>新名稱</th><th>分類</th><th>狀態</th><th></th></tr></thead><tbody>
  ${rows.map(r => `<tr>
    <td>${r.status === 'done' ? '' : `<input type="checkbox" class="lf-rck" data-id="${r.id}" ${lfRen.sel.has(r.id) ? 'checked' : ''}>`}</td>
    <td>${lfEsc(r.old_name)}</td>
    <td>${r.status === 'done' ? lfEsc(r.new_name) : `<input class="lf-rnew" data-id="${r.id}" value="${lfEsc(r.new_name)}" maxlength="20" style="width:190px">`}</td>
    <td>${lfCatBadge(r.category)}</td>
    <td><span class="lf-st ${r.status}">${stName[r.status] || r.status}</span>${r.error ? `<div class="lf-mute">${lfEsc(r.error)}</div>` : ''}</td>
    <td>${r.status === 'done' ? `<button class="lf-btn lf-sm lf-ghost lf-rrev" data-id="${r.id}">還原</button>` : ''}</td></tr>`).join('')}
  </tbody></table>`;
  const upd = () => { document.getElementById('lf-rsel').textContent = `已勾選 ${lfRen.sel.size} 筆`; };
  box.querySelectorAll('.lf-rck').forEach(c => c.onchange = () => { c.checked ? lfRen.sel.add(+c.dataset.id) : lfRen.sel.delete(+c.dataset.id); upd(); });
  document.getElementById('lf-rall').onchange = (e) => { box.querySelectorAll('.lf-rck').forEach(c => { c.checked = e.target.checked; c.checked ? lfRen.sel.add(+c.dataset.id) : lfRen.sel.delete(+c.dataset.id); }); upd(); };
  box.querySelectorAll('.lf-rnew').forEach(i => i.onchange = () => lfTry(async () => {
    await lfApi('/api/lf_renames/edit', { method: 'POST', body: { lf_id: +i.dataset.id, lf_new_name: i.value } });
    lfToast('已修改,需重新勾選確認'); lfRenRender(); }));
  box.querySelectorAll('.lf-rrev').forEach(b => b.onclick = () => lfTry(async () => {
    const r = await lfApi('/api/lf_renames/revert', { method: 'POST', body: { lf_id: +b.dataset.id } }); lfToast(r.lf_message); lfRenRender(); }));
  upd();
}
