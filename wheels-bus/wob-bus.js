// wob_bus：卡通公車 SVG + 歌詞段落設定
// wob_verseTimes：每段開始秒數。收到音檔後填入；null = 依歌曲長度平均分配。
const wob_verseTimes = null;

const wob_verses = [
  { key: 'wheels',  line: 'The wheels on the bus go round and round', bubble: '' },
  { key: 'wipers',  line: 'The wipers on the bus go swish, swish, swish', bubble: 'Swish!' },
  { key: 'horn',    line: 'The horn on the bus goes beep, beep, beep', bubble: 'Beep! Beep!' },
  { key: 'doors',   line: 'The doors on the bus go open and shut', bubble: '' },
  { key: 'babies',  line: 'The babies on the bus go wah, wah, wah', bubble: 'Wah~' },
  { key: 'mommies', line: 'The mommies on the bus go shh, shh, shh', bubble: 'Shh…' },
  { key: 'daddies', line: 'The daddies on the bus say I love you', bubble: '♥ I love you' },
];

const wob_bus = (() => {
  const INK = '#1F2A44', GLASS = '#DFF3FF', SKIN = '#FFD9B8';

  function wob_face(cls, x, extra) {
    return `<g class="wob-face ${cls}">
      <circle cx="${x + 22}" cy="68" r="12" fill="${SKIN}" stroke="${INK}" stroke-width="2"/>
      <circle cx="${x + 18}" cy="66" r="1.8" fill="${INK}"/><circle cx="${x + 26}" cy="66" r="1.8" fill="${INK}"/>
      ${extra}</g>`;
  }

  function wob_wheel(cx) {
    return `<g class="wob-wheel">
      <circle cx="${cx}" cy="150" r="27" fill="${INK}"/>
      <circle cx="${cx}" cy="150" r="12" fill="#C9D1DC"/>
      <rect x="${cx - 2}" y="126" width="4" height="48" fill="#C9D1DC"/>
      <rect x="${cx - 24}" y="148" width="48" height="4" fill="#C9D1DC"/>
    </g>`;
  }

  const svg = `<svg viewBox="0 0 400 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="20" y="28" width="340" height="122" rx="20" fill="#FFC21A" stroke="${INK}" stroke-width="4"/>
    <rect x="22" y="104" width="336" height="10" fill="#E8483B"/>
    ${[40, 95, 150, 205].map(x => `<rect x="${x}" y="46" width="45" height="42" rx="6" fill="${GLASS}" stroke="${INK}" stroke-width="3"/>`).join('')}
    ${wob_face('wob-face-kid', 40, `<path d="M56 72 q6 5 12 0" stroke="${INK}" stroke-width="2" fill="none"/>`)}
    ${wob_face('wob-face-baby', 95, `<ellipse cx="117" cy="74" rx="4" ry="5" fill="#E8483B"/>`)}
    ${wob_face('wob-face-mom', 150, `<path d="M160 60 q12 -14 24 0" stroke="#7A4A2A" stroke-width="5" fill="none"/><rect x="171" y="70" width="2" height="9" fill="${INK}"/>`)}
    ${wob_face('wob-face-dad', 205, `<path d="M219 74 q8 6 16 0" stroke="${INK}" stroke-width="2" fill="none"/><text x="236" y="60" font-size="14" fill="#E8483B">♥</text>`)}
    <rect x="258" y="46" width="36" height="100" rx="4" fill="${INK}"/>
    <rect class="wob-door wob-door-l" x="259" y="47" width="17" height="98" fill="${GLASS}" stroke="${INK}" stroke-width="2"/>
    <rect class="wob-door wob-door-r" x="276" y="47" width="17" height="98" fill="${GLASS}" stroke="${INK}" stroke-width="2"/>
    <rect x="300" y="46" width="52" height="50" rx="8" fill="${GLASS}" stroke="${INK}" stroke-width="3"/>
    <g class="wob-wiper"><line x1="325" y1="92" x2="325" y2="56" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></g>
    <circle cx="350" cy="128" r="8" fill="#FFF3B0" stroke="${INK}" stroke-width="2"/>
    <circle class="wob-horn" cx="364" cy="108" r="6" fill="#E8483B" stroke="${INK}" stroke-width="2"/>
    ${wob_wheel(95)}${wob_wheel(290)}
  </svg>`;

  let bubbleEl, sceneEl, current = '';

  return {
    mount(busEl, bubble, scene) {
      busEl.innerHTML = svg;
      bubbleEl = bubble;
      sceneEl = scene;
    },
    // 依目前秒數回傳段落 index
    verseAt(t, duration) {
      const times = wob_verseTimes || wob_verses.map((_, i) => (duration / wob_verses.length) * i);
      let idx = 0;
      for (let i = 0; i < times.length; i++) if (t >= times[i]) idx = i;
      return idx;
    },
    setVerse(idx) {
      const v = wob_verses[idx];
      if (!v || v.key === current) return v;
      wob_verses.forEach(x => sceneEl.classList.remove(`wob-verse-${x.key}`));
      sceneEl.classList.add(`wob-verse-${v.key}`);
      bubbleEl.textContent = v.bubble;
      bubbleEl.classList.toggle('is-on', !!v.bubble);
      current = v.key;
      return v;
    },
    reset() {
      current = '';
      wob_verses.forEach(x => sceneEl.classList.remove(`wob-verse-${x.key}`));
      bubbleEl.classList.remove('is-on');
    },
  };
})();
