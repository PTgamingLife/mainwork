// 十神修行錄 — 排盤引擎(無外部依賴)
// 節氣用簡化天文公式(Meeus 低精度太陽黃經),精度約數分鐘。

export const SG_STEMS = "甲乙丙丁戊己庚辛壬癸";
export const SG_BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const SG_STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]; // 木火土金水

// 地支藏干:[干序, 權重]
const SG_HIDDEN = [
  [[9, 1]],                         // 子 癸
  [[5, 0.6], [9, 0.3], [7, 0.1]],   // 丑 己癸辛
  [[0, 0.6], [2, 0.3], [4, 0.1]],   // 寅 甲丙戊
  [[1, 1]],                         // 卯 乙
  [[4, 0.6], [1, 0.3], [9, 0.1]],   // 辰 戊乙癸
  [[2, 0.6], [4, 0.3], [6, 0.1]],   // 巳 丙戊庚
  [[3, 0.7], [5, 0.3]],             // 午 丁己
  [[5, 0.6], [3, 0.3], [1, 0.1]],   // 未 己丁乙
  [[6, 0.6], [8, 0.3], [4, 0.1]],   // 申 庚壬戊
  [[7, 1]],                         // 酉 辛
  [[4, 0.6], [7, 0.3], [3, 0.1]],   // 戌 戊辛丁
  [[8, 0.7], [0, 0.3]],             // 亥 壬甲
];

// 十神 key:[同陰陽, 異陰陽],依「與日干的五行關係」0同 1我生 2我剋 3剋我 4生我
const SG_GOD_BY_REL = [
  ["bi_jian", "jie_cai"],
  ["shi_shen", "shang_guan"],
  ["pian_cai", "zheng_cai"],
  ["qi_sha", "zheng_guan"],
  ["pian_yin", "zheng_yin"],
];

export const SG_GOD_KEYS = [
  "bi_jian", "jie_cai", "shi_shen", "shang_guan", "zheng_cai",
  "pian_cai", "zheng_guan", "qi_sha", "zheng_yin", "pian_yin",
];

const sgMod = (n, m) => ((n % m) + m) % m;
const sgRad = (d) => (d * Math.PI) / 180;

// 公曆 → 儒略日(UT)
function sgJulianDay(y, mo, d, h = 0) {
  if (mo <= 2) { y -= 1; mo += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + h / 24 + b - 1524.5;
}

// 太陽視黃經(度)
export function sgSunLongitude(jd) {
  const t = (jd - 2451545) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(sgRad(m))
    + (0.019993 - 0.000101 * t) * Math.sin(sgRad(2 * m))
    + 0.000289 * Math.sin(sgRad(3 * m));
  const omega = 125.04 - 1934.136 * t;
  return sgMod(l0 + c - 0.00569 - 0.00478 * Math.sin(sgRad(omega)), 360);
}

// 距離最近的「節」(每 30° 一個,立春 315°)還有幾小時,用於邊界提醒
function sgHoursToNearestJie(jd) {
  const lon = sgSunLongitude(jd);
  const off = sgMod(lon - 315, 30); // 已過本節多少度
  const deg = Math.min(off, 30 - off);
  return deg / 0.9856 * 24; // 太陽每天約走 0.9856°
}

const sgPillar = (stem, branch) => ({ stem, branch, text: SG_STEMS[stem] + SG_BRANCHES[branch] });

/**
 * @param {{year:number, month:number, day:number, hour:number|null, minute?:number, tz?:number}} input
 * hour 為 null 表示不知道時辰
 */
export function sgCalcChart(input) {
  const { year, month, day } = input;
  const hourKnown = input.hour !== null && input.hour !== undefined;
  const hour = hourKnown ? input.hour : 12;
  const minute = input.minute || 0;
  const tz = input.tz ?? 8;
  if (!(year >= 1900 && year <= 2100) || !(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) {
    throw new Error("sg_invalid_date");
  }
  const jdUT = sgJulianDay(year, month, day, hour + minute / 60 - tz);
  const lon = sgSunLongitude(jdUT);

  // 年柱:以立春(315°)換年
  const beforeLichun = month <= 2 && (lon < 315 && lon > 270);
  const yIdx = sgMod(year - (beforeLichun ? 1 : 0) - 4, 60);
  const yearP = sgPillar(yIdx % 10, yIdx % 12);

  // 月柱:寅月始於立春,每 30° 一月
  const mIdx = Math.floor(sgMod(lon - 315, 360) / 30); // 0=寅
  const mBranch = sgMod(mIdx + 2, 12);
  const mStem = sgMod((yearP.stem % 5) * 2 + 2 + mIdx, 10);
  const monthP = sgPillar(mStem, mBranch);

  // 日柱:23:00 後算隔日
  const dayShift = hourKnown && hour >= 23 ? 1 : 0;
  const jdn = Math.floor(sgJulianDay(year, month, day, 12)) + dayShift;
  const dIdx = sgMod(jdn + 49, 60);
  const dayP = sgPillar(dIdx % 10, dIdx % 12);

  // 時柱
  let hourP = null;
  if (hourKnown) {
    const hBranch = Math.floor((hour + 1) / 2) % 12;
    hourP = sgPillar(sgMod((dayP.stem % 5) * 2 + hBranch, 10), hBranch);
  }

  return {
    sg_pillars: { year: yearP, month: monthP, day: dayP, hour: hourP },
    sg_day_master: dayP.stem,
    sg_scores: sgGodScores(dayP.stem, [yearP, monthP, dayP, hourP]),
    sg_yima: sgYima([yearP, dayP], [yearP, monthP, dayP, hourP]),
    sg_near_jie: sgHoursToNearestJie(jdUT) < 1,
    sg_hour_known: hourKnown,
  };
}

export function sgGodOf(dayStem, otherStem) {
  const rel = sgMod(SG_STEM_ELEMENT[otherStem] - SG_STEM_ELEMENT[dayStem], 5);
  const samePolarity = dayStem % 2 === otherStem % 2;
  return SG_GOD_BY_REL[rel][samePolarity ? 0 : 1];
}

// 十格分數(百分比,總和 100)
function sgGodScores(dayStem, pillars) {
  const raw = Object.fromEntries(SG_GOD_KEYS.map((k) => [k, 0]));
  pillars.forEach((p, i) => {
    if (!p) return;
    if (i !== 2) raw[sgGodOf(dayStem, p.stem)] += 1; // 日干不計
    const mult = i === 1 ? 1.5 : 1; // 月令加權
    SG_HIDDEN[p.branch].forEach(([s, w]) => { raw[sgGodOf(dayStem, s)] += w * mult; });
  });
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(SG_GOD_KEYS.map((k) => [k, Math.round((raw[k] / total) * 1000) / 10]));
}

// 驛馬:申子辰馬在寅、寅午戌馬在申、巳酉丑馬在亥、亥卯未馬在巳(依年支、日支)
const SG_YIMA_OF = { 8: 2, 0: 2, 4: 2, 2: 8, 6: 8, 10: 8, 5: 11, 9: 11, 1: 11, 11: 5, 3: 5, 7: 5 };
function sgYima(bases, pillars) {
  const branches = pillars.filter(Boolean).map((p) => p.branch);
  const horses = [...new Set(bases.map((p) => SG_YIMA_OF[p.branch]))];
  return horses.filter((h) => branches.includes(h)).map((h) => SG_BRANCHES[h]);
}

// 五能量彙總
export const SG_ENERGY_OF = {
  bi_jian: 0, jie_cai: 0, shi_shen: 1, shang_guan: 1, zheng_cai: 2,
  pian_cai: 2, zheng_guan: 3, qi_sha: 3, zheng_yin: 4, pian_yin: 4,
};
export function sgEnergyTotals(scores) {
  const out = [0, 0, 0, 0, 0];
  for (const [k, v] of Object.entries(scores)) out[SG_ENERGY_OF[k]] += v;
  return out.map((v) => Math.round(v * 10) / 10);
}
