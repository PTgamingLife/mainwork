// 每日問答:全隊每天同一題,每人每天只能答一次,答對 +1。
(function () {
  const $ = (id) => document.getElementById(id);
  let current = null;

  function paint(q, result) {
    const esc = window.AMP.esc;
    $('quizQ').textContent = q.text;
    $('quizOptions').innerHTML = q.options.map((opt, i) => {
      let cls = '';
      if (result) {
        if (i === result.answer) cls = 'is-right';
        else if (i === result.chosen) cls = 'is-wrong';
      }
      return `<button class="quiz-opt ${cls}" data-i="${i}" ${result ? 'disabled' : ''}>${esc(opt)}</button>`;
    }).join('');

    const box = $('quizResult');
    if (result) {
      box.classList.remove('hidden');
      box.innerHTML = (result.correct ? '<b>答對了 +1 分!</b><br>' : '<b>答錯了,明天再來。</b><br>')
        + esc(result.explanation || '');
    } else {
      box.classList.add('hidden');
      box.innerHTML = '';
      $('quizOptions').querySelectorAll('.quiz-opt').forEach((btn) => {
        btn.addEventListener('click', () => answer(Number(btn.dataset.i)));
      });
    }
  }

  async function answer(i) {
    $('quizOptions').querySelectorAll('.quiz-opt').forEach((b) => { b.disabled = true; });
    const data = await window.AMP.api('quiz-answer', { chosenIndex: i });
    if (!data.ok) {
      if (data.error === 'ALREADY_ANSWERED') {
        window.AMP.toast('今天已經答過囉,明天再來');
        return window.AMP.loadQuiz();
      }
      window.AMP.toast('送出失敗:' + (data.error || '未知錯誤'));
      return window.AMP.loadQuiz();
    }
    window.AMP.applyState(data);
    paint(current, { chosen: i, answer: data.answer, correct: data.correct, explanation: data.explanation });
    if (data.correct) window.AMP.toast(`答對 +1 分!目前 ${data.totalPoints} 分`);
  }

  window.AMP.loadQuiz = async function () {
    $('quizQ').textContent = '載入中…';
    $('quizOptions').innerHTML = '';
    $('quizResult').classList.add('hidden');

    const data = await window.AMP.api('quiz-today');
    if (!data.ok) {
      $('quizQ').textContent = data.error === 'NO_QUESTION' ? '題庫還沒建立。' : '載入失敗,請稍後再試。';
      return;
    }
    current = data.question;
    paint(data.question, data.answered ? data.result : null);
  };
})();
