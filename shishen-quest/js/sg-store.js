// 十神修行錄 — 狀態與規則(本機 localStorage;登入 LINE 時由 sg-app 同步到雲端)
import { sgEnergyTotals } from "./sg-bazi.js";
import {
  SG_ENERGIES, SG_OVERUSE_SCENE, SG_WEAK_METHODS, SG_BONDS, SG_OATH_KEYWORDS, SG_ANGELS, SG_REALMS,
} from "./sg-data.js";

const SG_KEY = "sg_state_v2";
export const SG_STEP = 0.1;        // 每天每完成一項任務,對應能量 +0.1(只加不扣)
export const SG_WISH_COST = 2;     // 每次許願消耗的修行能量
export const SG_WEEK_DAYS = 7;
export const SG_PASS_DAYS = 5;     // 7 天內做到 5 天算完成
const sgMother = (e) => (e + 4) % 5;   // 生 e 的能量
const sgChild = (e) => (e + 1) % 5;    // e 生的能量
const sgVictim = (e) => (e + 2) % 5;   // e 剋的能量

export function sgEmptyState() {
  return {
    sg_profile: null, sg_chart: null, sg_evolved: [0, 0, 0, 0, 0], sg_week: null,
    sg_checkins: {}, sg_history: [], sg_amulets: 0, sg_amulet_used: [], sg_wishes: [],
  };
}

export function sgLoad() {
  try {
    const raw = localStorage.getItem(SG_KEY);
    return raw ? { ...sgEmptyState(), ...JSON.parse(raw) } : sgEmptyState();
  } catch { return sgEmptyState(); }
}

export function sgSave(state) {
  try { localStorage.setItem(SG_KEY, JSON.stringify(state)); } catch { /* 私密模式等:僅存在記憶體 */ }
}

export function sgDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sgAddDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return sgDateStr(new Date(y, m - 1, d + n));
}

const sgRound = (v) => Math.round(v * 100) / 100;

// ---- 能量 ----
export function sgBaseEnergies(state) { return sgEnergyTotals(state.sg_chart.sg_scores); }
export function sgEnergies(state) {
  return sgBaseEnergies(state).map((v, i) => sgRound(Math.max(0.1, v + (state.sg_evolved?.[i] || 0))));
}
export function sgStrongWeak(values) {
  const idx = [0, 1, 2, 3, 4].sort((a, b) => values[a] - values[b]);
  return { s: idx[4], w: idx[0], w2: idx[1] };
}

const sgDelta = (pairs) => {
  const d = [0, 0, 0, 0, 0];
  pairs.forEach(([e, v]) => { d[e] = sgRound(d[e] + v); });
  return d;
};

// 命盤解讀:最佳 / 最差狀態與結果
export function sgInsight(state) {
  const E = sgEnergies(state);
  const { s, w } = sgStrongWeak(E);
  const S = SG_ENERGIES[s], W = SG_ENERGIES[w];
  return {
    s, w,
    sg_best: S.sg_best,
    sg_best_result: `「${S.sg_name}」順著相生流向「${SG_ENERGIES[sgChild(s)].sg_name}」:${SG_ENERGIES[sgChild(s)].sg_best}。`,
    sg_worst: S.sg_worst,
    sg_worst_result: `「${S.sg_name}」過度時會壓住「${SG_ENERGIES[sgVictim(s)].sg_name}」;再加上「${W.sg_name}」不足,容易出現:${W.sg_low.sg_text}`,
  };
}

// ---- 戒律、約束、誓言(只加能量,不扣)----
// 戒律:用最弱的能量節制最旺 → 最弱 +0.1;約束:補第二弱 +0.1;誓言:誓言所需的能量 +0.1
export const sgUp = (e) => sgDelta([[e, SG_STEP]]);

export function sgOathEnergy(text, fallback) {
  const i = SG_OATH_KEYWORDS.findIndex((re) => re.test(text));
  return i >= 0 ? i : fallback;
}

// AI 無法使用時的固定選項(格式與 AI 回傳相同)
export function sgFallbackOptions(state, oathWish) {
  const { s, w, w2 } = sgStrongWeak(sgEnergies(state));
  const t = oathWish.trim().slice(0, 50);
  const e = sgOathEnergy(t, w);
  return {
    s, w, w2,
    oaths: [`30 天內完成:${t}`, `30 天內每週推進一步:${t}`, `30 天內完成第一個可驗收的成果:${t}`].map((text) => ({ text, energy: e })),
    precepts: SG_WEAK_METHODS[w].map((m) => ({ text: `${SG_OVERUSE_SCENE[s]},${m}。` })),
    bonds: SG_BONDS[w2].map((text) => ({ text })),
  };
}

// 依選擇開始一週;opts 為 AI 或備案選項,pick = { oath, precept, bond } 索引
export function sgStartWeek(state, opts, pick) {
  const today = sgDateStr();
  const oath = opts.oaths[pick.oath];
  state.sg_week = {
    sg_start: today,
    sg_end: sgAddDays(today, SG_WEEK_DAYS - 1),
    sg_precept: { sg_text: opts.precepts[pick.precept].text, sg_energy: opts.w, sg_delta: sgUp(opts.w) },
    sg_bond: { sg_text: opts.bonds[pick.bond].text, sg_energy: opts.w2, sg_delta: sgUp(opts.w2) },
    sg_oath: { sg_text: oath.text.slice(0, 80), sg_energy: oath.energy, sg_delta: sgUp(oath.energy), sg_pct: 0 },
  };
}

// 重新立誓:放棄本週(已打卡的紀錄保留)
export function sgResetWeek(state) { state.sg_week = null; }

export function sgTotalDelta(week) {
  return [0, 1, 2, 3, 4].map((i) => sgRound(week.sg_precept.sg_delta[i] + week.sg_bond.sg_delta[i] + week.sg_oath.sg_delta[i]));
}

// ---- 打卡 ----
export function sgStreak(state, today = sgDateStr()) {
  const done = (d) => !!state.sg_checkins[d] || state.sg_amulet_used.includes(d);
  let day = done(today) ? today : sgAddDays(today, -1);
  let n = 0;
  while (done(day)) { n += 1; day = sgAddDays(day, -1); }
  return n;
}

// 任務對應的能量(舊版存檔沒有 sg_energy,從正的 delta 推回)
const sgTaskEnergy = (v) => (Number.isInteger(v?.sg_energy) ? v.sg_energy : (v?.sg_delta || []).findIndex((x) => x > 0));

// 當天打卡帶來的能量:每完成一項任務,對應能量 +0.1
export function sgDayGain(state, entry) {
  const wk = state.sg_week;
  const g = [0, 0, 0, 0, 0];
  if (!wk) return g;
  [["sg_precept_ok", wk.sg_precept], ["sg_bond_ok", wk.sg_bond], ["sg_oath_ok", wk.sg_oath]].forEach(([k, v]) => {
    const e = sgTaskEnergy(v);
    if (entry[k] && e >= 0) g[e] = sgRound(g[e] + SG_STEP);
  });
  return g;
}

export function sgCheckin(state, entry, today = sgDateStr()) {
  const yesterday = sgAddDays(today, -1);
  const prev = state.sg_checkins[today];
  const isNew = !prev;
  if (isNew && !state.sg_checkins[yesterday] && !state.sg_amulet_used.includes(yesterday)
      && state.sg_checkins[sgAddDays(today, -2)] && state.sg_amulets > 0) {
    state.sg_amulets -= 1;
    state.sg_amulet_used.push(yesterday);
  }
  // 同一天重複打卡:先扣回上次的加成,再加這次的(不會重複累積)
  const gain = sgDayGain(state, entry);
  const old = prev?.sg_gain || [0, 0, 0, 0, 0];
  state.sg_evolved = state.sg_evolved.map((v, i) => sgRound(v + gain[i] - old[i]));
  state.sg_checkins[today] = { ...entry, sg_gain: gain, sg_at: new Date().toISOString() };
  if (state.sg_week) state.sg_week.sg_oath.sg_pct = Math.max(state.sg_week.sg_oath.sg_pct, entry.sg_oath_pct || 0);
  const streak = sgStreak(state, today);
  const earnedAmulet = isNew && streak > 0 && streak % 7 === 0;
  if (earnedAmulet) state.sg_amulets += 1;
  return { streak, earnedAmulet, gain };
}

// 本週進度
export function sgWeekProgress(state, today = sgDateStr()) {
  const wk = state.sg_week;
  if (!wk) return null;
  const days = Array.from({ length: SG_WEEK_DAYS }, (_, i) => sgAddDays(wk.sg_start, i));
  const logs = days.map((d) => state.sg_checkins[d]).filter(Boolean);
  const count = (k) => logs.filter((e) => e[k]).length;
  const scores = logs.map((e) => e.sg_score).filter((n) => n >= 1);
  return {
    sg_day: Math.min(SG_WEEK_DAYS, days.indexOf(today) + 1 || (today > wk.sg_end ? SG_WEEK_DAYS : 1)),
    sg_ended: today > wk.sg_end,
    sg_precept: count("sg_precept_ok"), sg_bond: count("sg_bond_ok"), sg_oath: count("sg_oath_ok"),
    sg_avg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
  };
}

// 週問卷送出:能量已在每天打卡時加上,這裡只做本週結算紀錄
export function sgSubmitReview(state, answers) {
  const wk = state.sg_week;
  const pr = sgWeekProgress(state);
  const passed = {
    sg_precept: pr.sg_precept >= SG_PASS_DAYS,
    sg_bond: pr.sg_bond >= SG_PASS_DAYS,
    sg_oath: pr.sg_oath >= SG_PASS_DAYS,
  };
  const applied = [0, 0, 0, 0, 0];
  for (let i = 0; i < SG_WEEK_DAYS; i++) {
    (state.sg_checkins[sgAddDays(wk.sg_start, i)]?.sg_gain || []).forEach((v, k) => { applied[k] = sgRound(applied[k] + v); });
  }
  state.sg_history.push({
    sg_start: wk.sg_start, sg_end: wk.sg_end, sg_answers: answers, sg_passed: passed,
    sg_applied: applied, sg_after: sgEnergies(state), sg_avg: pr.sg_avg, sg_oath_text: wk.sg_oath.sg_text,
  });
  state.sg_week = null;
  return { passed, applied };
}

// ---- 許願:只能用修行後多出來的能量,每次共消耗 2 ----
export function sgWishPool(state) {
  const pool = (state.sg_evolved || [0, 0, 0, 0, 0]).map((v) => sgRound(Math.max(0, v)));
  return { pool, total: sgRound(pool.reduce((a, b) => a + b, 0)) };
}

// 把 AI 給的比例修正成「每格不超過可用量、總和剛好 2」
export function sgFitCost(raw, pool) {
  const cost = pool.map((p, i) => Math.min(p, Math.max(0, Number(raw?.[i]) || 0)));
  let sum = cost.reduce((a, b) => a + b, 0);
  if (sum > SG_WISH_COST) cost.forEach((c, i) => { cost[i] = c * SG_WISH_COST / sum; });
  sum = cost.reduce((a, b) => a + b, 0);
  // 不足 2:依剩餘可用量由多到少補齊
  [0, 1, 2, 3, 4].sort((a, b) => (pool[b] - cost[b]) - (pool[a] - cost[a])).forEach((i) => {
    const need = SG_WISH_COST - sum;
    if (need <= 1e-9) return;
    const add = Math.min(need, pool[i] - cost[i]);
    cost[i] += add; sum += add;
  });
  return cost.map(sgRound);
}

export function sgMakeWish(state, text, result) {
  const { pool, total } = sgWishPool(state);
  if (total < SG_WISH_COST) throw new Error("NOT_ENOUGH");
  const cost = sgFitCost(result.cost, pool);
  state.sg_evolved = state.sg_evolved.map((v, i) => sgRound(v - cost[i]));
  const wish = { sg_date: sgDateStr(), sg_text: text.slice(0, 120), sg_cost: cost, sg_blessing: result.blessing, sg_action: result.action };
  state.sg_wishes = [...(state.sg_wishes || []), wish];
  return wish;
}

// AI 無法使用時:依可用量比例扣除,祝福用天使台詞
export function sgFallbackWish(state, text) {
  const a = sgAngel(state);
  return {
    cost: sgWishPool(state).pool,
    blessing: `${a.sg_name}收下了你的願望:「${text.slice(0, 40)}」。${a.sg_lines[2]}`,
    action: "今天就為這個願望做一件 10 分鐘內能完成的小事,做完回來打卡。",
  };
}

// ---- 守護天使:與使用者完全相反的能量分布 ----
export function sgAngel(state, today = sgDateStr()) {
  const E = sgEnergies(state);
  const max = Math.max(...E), min = Math.min(...E);
  const values = E.map((v) => sgRound(max + min - v));
  const top = values.indexOf(Math.max(...values));
  const a = SG_ANGELS[top];
  const c = state.sg_checkins[today];
  const n = c ? [c.sg_precept_ok, c.sg_bond_ok, c.sg_oath_ok].filter(Boolean).length : 0;
  return { ...a, sg_energy: top, sg_values: values, sg_line: a.sg_lines[n === 0 ? 0 : n < 3 ? 1 : 2] };
}

export function sgTotalDays(state) { return Object.keys(state.sg_checkins).length; }

export function sgRealm(state) {
  const days = sgTotalDays(state);
  let cur = SG_REALMS[0];
  let next = null;
  for (const r of SG_REALMS) { if (days >= r.sg_min) cur = r; else { next = r; break; } }
  return { cur, next, days };
}
