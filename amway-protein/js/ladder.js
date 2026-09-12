// 爬梯子(鬼腳圖):抽你的命定蛋白素口味。純娛樂不加分。
//
// 規則就是鬼腳圖本身:五條直線 + 隨機橫桿,從選定的起點往下走,
// 碰到橫桿就橫向移到隔壁那條再繼續往下。五個起點對到五個終點,不會重複。
//
// 一天一次由後端的 amp_plays unique(member_id, game, play_date) 把關;
// 前端先問 game-open,玩過了就只把結果顯示出來,不讓他再選。
(function () {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';

  // 文案是使用者定的,不要自己改字、不要改順序
  const PRIZES = ['原味', '草莓口味', '巧克力口味', '關鍵行動力', '抹茶口味'];

  const N = PRIZES.length;
  const W = 500, H = 620;
  const TOP = 70, BOTTOM = 520;      // 直線的上下端
  const COL = (i) => 50 + i * ((W - 100) / (N - 1));
  const ROWS = 9;                     // 橫桿可以出現的高度層數
  const ROW_Y = (r) => TOP + (r + 1) * ((BOTTOM - TOP) / (ROWS + 1));

  let rungs = [];      // [{row, left}] left = 左邊那條的 index
  let busy = false;
  let locked = false;  // 今天玩過了

  // 每層隨機放橫桿,同一層不相鄰(相鄰會變成同時往兩邊跳,鬼腳圖不能這樣)
  function makeRungs() {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      const used = [];
      for (let c = 0; c < N - 1; c++) {
        if (Math.random() < 0.45 && !used.includes(c - 1)) {
          out.push({ row: r, left: c });
          used.push(c);
        }
      }
    }
    return out;
  }

  // 從起點走到終點,回傳沿途的轉折點(給動畫用)
  function walk(start) {
    let col = start;
    const pts = [[COL(col), TOP]];
    for (let r = 0; r < ROWS; r++) {
      const y = ROW_Y(r);
      const right = rungs.find((g) => g.row === r && g.left === col);
      const left = rungs.find((g) => g.row === r && g.left === col - 1);
      if (right || left) {
        const to = right ? col + 1 : col - 1;
        pts.push([COL(col), y], [COL(to), y]);
        col = to;
      }
    }
    pts.push([COL(col), BOTTOM]);
    return { pts, end: col };
  }

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function render() {
    const svg = $('ladderSvg');
    svg.innerHTML = '';

    // 直線
    for (let c = 0; c < N; c++) {
      svg.appendChild(el('line', {
        x1: COL(c), y1: TOP, x2: COL(c), y2: BOTTOM,
        stroke: '#C8A24A', 'stroke-width': 4, 'stroke-linecap': 'round',
      }));
    }
    // 橫桿
    for (const g of rungs) {
      svg.appendChild(el('line', {
        x1: COL(g.left), y1: ROW_Y(g.row), x2: COL(g.left + 1), y2: ROW_Y(g.row),
        stroke: '#C8A24A', 'stroke-width': 4, 'stroke-linecap': 'round',
      }));
    }
    // 走過的路徑(動畫畫在這條上)
    svg.appendChild(el('path', {
      id: 'ladderPath', fill: 'none', stroke: '#E8546B',
      'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));

    // 起點按鈕與終點文字
    for (let c = 0; c < N; c++) {
      const g = el('g', { class: 'ladder-start', 'data-col': c, tabindex: '0', role: 'button' });
      g.appendChild(el('circle', { cx: COL(c), cy: TOP - 28, r: 20, fill: '#00703C', stroke: '#fff', 'stroke-width': 3 }));
      const t = el('text', { x: COL(c), y: TOP - 21, 'text-anchor': 'middle', fill: '#fff', 'font-size': 20 });
      t.textContent = String(c + 1);
      g.appendChild(t);
      g.addEventListener('click', () => pick(c));
      svg.appendChild(g);

      const lab = el('text', {
        x: COL(c), y: BOTTOM + 34, 'text-anchor': 'middle',
        fill: '#F7F5EE', 'font-size': 17, class: 'ladder-label', 'data-col': c,
      });
      lab.textContent = PRIZES[c];
      svg.appendChild(lab);
    }
  }

  function drawPath(pts) {
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ' ' + p[1]).join(' ');
    const path = $('ladderPath');
    path.setAttribute('d', d);
    const len = path.getTotalLength();
    path.style.transition = 'none';
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    // 強制 reflow,不然瀏覽器會把上下兩次 style 合併,動畫不會跑
    void path.getBoundingClientRect();
    path.style.transition = 'stroke-dashoffset 2.2s ease-in-out';
    path.style.strokeDashoffset = '0';
    return 2300;
  }

  function reveal(name) {
    $('ladderResultName').textContent = name;
    $('ladderResult').classList.remove('hidden');
    $('ladderHint').textContent = '今天玩過了,明天再來';
    const idx = PRIZES.indexOf(name);
    const lab = document.querySelector('.ladder-label[data-col="' + idx + '"]');
    if (lab) lab.classList.add('is-win');
  }

  async function pick(col) {
    if (busy || locked) return;
    busy = true;
    $('ladderHint').textContent = '走走看⋯⋯';
    document.querySelectorAll('.ladder-start').forEach((g) => g.classList.add('is-off'));

    const { pts, end } = walk(col);
    const ms = drawPath(pts);
    await new Promise((r) => setTimeout(r, ms));

    const name = PRIZES[end];
    const data = await window.AMP.api('game-record', { game: 'ladder', result: name });
    // 後端說今天已經玩過(例如同時連按),以後端那筆為準
    const shown = (data && data.ok && data.result) ? data.result : name;
    locked = true;
    reveal(shown);
    busy = false;
  }

  // 五個起點各自走到哪(只算終點,給保底用)
  function endsOf(gs) {
    const saved = rungs;
    rungs = gs;
    const out = [];
    for (let c = 0; c < N; c++) out.push(walk(c).end);
    rungs = saved;
    return out;
  }

  // 完全沒交換的排列大約 2.7% 會出現(1→1、2→2⋯),玩起來像壞掉,重抽掉它
  function makeRungsNoIdentity() {
    for (let i = 0; i < 20; i++) {
      const g = makeRungs();
      if (endsOf(g).some((e, idx) => e !== idx)) return g;
    }
    return makeRungs();
  }

  window.AMP.loadLadder = function () {
    rungs = makeRungsNoIdentity();
    locked = false;
    busy = false;
    $('ladderResult').classList.add('hidden');
    $('ladderHint').textContent = '選一條路,從上面開始往下走';
    render();

    window.AMP.api('game-open', { game: 'ladder' }).then((d) => {
      if (d && d.ok && d.done) {
        locked = true;
        document.querySelectorAll('.ladder-start').forEach((g) => g.classList.add('is-off'));
        reveal(d.result);
      }
    });
  };
})();
