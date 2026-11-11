// 自我探索問答:歡迎 → 6 題 →(AI 判斷)最多 2 題追問 → 整理中 → 結果確認 → 完成。
// 規則(使用者確認):
// - 不存進度,中途離開下次從頭開始
// - 結果每一段都能直接改字,按「就用這版」就定稿,不經 AI
// - 第一次生成不算;「重新生成」與「補充後重寫」合計每人 3 次(後端把關),自己改字不限
(function () {
  const $ = (id) => document.getElementById(id);
  const D = window.LJ_QUIZ;

  let lj_steps = [];      // 這一輪要問的題目(核心 6 題,AI 判斷後再接追問)
  let lj_idx = 0;
  let lj_answers = {};    // { q1: { choice, labels, other } }
  let lj_followDone = false;
  let lj_regenLeft = 3;
  let lj_busy = false;

  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    scrollTo(0, 0);
  }

  // ── 題目 ──
  function resolve(step) {
    if (step.id !== 'q2') return step;
    const q1 = lj_answers.q1;
    const b = q1 && q1.choice !== null ? step.branches[q1.choice] : step.fallback;
    return Object.assign({ id: 'q2' }, b);
  }

  function renderQuestion() {
    const step = resolve(lj_steps[lj_idx]);
    const isFollow = lj_idx >= D.core.length;
    $('count').textContent = isFollow ? '' : `第 ${lj_idx + 1} 題 / ${D.core.length}`;
    $('more').classList.toggle('hidden', !isFollow);
    $('back').style.visibility = lj_idx === 0 ? 'hidden' : 'visible';
    $('qText').textContent = step.text;
    $('qSub').textContent = step.multi ? `${step.sub}・已選 ${countSel(step)} / ${step.multi}` : '';
    drawProgress();

    const prev = lj_answers[step.id] || {};
    const box = $('qOpts');
    box.className = step.multi ? 'grid' : 'opts';
    box.innerHTML = '';
    step.options.forEach((label, i) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = label;
      if (step.multi ? (prev.labels || []).includes(label) : prev.choice === i) b.classList.add('sel');
      b.onclick = () => pick(step, i, label, b);
      box.appendChild(b);
    });
    const o = document.createElement('button');
    o.className = 'opt other' + (prev.other !== undefined && prev.other !== null ? ' sel' : '');
    o.textContent = '其他，我想自己說';
    o.onclick = () => pickOther(step, o);
    box.appendChild(o);

    const t = $('other');
    const openOther = prev.other !== undefined && prev.other !== null;
    t.classList.toggle('hidden', !openOther);
    t.value = openOther ? prev.other : '';
    t.oninput = () => { ans(step).other = t.value; syncNext(step); };
    syncNext(step);
  }

  function ans(step) {
    return (lj_answers[step.id] = lj_answers[step.id] || { choice: null, labels: [], other: null });
  }
  function countSel(step) {
    const a = lj_answers[step.id];
    return a ? a.labels.length + (a.other !== null ? 1 : 0) : 0;
  }

  function pick(step, i, label, btn) {
    const a = ans(step);
    if (step.multi) {
      const on = a.labels.includes(label);
      if (!on && countSel(step) >= step.multi) return;     // 滿三項就不能再選
      a.labels = on ? a.labels.filter((x) => x !== label) : a.labels.concat(label);
      btn.classList.toggle('sel', !on);
      $('qSub').textContent = `${step.sub}・已選 ${countSel(step)} / ${step.multi}`;
      syncNext(step);
      return;
    }
    // 單選:點了就記下並自動往下一題
    a.choice = i; a.labels = [label]; a.other = null;
    document.querySelectorAll('#qOpts .opt').forEach((x) => x.classList.toggle('sel', x === btn));
    $('other').classList.add('hidden');
    setTimeout(advance, 320);
  }

  function pickOther(step, btn) {
    const a = ans(step);
    if (!step.multi) { a.choice = null; a.labels = []; }
    if (a.other === null) {
      if (step.multi && countSel(step) >= step.multi) return;
      a.other = '';
    } else if (step.multi) {
      a.other = null;                                     // 複選題可以再點一次取消
    }
    document.querySelectorAll('#qOpts .opt').forEach((x) => {
      if (!step.multi) x.classList.toggle('sel', x === btn);
    });
    if (step.multi) btn.classList.toggle('sel', a.other !== null);
    $('other').classList.toggle('hidden', a.other === null);
    if (a.other !== null) $('other').focus();
    if (step.multi) $('qSub').textContent = `${step.sub}・已選 ${countSel(step)} / ${step.multi}`;
    syncNext(step);
  }

  // 「下一步」只在需要時出現:複選題、或選了「其他」要寫字
  function syncNext(step) {
    const a = lj_answers[step.id];
    const writing = a && a.other !== null;
    $('next').classList.toggle('hidden', !(step.multi || writing));
    let ok = true;
    if (step.multi) ok = countSel(step) > 0;
    if (writing) ok = ok && a.other.trim().length > 0;
    $('next').disabled = !ok;
  }

  // 送給後端的格式:題目原文 + 選了什麼 + 自己說的
  function payload() {
    return lj_steps.map((st) => {
      const step = resolve(st);
      const a = lj_answers[step.id] || { labels: [], other: null };
      return { question: step.text, picked: a.labels, other: a.other || '' };
    });
  }

  async function advance() {
    if (lj_busy) return;
    lj_idx++;
    if (lj_idx === D.core.length && !lj_followDone) {
      // 核心 6 題答完:請 AI 判斷要不要追問。失敗就跳過追問,不卡住使用者
      lj_busy = true;
      wait(true, '再想想要不要多問你一題⋯');
      const r = await LJ.api('quiz-followup', { answers: payload() });
      wait(false);
      lj_busy = false;
      lj_followDone = true;
      const extra = (r.ok ? r.questions : []).slice(0, 2)
        .map((q, i) => ({ id: 'f' + (i + 1), text: q.text, options: q.options }));
      lj_steps = lj_steps.concat(extra);
    }
    if (lj_idx >= lj_steps.length) return generate('quiz-generate', { answers: payload() });
    renderQuestion();
  }

  function wait(on, msg) {
    $('miniWait').classList.toggle('hidden', !on);
    if (msg) $('miniWaitMsg').textContent = msg;
  }

  function drawProgress() {
    const n = lj_followDone ? lj_steps.length : D.core.length;
    const W = 340, y = (x) => 34 + Math.sin((x / W) * Math.PI * 2) * 9;
    let d = 'M 12 ' + y(12);
    for (let x = 16; x <= W - 12; x += 4) d += ` L ${x} ${y(x)}`;
    const xs = Array.from({ length: n }, (_, i) => 12 + (i * (W - 24)) / Math.max(1, n - 1));
    const cur = xs[Math.min(lj_idx, n - 1)];
    $('prog').innerHTML = `
      <path d="${d}" fill="none" stroke="#B9A57C" stroke-width="11" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#F1E3C4" stroke-width="8" stroke-linecap="round"/>
      ${xs.map((x, i) => `<circle cx="${x}" cy="${y(x)}" r="3.2" fill="${i <= lj_idx ? '#E07A5F' : '#fff'}"/>`).join('')}
      <g transform="translate(${cur} ${y(cur) + 2}) scale(.55)"><use href="#fig"/></g>`;
  }

  // ── 整理中 → 結果 ──
  const LOAD_MSG = ['正在讀你的回答⋯', '正在找你的故事⋯', '正在寫下來⋯', '快好了⋯'];
  async function generate(action, body) {
    const from = document.querySelector('.screen.on').id;
    show('loading');
    let k = 0;
    $('loadMsg').textContent = LOAD_MSG[0];
    const t = setInterval(() => { $('loadMsg').textContent = LOAD_MSG[++k % LOAD_MSG.length]; }, 2500);
    const r = await LJ.api(action, body);
    clearInterval(t);
    if (!r.ok) {
      show(from === 'loading' ? 'ask' : from);
      if (from === 'ask' || from === 'loading') { lj_idx = lj_steps.length - 1; renderQuestion(); }
      LJ.toast(LJ.say(r.error));
      return;
    }
    fill(r.profile);
    show('result');
  }

  function fill(p) {
    $('rTag').textContent = p.tagline;
    $('rStory').textContent = p.story;
    $('rLights').innerHTML = '';
    (p.highlights || []).forEach((x) => { const li = document.createElement('li'); li.textContent = x; $('rLights').appendChild(li); });
    $('rFuture').textContent = p.future;
    $('rNote').textContent = p.note;
    lj_regenLeft = p.regenLeft;
    document.querySelectorAll('.fb .btn').forEach((b) => b.classList.remove('sel'));
    $('pPart').classList.add('hidden');
    $('pNot').classList.add('hidden');
    $('more2').value = '';
    syncLeft();
  }

  function syncLeft() {
    const out = lj_regenLeft <= 0;
    $('regen').disabled = out;
    $('rewrite').disabled = out;
    $('regen').textContent = out ? '重新生成（已用完）' : `重新生成（剩 ${lj_regenLeft} 次）`;
    $('rewrite').textContent = out ? '請 AI 重寫（已用完）' : `請 AI 重寫（剩 ${lj_regenLeft} 次）`;
    $('left').textContent = out ? '已用完 3 次，可以直接修改上面的文字' : '';
  }

  // 現在畫面上的文字(含使用者改過的)就是最終版
  async function finalize() {
    const lights = [...$('rLights').querySelectorAll('li')].map((li) => li.textContent.trim()).filter(Boolean);
    $('useIt').disabled = true;
    const r = await LJ.api('profile-save', {
      tagline: $('rTag').textContent.trim(), story: $('rStory').textContent.trim(),
      highlights: lights, future: $('rFuture').textContent.trim(), note: $('rNote').textContent.trim(),
    });
    $('useIt').disabled = false;
    if (!r.ok) return LJ.toast(r.error === 'TEXT_REQUIRED' ? '標語和介紹不能是空的喔' : LJ.say(r.error));
    show('done');
  }

  // ── 綁定 ──
  LJ.boot((me) => {
    if (me.profile && me.profile.status === 'final') return LJ.go('journey.html');   // 已經認識過自己了
    $('who').textContent = me.member.name || '你';
    $('boot').classList.add('hidden');
    show('welcome');
  });

  $('start').onclick = () => {
    lj_steps = D.core.slice(); lj_idx = 0; lj_answers = {}; lj_followDone = false;
    show('ask'); renderQuestion();
  };
  $('back').onclick = () => {
    if (lj_idx === 0 || lj_busy) return;
    lj_idx--;
    // 退回核心題就把追問收掉:改了答案,要不要追問、問什麼都可能不同
    if (lj_idx < D.core.length && lj_followDone) { lj_followDone = false; lj_steps = D.core.slice(); }
    renderQuestion();
  };
  $('next').onclick = advance;
  document.querySelectorAll('.fb .btn').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.fb;
      if (k === 'love') return finalize();
      document.querySelectorAll('.fb .btn').forEach((x) => x.classList.toggle('sel', x === b));
      $('pPart').classList.toggle('hidden', k !== 'part');
      $('pNot').classList.toggle('hidden', k !== 'not');
      syncLeft();
    };
  });
  $('regen').onclick = () => { if (lj_regenLeft > 0) generate('quiz-generate', { answers: payload() }); };
  $('rewrite').onclick = () => {
    const extra = $('more2').value.trim();
    if (!extra) { $('more2').focus(); return; }
    if (lj_regenLeft > 0) generate('quiz-rewrite', { extra });
  };
  $('useIt').onclick = finalize;
  $('goJourney').onclick = () => LJ.go('journey.html');
  $('goAdd').onclick = () => LJ.go('add.html');
})();
