// 十神試煉場 — 主控:載入狀態、試煉計時、中斷懲罰、結算、離線收益、頁籤
import {
  siLoad, siSave, siLoadSg, siDateStr, siDayNo, siDemonOf, siSkillLevels, siTickets, siWeekEffects, siPowers,
  siRunStart, siRunPenalty, siRunLeftMs, siRunDrop, siBossDrop, siSettle, siOffline, siApplyGains, siUpgrade, siDayMs,
} from "./si-store.js";
import { siCreateField } from "./si-field.js";
import { SI_KILL_DROP } from "./si-data.js";
import {
  siViewPending, siViewWeek, siViewSkillRow, siViewSkills, siViewGods, siViewSettle, siViewOffline, siViewTimer,
} from "./si-view.js";
import { siMockSg, siMockCheckin, SI_MOCK_SG_KEY, SI_MOCK_STATE_KEY, SI_MOCK_OFFSET_KEY } from "./si-mock.js";

const si_mock = new URLSearchParams(location.search).has("mock");
const SI_STATE_KEY = si_mock ? SI_MOCK_STATE_KEY : "si_state_v1";
const SI_SG_KEY = si_mock ? SI_MOCK_SG_KEY : "sg_state_v2";
const $ = (id) => document.getElementById(id);

let si_offset = si_mock ? Number(localStorage.getItem(SI_MOCK_OFFSET_KEY)) || 0 : 0;
let si_speed = 1;
const siNow = () => Date.now() + si_offset;
const siToday = () => siDateStr(siNow());

let si_sg = siLoadSg(SI_SG_KEY);
if (si_mock && !si_sg) { si_sg = siMockSg(siToday()); localStorage.setItem(SI_SG_KEY, JSON.stringify(si_sg)); }
const si = siLoad(SI_STATE_KEY);
let si_field = null;

const siSaveAll = () => {
  si.si_last_seen = siNow();
  siSave(SI_STATE_KEY, si);
  if (si_mock) localStorage.setItem(SI_SG_KEY, JSON.stringify(si_sg));
};

function siToast(msg) {
  const t = $("si-toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(siToast.h); siToast.h = setTimeout(() => t.classList.remove("on"), 2200);
}

function siModal(html) {
  $("si-modal-box").innerHTML = html;
  $("si-modal").classList.add("on");
}
$("si-modal").addEventListener("click", (ev) => {
  if (ev.target.closest("[data-si-close]")) { $("si-modal").classList.remove("on"); siRender(); }
});

// ---- 模型 → 戰場 ----
function siModel() {
  const day = siDayNo(si_sg);
  return {
    si_dm: si_sg.sg_chart.sg_day_master ?? 0,
    si_powers: siPowers(si, si_sg),
    si_levels: si.si_levels,
    si_fx: siWeekEffects(si_sg),
    si_demon: siDemonOf(day),
    si_enemy_hp: Math.round(30 * Math.pow(1.03, day - 1)),
  };
}

// ---- 畫面 ----
function siRenderHeader() {
  const today = siToday();
  const day = siDayNo(si_sg), demon = siDemonOf(day), run = si.si_run;
  $("si-stage").textContent = `Day-${day} 心神訓練`;
  $("si-sub").textContent = `本日心魔:${demon.si_trait}・頭目 ${demon.si_boss}`;
  const pen = si.si_days[today]?.si_penalty || 0;
  const left = run ? siRunLeftMs(run) : 0;
  $("si-timer").innerHTML = siViewTimer(run, left, pen);
  const total = run ? run.si_need_ms + run.si_penalty_ms : 1;
  $("si-bar").style.width = `${run ? (run.si_boss ? 100 : (1 - left / total) * 100) : 0}%`;
  $("si-pend").innerHTML = run ? siViewPending(run.si_pending, si_sg.sg_chart.sg_day_master) : `<span>完成試煉才能領取靈氣</span>`;
}

function siRenderStart() {
  const run = si.si_run;
  if (run) { $("si-start").innerHTML = ""; return; }
  const n = siTickets(si, si_sg, siToday());
  $("si-start").innerHTML = n
    ? `<button class="si-btn" id="si-go">開始試煉${n > 1 ? `(領 ${n} 場收益)` : ""}</button>`
    : `<span class="si-hint">${si.si_days[siToday()]?.si_used ? "今日已完成的打卡都已試煉" : "完成今日打卡(戒律/約束/誓言)即可開始試煉"}</span>`;
  $("si-go")?.addEventListener("click", siStart);
}

function siRender() {
  const lv = siSkillLevels(si_sg), m = siModel();
  si_field.si_setModel(m);
  siRenderHeader();
  siRenderStart();
  $("si-week").innerHTML = siViewWeek(m.si_fx, m.si_dm);
  $("si-skills").innerHTML = siViewSkillRow(lv);
  $("si-skill-list").innerHTML = siViewSkills(lv);
  $("si-gods").innerHTML = siViewGods(si, m.si_powers, m.si_dm);
  if (si_mock) siRenderMock();
}

// ---- 試煉 ----
function siStart() {
  if (!siRunStart(si, si_sg, siToday())) return;
  si_field.si_setRunning(true);
  siSaveAll(); siRender();
}

function siInterrupt() {
  if (!si.si_run || si.si_run.si_boss) return;
  const add = siRunPenalty(si, siToday());
  siToast(add ? `試煉中斷,時間 +${add} 分鐘` : "試煉中斷(今日加時已達上限)");
  siSaveAll(); siRenderHeader();
}

const si_hooks = {
  si_onKill(key) { siRunDrop(si, si_sg, key, SI_KILL_DROP); },
  si_onBossDead() {
    siBossDrop(si, si_sg, siDayNo(si_sg));
    const demon = siDemonOf(siDayNo(si_sg));
    const res = siSettle(si, si_sg);
    si_field.si_setRunning(false);
    siSaveAll();
    siModal(siViewSettle(res, demon, si_sg.sg_chart.sg_day_master));
    siRender();
  },
};

function siCheckOffline() {
  const res = siOffline(si, si_sg, siNow());
  si.si_last_seen = siNow();
  if (!res) return;
  siApplyGains(si, res.si_gains);
  siSaveAll();
  siModal(siViewOffline(res, si_sg.sg_chart.sg_day_master));
}

// ---- 主迴圈 ----
let si_last = performance.now(), si_ui_t = 0, si_save_t = 0;
function siLoop(t) {
  const real = Math.min(0.1, (t - si_last) / 1000);
  si_last = t;
  if (!document.hidden) {
    const dt = real * si_speed;
    const run = si.si_run;
    if (run && !run.si_boss) {
      run.si_elapsed_ms += dt * 1000;
      if (siRunLeftMs(run) <= 0) { run.si_boss = true; si_field.si_startBoss(); }
    }
    si_field.si_step(dt);
    si_field.si_draw();
    si_ui_t += real; si_save_t += real;
    if (si_ui_t > 0.5) { si_ui_t = 0; siRenderHeader(); }
    if (si_save_t > 5) { si_save_t = 0; siSaveAll(); }
  }
  requestAnimationFrame(siLoop);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { siSaveAll(); return; }
  si_last = performance.now();
  if (si.si_run) siInterrupt(); else siCheckOffline();
});

// ---- 頁籤 / 升級 ----
$("si-tabs").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-si-tab]");
  if (!b) return;
  document.querySelectorAll("[data-si-tab]").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll("[data-si-panel]").forEach((p) => p.classList.toggle("on", p.dataset.siPanel === b.dataset.siTab));
});
$("si-gods").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-si-up]");
  if (b && siUpgrade(si, b.dataset.siUp)) { siSaveAll(); siRender(); }
});

// ---- ?mock=1 測試面板 ----
function siRenderMock() {
  const bar = $("si-mockbar");
  bar.hidden = false;
  bar.innerHTML = `測試模式(${siToday()}・速度 ×${si_speed})
    <div><button data-si-mock="sg_precept_ok">打卡戒律</button><button data-si-mock="sg_bond_ok">打卡約束</button>
    <button data-si-mock="sg_oath_ok">打卡誓言</button><button data-si-mock="all">三項一次完成</button></div>
    <div><button data-si-mock="speed">速度 ×1/×60</button><button data-si-mock="interrupt">模擬中斷</button>
    <button data-si-mock="h6">時間 +6 小時</button><button data-si-mock="d1">時間 +1 天</button><button data-si-mock="reset">重置</button></div>`;
}
$("si-mockbar").addEventListener("click", (ev) => {
  const a = ev.target.closest("[data-si-mock]")?.dataset.siMock;
  if (!a) return;
  if (a === "speed") si_speed = si_speed === 1 ? 60 : 1;
  else if (a === "interrupt") siInterrupt();
  else if (a === "h6" || a === "d1") {
    si_offset += a === "h6" ? 6 * 3600000 : siDayMs;
    localStorage.setItem(SI_MOCK_OFFSET_KEY, String(si_offset));
    if (!si.si_run) siCheckOffline();
  } else if (a === "reset") {
    [SI_MOCK_SG_KEY, SI_MOCK_STATE_KEY, SI_MOCK_OFFSET_KEY].forEach((k) => localStorage.removeItem(k));
    location.reload(); return;
  } else siMockCheckin(si_sg, siToday(), a);
  siSaveAll(); siRender();
});

// ---- 啟動 ----
function siBoot() {
  if (!si_sg?.sg_chart) {
    $("si-app").innerHTML = `<div class="si-empty">請先在「十神修行錄」建立命盤、立下本週戒律/約束/誓言,<br>再回來進入試煉場。</div>`;
    $("si-tabs").hidden = true;
    return;
  }
  si_field = siCreateField($("si-canvas"), si_hooks);
  siRender();
  if (si.si_run) {
    si_field.si_setRunning(true);
    if (si.si_run.si_boss) si_field.si_startBoss();
    siInterrupt(); // 重新開啟 = 中斷
    si.si_last_seen = siNow();
  } else siCheckOffline();
  siSaveAll();
  requestAnimationFrame(siLoop);
}
siBoot();
