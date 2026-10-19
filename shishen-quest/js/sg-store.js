// 十神修行錄 — 狀態與規則(MVP:localStorage;之後換成 Supabase 只需改 sgLoad/sgSave)
import { SG_GOD_KEYS } from "./sg-bazi.js";
import { SG_GODS, SG_PRECEPTS, SG_BONDS, SG_REALMS } from "./sg-data.js";

const SG_KEY = "sg_state_v1";
const SG_FROM_THRESHOLD = 45; // 某格占比超過此值 → 從格,戒律改為引流

export function sgEmptyState() {
  return { sg_profile: null, sg_chart: null, sg_assess: null, sg_vows: null, sg_checkins: {}, sg_amulets: 0, sg_amulet_used: [] };
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

// 自評 1–5 轉成百分比分布
export function sgAssessToScores(answers) {
  const total = SG_GOD_KEYS.reduce((a, k) => a + (answers[k] || 0), 0) || 1;
  return Object.fromEntries(SG_GOD_KEYS.map((k) => [k, Math.round(((answers[k] || 0) / total) * 1000) / 10]));
}

// 有自評時,先天與現況各半;否則只用先天
export function sgBlendedScores(state) {
  const base = state.sg_chart.sg_scores;
  if (!state.sg_assess) return base;
  const now = sgAssessToScores(state.sg_assess);
  return Object.fromEntries(SG_GOD_KEYS.map((k) => [k, Math.round((base[k] + now[k]) * 5) / 10]));
}

export function sgRankGods(scores) {
  return [...SG_GOD_KEYS].sort((a, b) => scores[b] - scores[a]);
}

// 產生戒律與約束建議;offset 用來「換一個」
export function sgSuggestVows(state, offset = 0) {
  const scores = sgBlendedScores(state);
  const ranked = sgRankGods(scores);
  const high = ranked[offset % 3];
  const low = ranked[ranked.length - 1 - (offset % 3)];
  const mode = scores[high] > SG_FROM_THRESHOLD ? "sg_drain" : (offset % 2 ? "sg_drain" : "sg_restrain");
  return {
    sg_precept: { sg_god: high, sg_mode: mode, sg_text: SG_PRECEPTS[high][mode] },
    sg_bond: { sg_god: low, sg_text: SG_BONDS[low] },
    sg_rank: offset % 3,
  };
}

export function sgStartVows(state, { sg_precept, sg_bond }, oathText) {
  const today = sgDateStr();
  state.sg_vows = {
    sg_precept: { ...sg_precept, sg_start: today },
    sg_bond: { ...sg_bond, sg_start: today, sg_end: sgAddDays(today, 6) },
    sg_oath: { sg_text: oathText.trim().slice(0, 80), sg_start: today, sg_end: sgAddDays(today, 29), sg_pct: 0 },
  };
}

// 連續天數(護符可補一天空缺)
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
  // 斷一天且有護符 → 自動補上
  if (isNew && !state.sg_checkins[yesterday] && !state.sg_amulet_used.includes(yesterday)
      && state.sg_checkins[sgAddDays(today, -2)] && state.sg_amulets > 0) {
    state.sg_amulets -= 1;
    state.sg_amulet_used.push(yesterday);
  }
  state.sg_checkins[today] = { ...entry, sg_at: new Date().toISOString() };
  if (state.sg_vows) state.sg_vows.sg_oath.sg_pct = Math.max(state.sg_vows.sg_oath.sg_pct, entry.sg_oath_pct || 0);
  const streak = sgStreak(state, today);
  if (isNew && streak > 0 && streak % 7 === 0) state.sg_amulets += 1;
  return { streak, earnedAmulet: isNew && streak > 0 && streak % 7 === 0 };
}

export function sgTotalDays(state) {
  return Object.keys(state.sg_checkins).length;
}

export function sgRealm(state) {
  const days = sgTotalDays(state);
  let cur = SG_REALMS[0];
  let next = null;
  for (const r of SG_REALMS) { if (days >= r.sg_min) cur = r; else { next = r; break; } }
  return { cur, next, days };
}

// 約束 7 天達成數
export function sgBondProgress(state) {
  const v = state.sg_vows?.sg_bond;
  if (!v) return { done: 0, total: 7, ended: false };
  let done = 0;
  for (let i = 0; i < 7; i++) if (state.sg_checkins[sgAddDays(v.sg_start, i)]?.sg_bond_ok) done += 1;
  return { done, total: 7, ended: sgDateStr() > v.sg_end };
}

export function sgGodLabel(key) {
  const g = SG_GODS[key];
  return `${g.sg_name}(${g.sg_trad})`;
}
