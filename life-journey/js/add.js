// 增加我的生命之旅:照片 + 3 個問題 → AI 寫標題與故事 → 改字 / 重生成(3 次)→ 存進旅程。
// 題目是我先擬的(使用者只定了「每次三題」),要改直接改下面這個陣列,後端不用動。
(function () {
  const $ = (id) => document.getElementById(id);

  const LJ_STOP_Q = [
    { id: 'moment', text: '這張照片，是你人生中的哪個時刻？', free: true,
      placeholder: '例如：剛離職那段時間，每天早上在窗邊喝咖啡' },
    { id: 'keep', text: '這張照片裡，你最想記住的是什麼？',
      options: ['一個人', '一種心情', '一個決定', '一個地方'] },
    { id: 'gave', text: '現在回頭看，這段時間帶給你什麼？',
      options: ['勇氣', '學會放下', '被陪伴的感覺', '更清楚自己要什麼'] },
  ];

  let photo = null;          // { base64, mime, preview }
  const ans = {};            // { id: { picked: [], other: '' } }
  let stop = null;           // AI 寫好的草稿

  // ── 時間 ──
  const now = new Date().getFullYear();
  $('year').innerHTML = '<option value="">年份</option>' +
    Array.from({ length: 80 }, (_, i) => `<option>${now - i}</option>`).join('');
  const whenLabel = () => [$('year').value, $('season').value].filter(Boolean).join(' · ');

  // ── 題目 ──
  $('qs').innerHTML = LJ_STOP_Q.map((q) => `
    <div class="q" data-q="${q.id}"><h3>${q.text}</h3>
      ${q.free ? `<textarea class="field" rows="3" maxlength="120" placeholder="${q.placeholder}"></textarea>`
        : `<div class="opts">${q.options.map((o) => `<button class="opt" data-v="${o}">${o}</button>`).join('')}
             <button class="opt other" data-other="1">其他，我想自己說</button></div>
           <textarea class="field hidden" rows="2" maxlength="120" placeholder="寫下你自己的答案" style="margin-top:8px"></textarea>`}
    </div>`).join('');

  LJ_STOP_Q.forEach((q) => {
    const box = document.querySelector(`[data-q="${q.id}"]`);
    const ta = box.querySelector('textarea');
    ans[q.id] = { picked: [], other: '' };
    ta.addEventListener('input', () => { ans[q.id].other = ta.value.trim(); sync(); });
    box.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      box.querySelectorAll('.opt').forEach((x) => x.classList.toggle('sel', x === b));
      const other = !!b.dataset.other;
      ans[q.id].picked = other ? [] : [b.dataset.v];
      ta.classList.toggle('hidden', !other);
      if (other) ta.focus(); else { ta.value = ''; ans[q.id].other = ''; }
      sync();
    }));
  });

  function sync() {
    const done = LJ_STOP_Q.every((q) => ans[q.id].picked.length || ans[q.id].other);
    $('write').disabled = !(photo && done);
  }

  // ── 照片:手機上先壓縮再送 ──
  $('file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      photo = await LJ.compress(f);
    } catch (err) {
      return LJ.toast(LJ.say(err.message));
    }
    // 檔案輸入框在 label 外面,換照片時只換預覽,點預覽一樣會再叫出選照片
    $('pick').innerHTML = `<img src="${photo.preview}" alt=""><span class="change">換一張</span>`;
    e.target.value = '';   // 同一張再選一次也要觸發
    sync();
  });

  // ── 請 AI 寫 ──
  const MSG = ['正在看你的照片⋯', '正在讀你的回答⋯', '正在寫下這一段⋯', '快好了⋯'];
  async function busy(fn) {
    let k = 0;
    $('busyMsg').textContent = MSG[0];
    $('busy').classList.remove('hidden');
    const t = setInterval(() => { $('busyMsg').textContent = MSG[++k % MSG.length]; }, 2600);
    try { return await fn(); } finally { clearInterval(t); $('busy').classList.add('hidden'); }
  }

  $('write').onclick = async () => {
    const answers = LJ_STOP_Q.map((q) => ({ question: q.text, picked: ans[q.id].picked, other: ans[q.id].other }));
    const r = await busy(() => LJ.api('stop-create', {
      photo: photo.base64, mime: photo.mime, when: whenLabel(), answers,
    }));
    if (!r.ok) return LJ.toast(LJ.say(r.error));
    show(r.stop);
  };

  function show(s) {
    stop = s;
    $('rPhoto').src = s.photo || (photo && photo.preview) || '';
    $('rTitle').textContent = s.title;
    $('rStory').textContent = s.story;
    const out = s.regenLeft <= 0;
    $('regen').disabled = out;
    $('regen').textContent = out ? '重新生成（已用完）' : `重新生成（剩 ${s.regenLeft} 次）`;
    $('left').textContent = out ? '已用完 3 次，可以直接修改上面的文字' : '';
    $('form').classList.add('hidden');
    $('result').classList.remove('hidden');
    scrollTo(0, 0);
  }

  $('regen').onclick = async () => {
    if (!stop || stop.regenLeft <= 0) return;
    const r = await busy(() => LJ.api('stop-regen', { id: stop.id }));
    if (!r.ok) return LJ.toast(LJ.say(r.error));
    show(r.stop);
  };

  $('save').onclick = async () => {
    const title = $('rTitle').textContent.trim(), story = $('rStory').textContent.trim();
    if (!title || !story) return LJ.toast('標題和故事不能是空的喔');
    $('save').disabled = true;
    const r = await LJ.api('stop-save', { id: stop.id, title, story });
    $('save').disabled = false;
    if (!r.ok) return LJ.toast(LJ.say(r.error));
    LJ.go('journey.html');
  };

  $('discard').onclick = async () => {
    if (!confirm('確定不要這一段嗎？照片和文字都會刪掉。')) return;
    await LJ.api('stop-delete', { id: stop.id });
    LJ.go('journey.html');
  };

  $('back').onclick = () => LJ.go('journey.html');

  LJ.boot((me) => {
    if (!(me.profile && me.profile.status === 'final')) return LJ.go('quiz.html');   // 先認識自己
    $('boot').classList.add('hidden');
  });
})();
