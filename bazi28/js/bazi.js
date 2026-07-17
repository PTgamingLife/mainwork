// BaZi (四柱八字) Calculation Engine
// Simplified solar calendar method — precise for self-discovery purposes

window.BAZI = (function () {
  const STEMS    = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const ELEMENTS = ['木','火','土','金','水'];

  // Five-element index per stem (0=Wood 1=Fire 2=Earth 3=Metal 4=Water)
  const STEM_ELEM = [0,0,1,1,2,2,3,3,4,4];
  // Yin(1) / Yang(0) per stem
  const STEM_YIN  = [0,1,0,1,0,1,0,1,0,1];
  // Main-qi element per branch
  const BRANCH_ELEM = [4,2,0,0,2,1,1,2,3,3,2,4];

  // Hidden stems (藏干) per branch [main, middle, remainder]
  const BRANCH_HIDDEN = [
    [8],      // 子: 壬
    [5,9,7],  // 丑: 己,癸,辛
    [0,2,4],  // 寅: 甲,丙,戊
    [1],      // 卯: 乙
    [4,1,9],  // 辰: 戊,乙,癸
    [2,4,6],  // 巳: 丙,戊,庚
    [3,5],    // 午: 丁,己
    [5,3,1],  // 未: 己,丁,乙
    [6,8,4],  // 申: 庚,壬,戊
    [7],      // 酉: 辛
    [4,7,3],  // 戌: 戊,辛,丁
    [8,0],    // 亥: 壬,甲
  ];

  // Proleptic Gregorian → Julian Day Number
  function toJD(year, month, day) {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y +
           Math.floor(y / 4) - Math.floor(y / 100) +
           Math.floor(y / 400) - 32045;
  }

  function calcPillars(year, month, day, hour) {
    // Year pillar — 1984 = 甲子
    const yearStem   = ((year - 4) % 10 + 10) % 10;
    const yearBranch = ((year - 4) % 12 + 12) % 12;

    // Month pillar
    // Branch: Jan→丑(1), Feb→寅(2), …, Dec→子(0)
    const monthBranch = month % 12;
    const baseMS = [2,4,6,8,0][yearStem % 5];
    const monthStem = (baseMS + (monthBranch - 2 + 12) % 12) % 10;

    // Day pillar — reference: Jan 1 1900 = 甲戌 (stem=0, branch=10)
    const jd = toJD(year, month, day);
    const dayStem   = (jd + 9) % 10;
    const dayBranch = (jd + 1) % 12;

    // Hour pillar
    const hourBranch = Math.floor((hour + 1) / 2) % 12;
    const baseHS = [0,2,4,6,8][dayStem % 5];
    const hourStem = (baseHS + hourBranch) % 10;

    return { yearStem, yearBranch, monthStem, monthBranch, dayStem, dayBranch, hourStem, hourBranch };
  }

  function calcEnergyProfile(p) {
    const selfElem = STEM_ELEM[p.dayStem];
    const selfYin  = STEM_YIN[p.dayStem];

    // Group relative to Day Master:
    // 0=比劫(same) 1=食傷(self generates) 2=財(self controls)
    // 3=官殺(controls self) 4=印(generates self)
    const getGroup = (elem) => (elem - selfElem + 5) % 5;

    const scores = [0,0,0,0,0];

    // Stems (weight 2 each), skip Day Stem (self)
    [[p.yearStem,2],[p.monthStem,2],[p.hourStem,2]].forEach(([s,w]) => {
      scores[getGroup(STEM_ELEM[s])] += w;
    });

    // Branch main-qi (weight 3)
    [[p.yearBranch,3],[p.monthBranch,3],[p.dayBranch,3],[p.hourBranch,3]].forEach(([b,w]) => {
      scores[getGroup(BRANCH_ELEM[b])] += w;
    });

    // Hidden stems (weight 1)
    [p.yearBranch, p.monthBranch, p.dayBranch, p.hourBranch].forEach(b => {
      BRANCH_HIDDEN[b].forEach(hs => { scores[getGroup(STEM_ELEM[hs])] += 1; });
    });

    const total = scores.reduce((a,b) => a + b, 0);
    const percents = scores.map(s => Math.round(s / total * 100));

    // Fix rounding drift
    const d = 100 - percents.reduce((a,b) => a + b, 0);
    percents[percents.indexOf(Math.max(...percents))] += d;

    return { selfElem, selfYin, dayStem: p.dayStem, scores, percents, elementName: ELEMENTS[selfElem] };
  }

  // Personality types by Day-Master element
  const MASTER_TYPES = [
    { name:'成長型', elem:'木', icon:'🌿', color:'#27AE60',
      desc:'像一棵向光生長的樹——你充滿方向感與生命力，天生具有規劃力和適應力。在挑戰中，你總能找到新的成長路徑。' },
    { name:'光芒型', elem:'火', icon:'🔥', color:'#E74C3C',
      desc:'像燃燒的火焰——你的熱情有感染力，善於表達，能照亮身邊的人。你天生擅長激勵他人，在舞台上閃耀。' },
    { name:'穩固型', elem:'土', icon:'⛰️', color:'#E67E22',
      desc:'像大地一樣厚實可靠——你有深厚的包容力，是別人眼中最穩定的支柱。你踏實、有耐心，善於厚積薄發。' },
    { name:'精準型', elem:'金', icon:'⚡', color:'#8E44AD',
      desc:'像精鋼一樣有原則——你追求卓越、注重細節，有強烈的是非觀和執行力。你的決斷力在關鍵時刻讓你脫穎而出。' },
    { name:'流動型', elem:'水', icon:'🌊', color:'#2980B9',
      desc:'像深邃的流水——你的智慧和洞察力令人驚嘆。你靈活善思，能在複雜局面中找到最佳路徑。直覺和適應力是你最大的資產。' },
  ];

  function getDayMasterType(selfElem) { return MASTER_TYPES[selfElem]; }

  function formatPillars(p) {
    return {
      year:  STEMS[p.yearStem]  + BRANCHES[p.yearBranch],
      month: STEMS[p.monthStem] + BRANCHES[p.monthBranch],
      day:   STEMS[p.dayStem]   + BRANCHES[p.dayBranch],
      hour:  STEMS[p.hourStem]  + BRANCHES[p.hourBranch],
    };
  }

  function calculate(year, month, day, hour) {
    const pillars    = calcPillars(year, month, day, hour);
    const profile    = calcEnergyProfile(pillars);
    const masterType = getDayMasterType(profile.selfElem);
    const formatted  = formatPillars(pillars);
    return { pillars, profile, masterType, formatted };
  }

  // Build SVG pentagon radar chart
  function buildRadarSVG(percents, colors) {
    const cx = 100, cy = 105, r = 72;
    const pts = (scale) => [0,1,2,3,4].map(i => {
      const a = -Math.PI/2 + i * 2 * Math.PI / 5;
      const s = scale[i] / 100;
      return [cx + r * s * Math.cos(a), cy + r * s * Math.sin(a)];
    });
    const bg  = pts([100,100,100,100,100]);
    const bg2 = pts([60,60,60,60,60]);
    const fill = pts(percents);
    const labs = [0,1,2,3,4].map(i => {
      const a = -Math.PI/2 + i * 2 * Math.PI / 5;
      return [cx + (r + 22) * Math.cos(a), cy + (r + 22) * Math.sin(a)];
    });
    const icons = ['🔥','✨','💎','🌍','📚'];
    const polyStr = (arr) => arr.map(p => p.join(',')).join(' ');
    return `<svg viewBox="0 0 200 210" class="radar-svg">
      <polygon points="${polyStr(bg)}"  fill="rgba(201,168,76,0.06)" stroke="rgba(201,168,76,0.25)" stroke-width="1"/>
      <polygon points="${polyStr(bg2)}" fill="none" stroke="rgba(201,168,76,0.15)" stroke-width="1" stroke-dasharray="3,3"/>
      <polygon points="${polyStr(fill)}" fill="rgba(201,168,76,0.22)" stroke="#C9A84C" stroke-width="2"/>
      ${fill.map((p,i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${colors[i]}" stroke="#FFF8EE" stroke-width="2"/>`).join('')}
      ${labs.map((p,i) => `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="middle" font-size="16">${icons[i]}</text>`).join('')}
    </svg>`;
  }

  return { calculate, getDayMasterType, buildRadarSVG, STEMS, BRANCHES, ELEMENTS };
})();
