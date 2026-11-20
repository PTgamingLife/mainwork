// 十神試煉場 — 專注紀錄與「專注」頁
// si.si_focus:日期 → { m 專注分鐘, r 完成場數, i 中斷次數, f [完成, 部分, 沒有] };只保留最近 60 天
import { siAddDays, siDemonOf } from "./si-store.js";

const SI_FOCUS_KEEP_DAYS = 60;
export const SI_FOCUS_RESULTS = ["完成", "部分", "沒有"];

function siFocusDay(si, date) {
  si.si_focus ||= {};
  return (si.si_focus[date] ||= { m: 0, r: 0, i: 0, f: [0, 0, 0] });
}

export function siFocusInterrupt(si, date) {
  siFocusDay(si, date).i += 1;
}

// 一場試煉結束:記錄實際專注分鐘(只算畫面開著的時間)
export function siFocusAddRun(si, date, elapsedMs) {
  const d = siFocusDay(si, date);
  d.m = Math.round((d.m + elapsedMs / 60000) * 10) / 10;
  d.r += 1;
  Object.keys(si.si_focus).sort().slice(0, -SI_FOCUS_KEEP_DAYS).forEach((k) => delete si.si_focus[k]);
}

export function siFocusRate(si, date, idx) {
  if (idx >= 0 && idx < 3) siFocusDay(si, date).f[idx] += 1;
}

export function siFocusStats(si, today) {
  const log = si.si_focus || {};
  const days = Array.from({ length: 7 }, (_, k) => siAddDays(today, k - 6));
  const week = days.map((d) => ({ d, m: Math.round(log[d]?.m || 0) }));
  const sum = (key) => days.reduce((a, d) => a + (log[d]?.[key] || 0), 0);
  const done = days.reduce((a, d) => (log[d]?.f || [0, 0, 0]).map((n, k) => a[k] + n), [0, 0, 0]);
  const rated = done[0] + done[1] + done[2];
  let streak = 0, day = (log[today]?.m || 0) > 0 ? today : siAddDays(today, -1);
  while ((log[day]?.m || 0) > 0) { streak += 1; day = siAddDays(day, -1); }
  const runs = sum("r");
  return {
    si_today: Math.round(log[today]?.m || 0), si_week: Math.round(sum("m")), si_runs: runs, si_interrupts: sum("i"),
    si_avg_int: runs ? (sum("i") / runs).toFixed(1) : "—", si_rate: rated ? Math.round(((done[0] + done[1] * 0.5) / rated) * 100) : null,
    si_streak: streak, si_days: week,
  };
}

export function siViewFocus(st, role) {
  const max = Math.max(20, ...st.si_days.map((x) => x.m));
  const bars = st.si_days.map((x) => `<div class="si-fbar"><i style="height:${(x.m / max) * 100}%"></i>
    <small>${x.m || ""}</small><span>${x.d.slice(5).replace("-", "/")}</span></div>`).join("");
  return `
    <div class="si-skill-card"><div class="si-fstats">
      <div><b>${st.si_today}</b>今日分鐘</div><div><b>${st.si_week}</b>近 7 天分鐘</div><div><b>${st.si_streak}</b>連續專注天數</div></div>
      <p style="text-align:center;color:var(--si-gray);font-size:12px;margin:6px 0 0">近 7 天 ${st.si_runs} 場・平均每場中斷 ${st.si_avg_int} 次${st.si_rate !== null ? `・完成率 ${st.si_rate}%` : ""}</p></div>
    <div class="si-skill-card"><b style="font-size:15px">近 7 天專注分鐘</b><div class="si-fchart">${bars}</div></div>
    ${role ? `<div class="si-skill-card"><b>${role.sg_element}屬・${role.sg_name}</b>
      <div>主要分心:${role.sg_distract}——${role.sg_distract_desc}</div>
      <div style="color:var(--si-gray)">開始試煉前,先把會讓你「${role.sg_distract}」的東西移開。</div></div>` : ""}`;
}

// 修行路線圖:每 10 天一章,節點 = 第幾天(打卡日),顯示當天專注分鐘;第 10 天是章節頭目
export function siViewRoute(si, sg, dayNo) {
  const dates = Object.keys(sg?.sg_checkins || {}).sort();
  const ch = Math.floor((dayNo - 1) / 10), base = ch * 10;
  const nodes = Array.from({ length: 10 }, (_, k) => {
    const n = base + k + 1, d = dates[n - 1], m = d ? Math.round(si.si_focus?.[d]?.m || 0) : 0;
    const cls = n < dayNo ? "done" : n === dayNo ? "now" : "";
    return `<div class="si-node ${cls} ${k === 9 ? "boss" : ""}"><i>${k === 9 ? "魔" : n}</i><small>${n <= dayNo ? (m ? `${m}分` : "—") : ""}</small></div>`;
  }).join("");
  const boss = siDemonOf(base + 10);
  return `<div class="si-skill-card si-route"><b style="font-size:15px">修行路線・第 ${ch + 1} 章</b>
    <span style="float:right;font-size:12px;color:var(--si-gray)">Day-${dayNo} / ${base + 10}</span>
    <div class="si-nodes">${nodes}</div>
    <div style="font-size:12px;color:var(--si-ink-2)">章末頭目:${boss.si_boss}(${boss.si_distract})・還有 ${base + 10 - dayNo} 天</div></div>`;
}
