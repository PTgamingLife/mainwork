// 十神試煉場 — 狀態與規則(本機 localStorage;讀十神修行錄的 sg_state_v2)
import {
  SI_GODS, SI_GOD_BY_KEY, SI_DEMONS, SI_SKILLS, SI_SKILL_STEPS, SI_OATH_CUT_MIN, SI_THIEF_CHANCE,
  SI_THIEF_RATIO, SI_BOND_MULT, SI_RUN_MIN, SI_PENALTY_MIN, SI_PENALTY_CAP_MIN, SI_OFFLINE_DAYS,
  SI_OFFLINE_PER_HOUR, SI_OFFLINE_MISS_RATE, SI_BOSS_DROP, SI_WEEK_BONUS, SI_ELEMENTS,
  siPointOfElem, siPointOfEnergy, siUpgradeCost,
} from "./si-data.js";

const SI_MIN = 60000;
const SI_DAY = 86400000;

export function siEmptyState() {
  return {
    si_levels: Object.fromEntries(SI_GODS.map((g) => [g.si_key, 1])),
    si_aura: Object.fromEntries(SI_GODS.map((g) => [g.si_key, 0])),
    si_days: {},       // 日期 → { si_used: 已領幾場, si_penalty: 當天已加罰分鐘 }
    si_run: null,      // 進行中的試煉
    si_last_seen: 0,   // 最後在線時間(算離線收益)
    si_last_done: null, // 最後一次「打卡 + 完成試煉」的日期
    si_demon_kills: SI_DEMONS.map(() => 0), // 十種心魔各被打倒幾次(決定心魔變形)
  };
}

export function siLoad(key) {
  try {
    const raw = localStorage.getItem(key);
    const base = siEmptyState();
    if (!raw) return base;
    const s = JSON.parse(raw);
    return { ...base, ...s, si_levels: { ...base.si_levels, ...s.si_levels }, si_aura: { ...base.si_aura, ...s.si_aura } };
  } catch { return siEmptyState(); }
}

export function siSave(key, state) {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* 私密模式:僅存在記憶體 */ }
}

export function siLoadSg(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

// ---- 日期 ----
export function siDateStr(t) {
  const d = new Date(t), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function siAddDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return siDateStr(new Date(y, m - 1, d + n).getTime());
}
const siNextMidnight = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };

// ---- 讀十神修行錄 ----
const siCheckinCount = (c) => (c ? ["sg_precept_ok", "sg_bond_ok", "sg_oath_ok"].filter((k) => c[k]).length : 0);

export function siDayNo(sg) { return Math.max(1, Object.keys(sg?.sg_checkins || {}).length); }
export function siDemonOf(dayNo) { return SI_DEMONS[(dayNo - 1) % SI_DEMONS.length]; }

export function siSkillLevels(sg) {
  const logs = Object.values(sg?.sg_checkins || {});
  const out = {};
  SI_SKILLS.forEach((k) => {
    const n = logs.filter((c) => c[k.si_flag]).length;
    out[k.si_key] = { si_count: n, si_level: SI_SKILL_STEPS.filter((s) => n >= s).length };
  });
  return out;
}

// 今天還能領幾場(每完成一項打卡一場,最多 3)
export function siTickets(si, sg, today) {
  return Math.max(0, siCheckinCount(sg?.sg_checkins?.[today]) - (si.si_days[today]?.si_used || 0));
}

// 本週轉化:剋 → 起點十神戰力加成;生 → 終點十神靈氣加成
export function siWeekEffects(sg) {
  const dm = sg?.sg_chart?.sg_day_master ?? 0;
  const wk = sg?.sg_week;
  const out = { si_ke: [], si_sheng: [], si_labels: [] };
  if (!wk) return out;
  [["戒律", wk.sg_precept], ["約束", wk.sg_bond], ["誓言", wk.sg_oath]].forEach(([who, t]) => {
    const key = t?.sg_transform;
    if (!key || key.length !== 3) return;
    const a = SI_ELEMENTS.indexOf(key[0]), b = SI_ELEMENTS.indexOf(key[2]);
    if (a < 0 || b < 0) return;
    const pair = { si_from: siPointOfElem(dm, a), si_to: siPointOfElem(dm, b) };
    (key[1] === "剋" ? out.si_ke : out.si_sheng).push(pair);
    out.si_labels.push({ si_who: who, si_key: key });
  });
  return out;
}

// ---- 戰力 ----
export function siPower(si, sg, key, fx = siWeekEffects(sg)) {
  const g = SI_GOD_BY_KEY[key];
  const base = sg?.sg_chart?.sg_scores?.[key] ?? 1;
  const evolved = Math.max(0, sg?.sg_evolved?.[g.si_energy] || 0);
  const pt = siPointOfEnergy(g.si_energy);
  const boost = fx.si_ke.some((p) => p.si_from === pt) ? SI_WEEK_BONUS : 1;
  return Math.round((base + 0.5) * (1 + evolved) * si.si_levels[key] * 10 * boost);
}
export function siPowers(si, sg) {
  const fx = siWeekEffects(sg);
  return Object.fromEntries(SI_GODS.map((g) => [g.si_key, siPower(si, sg, g.si_key, fx)]));
}

// 掉落倍率:約束等級 × 場數 × 本週生型加成
export function siDropMult(sg, key, units, fx = siWeekEffects(sg)) {
  const bond = SI_BOND_MULT[siSkillLevels(sg).si_bond.si_level];
  const pt = siPointOfEnergy(SI_GOD_BY_KEY[key].si_energy);
  const boost = fx.si_sheng.some((p) => p.si_to === pt) ? SI_WEEK_BONUS : 1;
  return bond * units * boost;
}

// ---- 試煉 ----
export function siRunNeedMs(sg) {
  return (SI_RUN_MIN - SI_OATH_CUT_MIN[siSkillLevels(sg).si_oath.si_level]) * SI_MIN;
}

export function siRunStart(si, sg, today) {
  const units = siTickets(si, sg, today);
  if (!units || si.si_run) return false;
  si.si_run = {
    si_date: today, si_units: units, si_need_ms: siRunNeedMs(sg), si_penalty_ms: 0,
    si_elapsed_ms: 0, si_pending: {}, si_boss: false, si_kills: 0,
  };
  return true;
}

// 中斷:+5 分鐘,同一天最多 +15
export function siRunPenalty(si, today) {
  const run = si.si_run;
  if (!run || run.si_boss) return 0;
  const day = (si.si_days[today] ||= { si_used: 0, si_penalty: 0 });
  const add = Math.min(SI_PENALTY_MIN, SI_PENALTY_CAP_MIN - day.si_penalty);
  if (add <= 0) return 0;
  day.si_penalty += add;
  run.si_penalty_ms += add * SI_MIN;
  return add;
}

export function siRunLeftMs(run) { return Math.max(0, run.si_need_ms + run.si_penalty_ms - run.si_elapsed_ms); }

export function siRunDrop(si, sg, key, amount) {
  const run = si.si_run;
  if (!run) return 0;
  const v = amount * siDropMult(sg, key, run.si_units);
  run.si_pending[key] = (run.si_pending[key] || 0) + v;
  return v;
}

export function siBossDrop(si, sg, dayNo) {
  return siRunDrop(si, sg, siDemonOf(dayNo).si_drop, SI_BOSS_DROP);
}

// 注意力小偷:戒律越高越少出現、偷得越少;直接從 gains 扣掉
export function siThief(gains, sg, rnd = Math.random) {
  const lv = siSkillLevels(sg).si_precept.si_level;
  const keys = Object.keys(gains).filter((k) => gains[k] > 0);
  if (!keys.length || rnd() >= SI_THIEF_CHANCE[lv]) return null;
  const key = keys[Math.floor(rnd() * keys.length)];
  const amount = Math.max(1, Math.floor(gains[key] * SI_THIEF_RATIO[lv]));
  gains[key] -= amount;
  return { si_key: key, si_amount: amount, si_ratio: SI_THIEF_RATIO[lv] };
}

// 結算:注意力小偷(戒律越高越少出現、偷得越少)→ 靈氣入帳
export function siSettle(si, sg, rnd = Math.random) {
  const run = si.si_run;
  if (!run) return null;
  const gains = Object.fromEntries(Object.entries(run.si_pending).map(([k, v]) => [k, Math.floor(v)]));
  const thief = siThief(gains, sg, rnd);
  Object.entries(gains).forEach(([k, v]) => { si.si_aura[k] += v; });
  const day = (si.si_days[run.si_date] ||= { si_used: 0, si_penalty: 0 });
  day.si_used += run.si_units;
  si.si_last_done = run.si_date;
  si.si_run = null;
  return { si_gains: gains, si_thief: thief, si_units: run.si_units };
}

// ---- 離線收益 ----
// 從 si_last_seen 到 now,依日期切段:有打卡 100%、沒打卡 1/5;只算上次完成試煉後 5 天內
export function siOffline(si, sg, now, rnd = Math.random) {
  const from = si.si_last_seen;
  if (!from || !si.si_last_done || now - from < 5 * SI_MIN) return null;
  const lastOk = siAddDays(si.si_last_done, SI_OFFLINE_DAYS);
  let t = from, hours = 0;
  while (t < now) {
    const end = Math.min(now, siNextMidnight(t));
    const d = siDateStr(t);
    if (d <= lastOk) {
      const rate = siCheckinCount(sg?.sg_checkins?.[d]) > 0 ? 1 : SI_OFFLINE_MISS_RATE;
      hours += ((end - t) / 3600000) * rate;
    }
    t = end;
  }
  const bond = SI_BOND_MULT[siSkillLevels(sg).si_bond.si_level];
  const gains = {};
  SI_GODS.forEach((g) => { gains[g.si_key] = Math.floor(hours * SI_OFFLINE_PER_HOUR * bond); });
  const thief = siThief(gains, sg, rnd);
  return { si_away_ms: now - from, si_hours: hours, si_gains: gains, si_thief: thief, si_expired: siDateStr(now) > lastOk };
}

export function siApplyGains(si, gains) {
  Object.entries(gains).forEach(([k, v]) => { si.si_aura[k] += v; });
}

// ---- 升級 ----
export function siUpgrade(si, key) {
  const cost = siUpgradeCost(si.si_levels[key]);
  if (si.si_aura[key] < cost) return false;
  si.si_aura[key] -= cost;
  si.si_levels[key] += 1;
  return true;
}

export const siDayMs = SI_DAY;
