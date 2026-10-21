// 十神修行錄 — 狀態與規則(本機 localStorage;登入 LINE 時由 sg-app 同步到雲端)
import { sgEnergyTotals } from "./sg-bazi.js";
import {
  SG_ENERGIES, SG_OVERUSE_SCENE, SG_WEAK_METHODS, SG_BONDS, SG_OATH_TYPES, SG_ANGELS, SG_REALMS,
} from "./sg-data.js";

const SG_KEY = "sg_state_v2";
export const SG_STEP = 0.1;        // 每項任務完成一週,能量變化 ±0.1
export const SG_WEEK_DAYS = 7;
export const SG_PASS_DAYS = 5;     // 7 天內做到 5 天算完成
const sgMother = (e) => (e + 4) % 5;   // 生 e 的能量
const sgChild = (e) => (e + 1) % 5;    // e 生的能量
const sgVictim = (e) => (e + 2) % 5;   // e 剋的能量

export function sgEmptyState() {
  return {
    sg_profile: null, sg_chart: null, sg_evolved: [0, 0, 0, 0, 0], sg_week: null,
    sg_checkins: {}, sg_history: [], sg_amulets: 0, sg_amulet_used: [],
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
  let s = 0, w = 0;
  values.forEach((v, i) => { if (v > values[s]) s = i; if (v < values[w]) w = i; });
  return { s, w };
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

// ---- 戒律:由最弱制最旺,三個選項 ----
export function sgPreceptOptions(state) {
  const { s, w } = sgStrongWeak(sgEnergies(state));
  return SG_WEAK_METHODS[w].map((m) => ({
    sg_text: `${SG_OVERUSE_SCENE[s]},${m}。`,
    sg_delta: sgDelta([[s, -SG_STEP], [w, SG_STEP]]),
  }));
}

// ---- 約束:補最弱,消耗生它的能量 ----
export function sgBondSuggestion(state) {
  const { w } = sgStrongWeak(sgEnergies(state));
  return { sg_energy: w, sg_text: SG_BONDS[w], sg_delta: sgDelta([[w, SG_STEP], [sgMother(w), -SG_STEP]]) };
}

// ---- 誓言:把「生目標的能量」轉移到目標 ----
export function sgOathDelta(typeIdx) {
  const t = SG_OATH_TYPES[typeIdx].sg_energy;
  return sgDelta([[sgMother(t), -SG_STEP], [t, SG_STEP]]);
}

export function sgStartWeek(state, preceptIdx, oathType, oathText) {
  const today = sgDateStr();
  const precept = sgPreceptOptions(state)[preceptIdx];
  state.sg_week = {
    sg_start: today,
    sg_end: sgAddDays(today, SG_WEEK_DAYS - 1),
    sg_precept: precept,
    sg_bond: sgBondSuggestion(state),
    sg_oath: { sg_type: oathType, sg_text: oathText.trim().slice(0, 80), sg_delta: sgOathDelta(oathType), sg_pct: 0 },
  };
}

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

export function sgCheckin(state, entry, today = sgDateStr()) {
  const yesterday = sgAddDays(today, -1);
  const isNew = !state.sg_checkins[today];
  if (isNew && !state.sg_checkins[yesterday] && !state.sg_amulet_used.includes(yesterday)
      && state.sg_checkins[sgAddDays(today, -2)] && state.sg_amulets > 0) {
    state.sg_amulets -= 1;
    state.sg_amulet_used.push(yesterday);
  }
  state.sg_checkins[today] = { ...entry, sg_at: new Date().toISOString() };
  if (state.sg_week) state.sg_week.sg_oath.sg_pct = Math.max(state.sg_week.sg_oath.sg_pct, entry.sg_oath_pct || 0);
  const streak = sgStreak(state, today);
  const earnedAmulet = isNew && streak > 0 && streak % 7 === 0;
  if (earnedAmulet) state.sg_amulets += 1;
  return { streak, earnedAmulet };
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

// 週問卷送出:完成的任務把能量變化加進能量表
export function sgSubmitReview(state, answers) {
  const wk = state.sg_week;
  const pr = sgWeekProgress(state);
  const passed = {
    sg_precept: pr.sg_precept >= SG_PASS_DAYS,
    sg_bond: pr.sg_bond >= SG_PASS_DAYS,
    sg_oath: pr.sg_oath >= SG_PASS_DAYS,
  };
  const applied = [0, 0, 0, 0, 0];
  for (const k of Object.keys(passed)) {
    if (passed[k]) wk[k].sg_delta.forEach((v, i) => { applied[i] = sgRound(applied[i] + v); });
  }
  const before = sgEnergies(state);
  state.sg_evolved = state.sg_evolved.map((v, i) => sgRound(v + applied[i]));
  state.sg_history.push({
    sg_start: wk.sg_start, sg_end: wk.sg_end, sg_answers: answers, sg_passed: passed,
    sg_applied: applied, sg_before: before, sg_after: sgEnergies(state), sg_avg: pr.sg_avg,
    sg_oath_text: wk.sg_oath.sg_text,
  });
  state.sg_week = null;
  return { passed, applied };
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
