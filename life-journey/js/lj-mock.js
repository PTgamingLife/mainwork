// 生命之旅 — 離線試玩用的假後端(網址加 ?mock=1)。
// 資料存在瀏覽器的 localStorage,AI 的部分換成寫死的範例,用來在電腦上走完整條流程。
// 動作與回傳格式跟 lj-api 一致;規則(3 次上限、先認識自己再紀錄)也照做。
(function () {
  const KEY = 'lj_mock_v1';
  const REGEN_MAX = 3;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Math.random().toString(36).slice(2, 10);

  // 兩個假的其他旅人:用來試「看別人」與「收到回憶」
  const SEED = () => ({
    me: { name: '小安', code: 'K7M2' },
    profile: null,
    stops: [],
    others: {
      R8QX: { name: '阿哲', profile: { tagline: '先出發，路會自己長出來', story: '我習慣先動手，邊做邊學。', highlights: [], future: '', note: '' }, stops: [] },
      W3TN: { name: '小晴', profile: null, stops: [] },
    },
    gifts: [{ id: 'g1', from: '阿哲', fromCode: 'R8QX', when: '2024 · 夏', photo: swatch('#C97B63', '#E8A989'),
              memory: '那年一起爬合歡山，你說累了，結果還是第一個到山頂。' }],
  });
  function swatch(a, b) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || SEED(); } catch (e) { return SEED(); } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));

  const SAMPLES = [
    { tagline: '我用慢一點的方式，把日子走成自己的樣子',
      story: '安靜下來的時間對我很重要，那時候才聽得見自己在想什麼。遇到沒做過的事，我習慣先看一陣子，確定適合再動——走得慢，但很少後悔。朋友難過時會想到我，大概是因為我願意聽完，不急著給答案。',
      highlights: ['懂得替自己留白，知道什麼時候該停下來', '傾聽，讓身邊的人覺得被理解', '做決定前先看清楚，很少衝動後悔'],
      future: '未來三年，我想要多一點能自己安排的時間，把力氣留給真正在乎的人跟事。', note: '你不用跑得比誰快，繼續走就好' },
    { tagline: '安靜是我的充電方式，陪伴是我的出發點',
      story: '從回答裡看見，我似乎很需要一個人的時間，但不是為了逃開誰，而是為了回來時更有力氣陪人。我喜歡先弄懂再開始；朋友難過時，我會是願意坐下來聽的那個人。',
      highlights: ['獨處時把自己重新充飽', '在別人需要時，願意停下來陪', '用觀察代替衝動，穩穩前進'],
      future: '我希望三年後的生活更平靜、自由一點，身邊有幾個可以說真話的人，每一天都是自己選的。', note: '慢慢來，比較快' },
  ];
  const STOP_SAMPLES = [
    { title: '那年我把鬧鐘關掉，才發現世界沒有因此塌下來', story: '那個早上我睡到自然醒，沒有人找我，也沒有事要交。現在回頭看，那一天讓我開始學著替自己留一點空白。' },
    { title: '窗邊那杯咖啡涼了，我也終於想清楚了一件事', story: '照片裡的光很安靜，就像那段時間的我。我花了很久才承認，慢一點不是落後，是我的步調。' },
  ];

  const profileOut = (p) => p && Object.assign({}, p, { regenLeft: REGEN_MAX - (p.regen || 0) });
  const stopOut = (s) => Object.assign({}, s, { regenLeft: REGEN_MAX - (s.regen || 0) });

  window.LJ_MOCK = async function (action, b) {
    const s = load();
    const ok = (x) => Object.assign({ ok: true }, x || {});
    const err = (e) => ({ ok: false, error: e });

    if (action === 'me') {
      return ok({ member: { name: s.me.name, code: s.me.code, avatar: '' },
        profile: s.profile ? { status: s.profile.status } : null,
        stopCount: s.stops.filter((x) => x.status === 'final').length, pendingGifts: s.gifts.length, ai: true });
    }
    if (action === 'quiz-followup') {
      await wait(900);
      const q5 = (b.answers || [])[4] || { picked: [] };
      const tension = q5.picked.includes('自由與自主') && q5.picked.includes('穩定與安全感');
      return ok({ questions: tension ? [{ text: '如果有一個很棒的新機會，但需要改變原本熟悉的生活，你會怎麼考慮？',
        options: ['先想會失去什麼', '先想能得到什麼', '先問身邊重要的人的想法', '給自己一段時間觀察再決定'] }] : [] });
    }
    if (action === 'quiz-generate' || action === 'quiz-rewrite') {
      if (s.profile && s.profile.status === 'final') return err('ALREADY_FINAL');
      if (s.profile && (s.profile.regen || 0) >= REGEN_MAX) return err('REGEN_LIMIT');
      if (action === 'quiz-rewrite' && !String(b.extra || '').trim()) return err('EXTRA_REQUIRED');
      await wait(1800);
      const n = s.profile ? (s.profile.regen || 0) + 1 : 0;
      s.profile = Object.assign({}, SAMPLES[n % 2], { status: 'draft', regen: n });
      save(s);
      return ok({ profile: profileOut(s.profile) });
    }
    if (action === 'profile-save') {
      if (!s.profile) return err('NO_DRAFT');
      Object.assign(s.profile, { tagline: b.tagline, story: b.story, highlights: b.highlights,
                                 future: b.future, note: b.note, status: 'final' });
      save(s);
      return ok({ profile: profileOut(s.profile) });
    }
    if (action === 'journey' || action === 'lookup') {
      const code = String(b.code || '').toUpperCase();
      if (code && code !== s.me.code && !s.others[code]) return err('NO_SUCH_CODE');
      const mine = !code || code === s.me.code;
      const o = mine ? { name: s.me.name, profile: s.profile, stops: s.stops } : s.others[code];
      if (action === 'lookup') return ok({ name: o.name, isMine: mine });
      return ok({ isMine: mine, member: { name: o.name, code: mine ? s.me.code : code },
        profile: o.profile && (o.profile.status === 'final' || !mine) ? profileOut(o.profile) : null,
        stops: o.stops.filter((x) => x.status === 'final').map(stopOut),
        pendingGifts: mine ? s.gifts.length : 0 });
    }
    if (action === 'stop-create') {
      if (!s.profile || s.profile.status !== 'final') return err('NO_PROFILE');
      await wait(1800);
      const t = STOP_SAMPLES[s.stops.length % 2];
      const st = { id: uid(), source: 'self', when: b.when || '', status: 'draft', regen: 0,
                   photo: 'data:' + b.mime + ';base64,' + b.photo, title: t.title, story: t.story };
      s.stops.push(st); save(s);
      return ok({ stop: stopOut(st) });
    }
    if (action === 'stop-regen' || action === 'stop-save' || action === 'stop-delete') {
      const st = s.stops.find((x) => x.id === b.id);
      if (!st) return err('NO_SUCH_STOP');
      if (action === 'stop-delete') { s.stops = s.stops.filter((x) => x !== st); save(s); return ok(); }
      if (action === 'stop-save') { Object.assign(st, { title: b.title, story: b.story, status: 'final' }); save(s); return ok({ stop: stopOut(st) }); }
      if ((st.regen || 0) >= REGEN_MAX) return err('REGEN_LIMIT');
      await wait(1500);
      st.regen = (st.regen || 0) + 1;
      Object.assign(st, STOP_SAMPLES[st.regen % 2]); save(s);
      return ok({ stop: stopOut(st) });
    }
    if (action === 'gift-send') {
      const code = String(b.code || '').toUpperCase();
      if (code === s.me.code) return err('SELF_GIFT');
      if (!s.others[code]) return err('NO_SUCH_CODE');
      if (!String(b.memory || '').trim()) return err('MEMORY_REQUIRED');
      await wait(700);
      return ok({ to: s.others[code].name });
    }
    if (action === 'gifts') return ok({ gifts: s.gifts });
    if (action === 'gift-respond') {
      const g = s.gifts.find((x) => x.id === b.id);
      if (!g) return err('NO_SUCH_GIFT');
      s.gifts = s.gifts.filter((x) => x !== g);
      if (b.accept) s.stops.push({ id: uid(), source: 'gift', when: g.when, status: 'final', regen: 0,
                                   photo: g.photo, title: `來自 ${g.from} 的回憶`, story: g.memory });
      save(s);
      return ok({ accepted: !!b.accept });
    }
    return err('UNKNOWN_ACTION');
  };

  // 測試時重設:?mock=1&reset=1
  if (new URLSearchParams(location.search).has('reset')) localStorage.removeItem(KEY);
})();
