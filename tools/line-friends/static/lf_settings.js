/* lf_ 分類設定:分類、標籤、關鍵字規則、AI 提示詞、同步參數 */
lfPages.settings = async (main) => {
  await lfLoadMeta();
  const rules = await lfApi('/api/lf_meta/rules');
  const s = lfState.settings;
  const catOpts = (v) => lfState.cats.map(c => `<option ${c.name === v ? 'selected' : ''}>${lfEsc(c.name)}</option>`).join('');
  main.innerHTML = `
  <h2>分類設定</h2>
  <div class="lf-card"><h3>分類</h3>
    <table class="lf-table"><thead><tr><th>名稱</th><th>顏色</th><th>改名前綴</th><th>排序</th><th></th></tr></thead><tbody>
    ${lfState.cats.map(c => `<tr data-id="${c.id}"><td><input class="lf-cname" value="${lfEsc(c.name)}"></td>
      <td><input type="color" class="lf-ccolor" value="${lfEsc(c.color)}"></td>
      <td><input class="lf-cpre" value="${lfEsc(c.rename_prefix)}" style="width:80px"></td>
      <td><input type="number" class="lf-csort" value="${c.sort}" style="width:60px"></td>
      <td><button class="lf-btn lf-sm lf-ghost lf-csave">儲存</button> <button class="lf-btn lf-sm lf-ghost lf-cdel">刪除</button></td></tr>`).join('')}
    <tr><td><input id="lf-cnew" placeholder="新分類名稱"></td><td><input type="color" id="lf-cnewc" value="#C9D8C5"></td>
      <td><input id="lf-cnewp" placeholder="【新】" style="width:80px"></td><td></td><td><button class="lf-btn lf-sm" id="lf-cadd">新增</button></td></tr>
    </tbody></table></div>
  <div class="lf-card"><h3>標籤</h3>
    <p class="lf-mute">規則類型:手動 = 只能手動加;關鍵字 = 名稱/狀態/訊息含任一關鍵字(逗號分隔)自動加;AI = 由 AI 依描述判斷。</p>
    <table class="lf-table"><thead><tr><th>名稱</th><th>顏色</th><th>類型</th><th>關鍵字 / AI 描述</th><th></th></tr></thead><tbody>
    ${lfState.tags.map(t => `<tr data-id="${t.id}"><td><input class="lf-tname" value="${lfEsc(t.name)}"></td>
      <td><input type="color" class="lf-tcolor" value="${lfEsc(t.color)}"></td>
      <td><select class="lf-ttype">${[['none', '手動'], ['keyword', '關鍵字'], ['ai', 'AI']].map(([k, v]) => `<option value="${k}" ${k === t.rule_type ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><input class="lf-tval" value="${lfEsc(t.rule_value)}" style="width:100%"></td>
      <td><button class="lf-btn lf-sm lf-ghost lf-tsave">儲存</button> <button class="lf-btn lf-sm lf-ghost lf-tdel">刪除</button></td></tr>`).join('')}
    <tr><td><input id="lf-tnew" placeholder="新標籤"></td><td><input type="color" id="lf-tnewc" value="#B8C5D6"></td>
      <td><select id="lf-tnewt"><option value="none">手動</option><option value="keyword">關鍵字</option><option value="ai">AI</option></select></td>
      <td><input id="lf-tnewv" placeholder="例:保險,理財" style="width:100%"></td><td><button class="lf-btn lf-sm" id="lf-tadd">新增</button></td></tr>
    </tbody></table></div>
  <div class="lf-card"><h3>關鍵字分類規則</h3>
    <p class="lf-mute">由上到下比對,第一條符合的規則生效。另外:超過「沉睡天數」沒聊天 = 沉睡。</p>
    <table class="lf-table"><thead><tr><th>比對欄位</th><th>關鍵字(逗號分隔)</th><th>→ 分類</th><th>啟用</th><th></th></tr></thead><tbody>
    ${rules.map(r => `<tr data-id="${r.id}"><td><select class="lf-rfield">${[['any', '全部'], ['name', '名稱'], ['status', '狀態消息'], ['message', '訊息']].map(([k, v]) => `<option value="${k}" ${k === r.field ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><input class="lf-rpat" value="${lfEsc(r.pattern)}" style="width:100%"></td><td><select class="lf-rcat2">${catOpts(r.category)}</select></td>
      <td><input type="checkbox" class="lf-ren" ${r.enabled ? 'checked' : ''}></td>
      <td><button class="lf-btn lf-sm lf-ghost lf-rsave">儲存</button> <button class="lf-btn lf-sm lf-ghost lf-rdel">刪除</button></td></tr>`).join('')}
    <tr><td><select id="lf-rnewf"><option value="any">全部</option><option value="name">名稱</option><option value="status">狀態消息</option><option value="message">訊息</option></select></td>
      <td><input id="lf-rnewp" placeholder="例:媽,爸,姊" style="width:100%"></td><td><select id="lf-rnewc">${catOpts('')}</select></td><td></td>
      <td><button class="lf-btn lf-sm" id="lf-radd">新增</button></td></tr>
    </tbody></table></div>
  <div class="lf-card"><h3>AI 提示詞與同步參數</h3>
    <label class="lf-field">AI 分類提示詞<textarea id="lf-sprompt">${lfEsc(s.lf_ai_prompt || '')}</textarea></label>
    <div class="lf-row" style="margin-top:10px">
      <label class="lf-field">每批人數<input id="lf-sbatch" type="number" value="${lfEsc(s.lf_batch_size)}" style="width:90px"></label>
      <label class="lf-field">每人則數<input id="lf-smsgs" type="number" value="${lfEsc(s.lf_msgs_per_friend)}" style="width:90px"></label>
      <label class="lf-field">沉睡天數<input id="lf-sdorm" type="number" value="${lfEsc(s.lf_dormant_days)}" style="width:90px"></label>
      <label class="lf-field">間隔秒數(最小~最大)<span><input id="lf-sdmin" type="number" value="${lfEsc(s.lf_delay_min)}" style="width:60px"> ~ <input id="lf-sdmax" type="number" value="${lfEsc(s.lf_delay_max)}" style="width:60px"></span></label>
      <label><input type="checkbox" id="lf-sunread" ${s.lf_skip_unread === '1' ? 'checked' : ''}> 略過有未讀訊息的聊天</label>
    </div>
    <div class="lf-row" style="margin-top:10px"><button class="lf-btn" id="lf-ssave">儲存設定</button></div>
  </div>`;
  const save = (kind, body) => lfTry(async () => { await lfApi('/api/lf_meta/' + kind, { method: 'POST', body }); lfToast('已儲存'); lfPages.settings(main); });
  const del = (kind, id) => lfTry(async () => { if (!confirm('確定刪除?')) return; await lfApi(`/api/lf_meta/${kind}/${id}`, { method: 'DELETE' }); lfPages.settings(main); });
  const q = (tr, c) => tr.querySelector(c);
  main.querySelectorAll('.lf-csave').forEach(b => { const tr = b.closest('tr'); b.onclick = () => save('categories', { id: +tr.dataset.id, name: q(tr, '.lf-cname').value.trim(), color: q(tr, '.lf-ccolor').value, rename_prefix: q(tr, '.lf-cpre').value, sort: +q(tr, '.lf-csort').value }); });
  main.querySelectorAll('.lf-cdel').forEach(b => { b.onclick = () => del('categories', b.closest('tr').dataset.id); });
  document.getElementById('lf-cadd').onclick = () => save('categories', { name: document.getElementById('lf-cnew').value.trim(), color: document.getElementById('lf-cnewc').value, rename_prefix: document.getElementById('lf-cnewp').value, sort: lfState.cats.length });
  main.querySelectorAll('.lf-tsave').forEach(b => { const tr = b.closest('tr'); b.onclick = () => save('tags', { id: +tr.dataset.id, name: q(tr, '.lf-tname').value.trim(), color: q(tr, '.lf-tcolor').value, rule_type: q(tr, '.lf-ttype').value, rule_value: q(tr, '.lf-tval').value }); });
  main.querySelectorAll('.lf-tdel').forEach(b => { b.onclick = () => del('tags', b.closest('tr').dataset.id); });
  document.getElementById('lf-tadd').onclick = () => save('tags', { name: document.getElementById('lf-tnew').value.trim(), color: document.getElementById('lf-tnewc').value, rule_type: document.getElementById('lf-tnewt').value, rule_value: document.getElementById('lf-tnewv').value });
  main.querySelectorAll('.lf-rsave').forEach(b => { const tr = b.closest('tr'); b.onclick = () => save('rules', { id: +tr.dataset.id, field: q(tr, '.lf-rfield').value, pattern: q(tr, '.lf-rpat').value, category: q(tr, '.lf-rcat2').value, enabled: q(tr, '.lf-ren').checked ? 1 : 0 }); });
  main.querySelectorAll('.lf-rdel').forEach(b => { b.onclick = () => del('rules', b.closest('tr').dataset.id); });
  document.getElementById('lf-radd').onclick = () => save('rules', { field: document.getElementById('lf-rnewf').value, pattern: document.getElementById('lf-rnewp').value, category: document.getElementById('lf-rnewc').value, enabled: 1 });
  document.getElementById('lf-ssave').onclick = () => lfTry(async () => {
    const v = (id) => document.getElementById(id).value;
    lfState.settings = await lfApi('/api/lf_settings', { method: 'PUT', body: {
      lf_ai_prompt: v('lf-sprompt'), lf_batch_size: v('lf-sbatch'), lf_msgs_per_friend: v('lf-smsgs'), lf_dormant_days: v('lf-sdorm'),
      lf_delay_min: v('lf-sdmin'), lf_delay_max: v('lf-sdmax'), lf_skip_unread: document.getElementById('lf-sunread').checked ? '1' : '0' } });
    lfToast('設定已儲存');
  });
};
