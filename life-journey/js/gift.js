// 送一段回憶 / 收到的回憶
(function () {
  const $ = (id) => document.getElementById(id);
  let toCode = '';
  let photo = null;

  // ── 分頁 ──
  function tab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
    $('send').classList.toggle('hidden', name !== 'send');
    $('sent').classList.add('hidden');
    $('inbox').classList.toggle('hidden', name !== 'inbox');
    if (name === 'inbox') loadInbox();
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => tab(t.dataset.tab)));

  // ── 送 ──
  const now = new Date().getFullYear();
  $('year').innerHTML = '<option value="">年份</option>' +
    Array.from({ length: 80 }, (_, i) => `<option>${now - i}</option>`).join('');

  async function lookup() {
    const c = $('code').value.trim().toUpperCase();
    toCode = '';
    sync();
    if (c.length < 4) { $('found').textContent = ''; return; }
    $('found').textContent = '找找看⋯';
    const r = await LJ.api('lookup', { code: c });
    if (c !== $('code').value.trim().toUpperCase()) return;
    if (!r.ok) { $('found').textContent = LJ.say(r.error); return; }
    if (r.isMine) { $('found').textContent = '這是你自己的編號喔'; return; }
    toCode = c;
    $('found').innerHTML = `送給：<b style="font-weight:normal;color:var(--dusk)">${LJ.esc(r.name)}</b>`;
    sync();
  }
  $('code').addEventListener('input', lookup);

  $('file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { photo = await LJ.compress(f); } catch (err) { return LJ.toast(LJ.say(err.message)); }
    $('pick').innerHTML = `<img src="${photo.preview}" alt="">`;
    e.target.value = '';
    sync();
  });

  $('memory').addEventListener('input', () => { $('count').textContent = `${$('memory').value.length} / 500`; sync(); });

  function sync() {
    $('sendBtn').disabled = !(toCode && photo && $('memory').value.trim());
  }

  $('sendBtn').onclick = async () => {
    $('busy').classList.remove('hidden');
    const r = await LJ.api('gift-send', {
      code: toCode, photo: photo.base64, mime: photo.mime, memory: $('memory').value.trim(),
      when: [$('year').value, $('season').value].filter(Boolean).join(' · '),
    });
    $('busy').classList.add('hidden');
    if (!r.ok) return LJ.toast(LJ.say(r.error));
    $('sentMsg').innerHTML = `已經送給 ${LJ.esc(r.to)} 了。<br>等他同意之後，這段回憶就會出現在你們的旅程上。`;
    $('send').classList.add('hidden');
    $('sent').classList.remove('hidden');
  };

  $('again').onclick = () => {
    photo = null; toCode = '';
    $('code').value = ''; $('found').textContent = ''; $('memory').value = ''; $('count').textContent = '0 / 500';
    $('pick').innerHTML = '<span class="plus">＋</span><span>選一張你們的照片</span>';
    sync(); tab('send');
  };

  // ── 收 ──
  async function loadInbox() {
    $('list').innerHTML = '<p class="empty">讀取中⋯</p>';
    const r = await LJ.api('gifts');
    if (!r.ok) { $('list').innerHTML = `<p class="empty">${LJ.esc(LJ.say(r.error))}</p>`; return; }
    $('dot').classList.toggle('hidden', !r.gifts.length);
    if (!r.gifts.length) { $('list').innerHTML = '<p class="empty">還沒有人送回憶給你。<br>也許你可以先送一段給別人。</p>'; return; }
    $('list').innerHTML = r.gifts.map((g) => `
      <div class="card gift" data-id="${LJ.esc(g.id)}">
        <div class="ph">${g.photo ? `<img src="${LJ.esc(g.photo)}" alt="">` : ''}</div>
        <div class="from">來自 ${LJ.esc(g.from)}${g.when ? ' · ' + LJ.esc(g.when) : ''}</div>
        <p class="mem">${LJ.esc(g.memory)}</p>
        <div class="acts">
          <button class="btn btn-soft" data-act="no">婉拒</button>
          <button class="btn btn-main" data-act="yes">同意，放進我們的旅程</button>
        </div>
      </div>`).join('');
    $('list').querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => respond(b)));
  }

  async function respond(btn) {
    const card = btn.closest('.gift');
    const accept = btn.dataset.act === 'yes';
    if (!accept && !confirm('婉拒之後，這段回憶不會出現在任何人的旅程上。確定嗎？')) return;
    card.querySelectorAll('button').forEach((x) => (x.disabled = true));
    const r = await LJ.api('gift-respond', { id: card.dataset.id, accept });
    if (!r.ok) { card.querySelectorAll('button').forEach((x) => (x.disabled = false)); return LJ.toast(LJ.say(r.error)); }
    LJ.toast(accept ? '已經放進你們兩個人的旅程了' : '已婉拒');
    loadInbox();
  }

  $('back').onclick = () => LJ.go('journey.html');

  LJ.boot((me) => {
    $('dot').classList.toggle('hidden', !(me.pendingGifts > 0));
    const pre = (LJ.param('to') || '').toUpperCase();
    if (pre) { $('code').value = pre; lookup(); }
    $('boot').classList.add('hidden');
    tab(LJ.param('tab') === 'inbox' ? 'inbox' : 'send');
  });
})();
