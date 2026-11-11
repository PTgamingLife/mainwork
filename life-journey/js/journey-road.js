// 旅程頁的道路與小人:S 型道路穿過每張卡片另一側的空位,小人隨捲動沿路走,
// 走到卡片旁邊時卡片從路邊跳出來。座標全部現場量,段數每人不同也成立。
(function () {
const $ = (id) => document.getElementById(id);
const svg = $('road'), walker = $('walker'), done = $('rDone');
const roadPaths = ['rShadow', 'rEdge', 'rBody', 'rDash', 'rDone'].map($);
let LEN = 0, STOPS = [], Y0 = 0, Y1 = 0;

// 道路穿過每張卡片「另一側」的空位:卡片在左,路走右;卡片在右,路走左。
// 段數每人不同,所以座標全部現場量,不寫死。
function buildRoad() {
  const W = document.documentElement.clientWidth;
  const H = document.body.scrollHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.height = H + 'px';
  const wl = $('walkerLayer');
  wl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  wl.setAttribute('width', W); wl.setAttribute('height', H);
  wl.style.height = H + 'px';

  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const hero = $('hero'), end = $('end');
  Y0 = top(hero) + hero.offsetHeight * 0.80;
  Y1 = top(end) + end.offsetHeight * 0.52;

  const pts = [{ x: W / 2, y: Y0 }];
  STOPS = [];
  document.querySelectorAll('.stop').forEach(sec => {
    const s = sec.getBoundingClientRect(), c = sec.querySelector('.card');
    // 用版面寬度推算,不能量卡片本身 —— 它還沒跳出來時帶著位移與縮放
    const cardW = c.offsetWidth, onRight = sec.classList.contains('R');
    const gutter = s.width - cardW;
    const x = onRight ? s.left + gutter / 2 : s.right - gutter / 2;
    const y = s.top + scrollY + s.height / 2;
    pts.push({ x, y });
    STOPS.push({ sec, x, y, onRight });
  });
  pts.push({ x: W / 2, y: Y1 });

  // 相鄰兩點用垂直切線的三次貝茲相接,整條路才是連續的 S
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], ym = (a.y + b.y) / 2;
    d += ` C ${a.x} ${ym}, ${b.x} ${ym}, ${b.x} ${b.y}`;
  }
  roadPaths.forEach(p => p.setAttribute('d', d));
  LEN = done.getTotalLength();
  done.style.strokeDasharray = LEN;

  // 每張卡片在路邊立一個小路標
  $('pins').innerHTML = STOPS.map(({ x, y, onRight }) => {
    const dx = onRight ? 30 : -30;
    return `<line x1="${x}" y1="${y}" x2="${x + dx}" y2="${y}" stroke="#fff" stroke-width="2" opacity=".7"/>
            <circle cx="${x + dx}" cy="${y}" r="5" fill="#E07A5F" stroke="#fff" stroke-width="2"/>`;
  }).join('');
  update();
}

// 路上「高度 = y」的那一點。y 沿路單調遞增,二分就找得到。
function lengthAtY(y) {
  let lo = 0, hi = LEN;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    (done.getPointAtLength(mid).y < y) ? (lo = mid) : (hi = mid);
  }
  return lo;
}

function update() {
  if (!LEN) return;
  // 小人固定在畫面中段偏上,是路在腳下往後退 —— 這樣才有「我在走」的感覺
  const y = Math.min(Y1, Math.max(Y0, scrollY + innerHeight * 0.46));
  const L = lengthAtY(y);
  const pt = done.getPointAtLength(L);
  const ahead = done.getPointAtLength(Math.min(LEN, L + 6));
  done.style.strokeDashoffset = LEN - L;

  // 面向路彎過去的方向;腳步跟著捲動距離擺,不捲就站著
  const face = ahead.x >= pt.x ? 1 : -1;
  const swing = Math.sin(scrollY / 13) * 30;
  // 走路時身體跟著腳步微微上下,不然像在路上平移
  const bob = -Math.abs(Math.sin(scrollY / 13)) * 1.6;
  walker.setAttribute('transform', `translate(${pt.x} ${pt.y}) scale(${face * 1.25} 1.25)`);
  $('fig').setAttribute('transform', `translate(0 ${bob})`);
  $('legA').setAttribute('transform', `rotate(${swing} 0 -18)`);
  $('legB').setAttribute('transform', `rotate(${-swing} 0 -18)`);
  $('armA').setAttribute('transform', `rotate(${-swing * 0.8} 0 -33)`);
  $('armB').setAttribute('transform', `rotate(${swing * 0.8} 0 -33)`);
  // 走進夜色,小人換成亮色才看得見
  $('fig').classList.toggle('night', pt.y / document.body.scrollHeight > 0.84);

  // 小人快走到卡片旁邊時,卡片從路邊跳出來(跳出後就留著)
  STOPS.forEach(({ sec, y: sy }) => {
    if (pt.y > sy - innerHeight * 0.30) sec.classList.add('on');
  });
}

addEventListener('scroll', update, { passive: true });
addEventListener('resize', buildRoad);

// 內容由 journey.js 畫好之後才呼叫;照片載入會改變高度,所以每張載完也會再算一次
window.LJ_ROAD = { build: buildRoad };
})();
