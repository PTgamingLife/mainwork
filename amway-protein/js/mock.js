// 離線試玩用的假後端(?mock=1)。
//
// 存在的理由:LIFF 只能在 LINE 裡跑,但版面、計分規則、必填名字、答題、戳
// 這些邏輯要能在電腦上先驗完再上線。資料放 localStorage,重整不會消失。
// 正式環境不會走到這個檔案(AMP_CONFIG.MOCK 為 false)。
(function () {
  const KEY = 'amp_mock_v1';
  const POINTS = { eat: 1, share: 3, refer: 5, quiz: 1, wish: 3 };
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

  const QUESTIONS = [
    {
      id: 'q1', seq: 1, text: '蛋白質在人體最主要的功能是什麼?',
      options: ['建造與修補肌肉、皮膚等身體組織', '作為最主要的快速能量來源', '幫助鈣質沉積形成骨骼', '提供膳食纖維幫助排便'],
      answer: 0, explanation: '蛋白質是身體的建材,肌肉、皮膚、頭髮、酵素、抗體都靠它建造與修補。',
    },
    {
      id: 'q2', seq: 2, text: '營養學說的「完全蛋白質」是指?',
      options: ['脂肪含量為零的蛋白質', '含有全部九種必需胺基酸的蛋白質', '完全由植物製成的蛋白質', '不含碳水化合物的蛋白質'],
      answer: 1, explanation: '完全蛋白質 = 九種必需胺基酸都齊全,身體才能有效利用。',
    },
  ];

  const SEED_MATES = [
    { memberId: 'm2', name: '雅婷', avatar: '', points: 21 },
    { memberId: 'm3', name: '建宏', avatar: '', points: 14 },
    { memberId: 'm4', name: '淑芬', avatar: '', points: 8 },
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 隱私模式讀不到就重新開始 */ }
    const start = today();
    return { start, actions: [], answers: {}, pokes: [], mates: SEED_MATES };
  }

  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 忽略 */ }
  }

  function myPoints(s) {
    return s.actions.reduce((n, a) => n + a.points, 0);
  }

  function streak(s) {
    const set = new Set(s.actions.map((a) => a.date));
    const d = new Date(today() + 'T00:00:00Z');
    if (!set.has(today())) d.setUTCDate(d.getUTCDate() - 1);
    let n = 0;
    while (set.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  }

  // 今日排行(mock 的 mates 分數就當成今天的)
  function board(s) {
    const t = today();
    const myToday = s.actions.filter((a) => a.date === t).reduce((n, a) => n + a.points, 0);
    const rows = s.mates.concat([{ memberId: 'me', name: '我', avatar: '', points: myToday }]);
    rows.sort((a, b) => b.points - a.points);
    return rows.map((r, i) => Object.assign({ rank: i + 1 }, r));
  }

  function todayPoints(s) {
    const t = today();
    return s.actions.filter((a) => a.date === t).reduce((n, a) => n + a.points, 0);
  }

  function me(s) {
    const t = today();
    const mine = s.actions.filter((a) => a.date === t);
    const rows = board(s);
    const end = new Date(s.start + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + 20);
    return {
      ok: true,
      member: { id: 'me', name: '測試夥伴', avatar: '' },
      round: { id: 'r1', name: '安麗蛋白素挑戰', start: s.start, end: end.toISOString().slice(0, 10) },
      today: t,
      totalPoints: myPoints(s),
      todayPoints: todayPoints(s),
      rank: rows.find((r) => r.memberId === 'me').rank,
      activeDays: new Set(s.actions.map((a) => a.date)).size,
      streak: streak(s),
      todayCounts: {
        eat: mine.filter((a) => a.type === 'eat').length,
        refer: mine.filter((a) => a.type === 'refer').length,
        share: mine.filter((a) => a.type === 'share').length,
        quiz: mine.filter((a) => a.type === 'quiz').length,
      },
      quizAnsweredToday: Boolean(s.answers[t]),
      wish: (() => {
        const w = s.actions.find((a) => a.type === 'wish');
        return { done: !!w, target: w ? w.target : '' };
      })(),
      recent: s.actions.slice().reverse().slice(0, 20)
        .map((a) => ({ date: a.date, type: a.type, points: a.points, target: a.target })),
    };
  }

  function questionOfToday(s) {
    const days = Math.max(0, Math.round(
      (Date.parse(today() + 'T00:00:00Z') - Date.parse(s.start + 'T00:00:00Z')) / 86400000,
    ));
    return QUESTIONS[days % QUESTIONS.length];
  }

  window.AMP_MOCK = async function (action, payload) {
    const s = load();
    const t = today();

    if (action === 'me') return me(s);

    if (action === 'leaderboard') {
      // 賽季累計差距(mock 的 mates 分數同時當累計用)
      const seasonTop = Math.max(myPoints(s), ...s.mates.map((m) => m.points));
      const gap = Math.max(0, seasonTop - myPoints(s));
      return {
        ok: true, me: 'me', today: today(), rows: board(s),
        season: { mine: myPoints(s), top: seasonTop, gap: gap, days: Math.ceil(gap / 10) },
      };
    }

    if (action === 'add-action') {
      const type = payload.type;
      const target = (payload.targetName || '').trim();
      if (['refer', 'share', 'wish'].includes(type) && !target) return { ok: false, error: 'TARGET_REQUIRED' };
      // 限時任務整輪只能一次,真的那一支是靠資料庫的 unique index 擋
      if (type === 'wish' && s.actions.some((a) => a.type === 'wish')) {
        return { ok: false, error: 'ALREADY_WISHED' };
      }
      s.actions.push({ date: t, type, points: POINTS[type], target });
      save(s);
      return Object.assign({ gained: POINTS[type] }, me(s));
    }

    if (action === 'quiz-today') {
      const q = questionOfToday(s);
      const done = s.answers[t];
      return {
        ok: true,
        question: { id: q.id, seq: q.seq, text: q.text, options: q.options },
        answered: Boolean(done),
        result: done
          ? { chosen: done.chosen, correct: done.correct, answer: q.answer, explanation: q.explanation }
          : null,
      };
    }

    if (action === 'quiz-answer') {
      const q = questionOfToday(s);
      if (s.answers[t]) return { ok: false, error: 'ALREADY_ANSWERED' };
      const correct = payload.chosenIndex === q.answer;
      s.answers[t] = { chosen: payload.chosenIndex, correct: correct };
      if (correct) s.actions.push({ date: t, type: 'quiz', points: POINTS.quiz, target: '' });
      save(s);
      return Object.assign(
        { correct: correct, answer: q.answer, explanation: q.explanation, gained: correct ? 1 : 0 },
        me(s),
      );
    }

    if (action === 'poke') {
      const mate = s.mates.find((m) => m.memberId === payload.toMemberId);
      if (!mate) return { ok: false, error: 'NO_MEMBER' };
      s.pokes.push({ to: payload.toMemberId, at: Date.now() });
      save(s);
      return { ok: true, target: mate.name };
    }

    return { ok: false, error: 'UNKNOWN_ACTION' };
  };
})();
