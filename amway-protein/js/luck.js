// 刮刮樂:今天的健康運勢。純娛樂,不加分、不進資料庫。
//
// 兩層疊加:下層是結果,上層 canvas 塗層用 destination-out 刮掉才露出來。
// 一天只能刮一次,結果記在 localStorage(沒有分數,不需要後端把關)。
(function () {
  const $ = (id) => document.getElementById(id);
  const KEY = 'amp_luck_v1';

  // 文案是使用者定的,不要自己改字
  const PRIZES = [
    { id: 'big',   title: '大吉',       text: '很好!代表你的蛋白質量,允許你去喝杯珍奶', weight: 10 },
    { id: 'small', title: '小吉',       text: '不錯!不錯!可以再來兩匙蛋白素加強一下!!', weight: 30 },
    { id: 'tiny',  title: '小小小小吉', text: '一定是有人讓你不舒服!趕快來兩匙蛋白素補一下!', weight: 35 },
    { id: 'baby',  title: '吉吉吉吉',   text: 'baby,baby~~', weight: 25 },
  ];

  const todayTaipei = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

  function draw() {
    let r = Math.random() * 100; // weight 加總 = 100
    for (const p of PRIZES) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return PRIZES[PRIZES.length - 1];
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && s.date === todayTaipei() ? s : null;
    } catch (e) { return null; }
  }

  function save(prizeId, revealed) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ date: todayTaipei(), prizeId, revealed }));
    } catch (e) { /* 無痕模式寫不進去也無所謂,只是刮完重整會重來 */ }
  }

  let ctx = null, prize = null, revealed = false, drawing = false;

  function showPrize(p) {
    $('prizeTitle').textContent = p.title;
    $('prizeText').textContent = p.text;
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    $('scratchCanvas').style.opacity = '0';
    $('luckHint').textContent = '今天刮過了,明天再來';
    $('luckAgain').classList.remove('hidden');
    save(prize.id, true);
  }

  // 塗層:銀灰 + 一排金元寶,刮之前就看得出是刮刮樂
  function paintCover(cv) {
    const w = cv.width, h = cv.height;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#E4E7E2');
    g.addColorStop(0.5, '#B9C2BA');
    g.addColorStop(1, '#8F9C92');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(h * 0.13)}px sans-serif`;
    ctx.fillText('刮我', w / 2, h / 2 - h * 0.04);
    ctx.font = `${Math.round(h * 0.075)}px sans-serif`;
    ctx.fillText('用手指刮開', w / 2, h / 2 + h * 0.09);
  }

  function scratchAt(x, y, r) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; // 用完就還原,別影響後面的繪圖
  }

  function clearedPct(cv) {
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let t = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 128) t++;
    return t / (cv.width * cv.height);
  }

  // getBoundingClientRect 的尺寸跟 canvas 實際像素不同(DPR),要換算
  function toCanvasXY(cv, clientX, clientY) {
    const rect = cv.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (cv.width / rect.width),
      y: (clientY - rect.top) * (cv.height / rect.height),
    };
  }

  function setup() {
    const cv = $('scratchCanvas');
    const cell = $('scratchCell');
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Retina 不模糊,但也不要無上限
    const rect = cell.getBoundingClientRect();
    if (rect.width === 0) return false;

    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    ctx = cv.getContext('2d', { willReadFrequently: true });
    paintCover(cv);
    cell.classList.add('canvas-ready'); // 塗層畫好才拿掉防閃爍的 ::before
    return true;
  }

  window.AMP.loadLuck = function () {
    const saved = load();
    prize = saved
      ? (PRIZES.find((p) => p.id === saved.prizeId) || draw())
      : draw();
    showPrize(prize);
    revealed = false;

    if (!setup()) { setTimeout(() => window.AMP.loadLuck(), 60); return; }

    if (saved && saved.revealed) {
      reveal();
    } else {
      $('luckHint').textContent = '用手指刮開塗層';
      $('luckAgain').classList.add('hidden');
      $('scratchCanvas').style.opacity = '1';
      save(prize.id, false); // 先把今天的結果定下來,重整不會換一個
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const cv = $('scratchCanvas');
    const radius = () => Math.max(18, cv.width * 0.075);

    function move(clientX, clientY) {
      if (!ctx || revealed) return;
      const { x, y } = toCanvasXY(cv, clientX, clientY);
      scratchAt(x, y, radius());
      if (clearedPct(cv) > 0.55) reveal(); // 55% 體感最順
    }

    cv.addEventListener('mousedown', (e) => { drawing = true; move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { drawing = false; });
    cv.addEventListener('mousemove', (e) => { if (drawing) move(e.clientX, e.clientY); });

    // passive:false 才能 preventDefault,否則手機刮的時候整頁跟著捲
    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    $('luckAgain').addEventListener('click', () => window.AMP.go('board'));
  });
})();
