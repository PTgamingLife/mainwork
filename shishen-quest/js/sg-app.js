// 十神修行錄 — 控制器
import { sgCalcChart } from "./sg-bazi.js";
import {
  sgLoad, sgSave, sgEmptyState, sgSuggestVows, sgStartVows, sgCheckin, sgRealm,
} from "./sg-store.js";
import {
  sgViewOnboard, sgViewChart, sgViewAssess, sgViewVowSetup, sgViewVows, sgViewToday, sgViewGrowth,
} from "./sg-view.js";
import { SG_ASSESS } from "./sg-data.js";

// 上線時填入 LINE Developers 的 LIFF ID;空字串 = 單機模式
const SG_LIFF_ID = "";

const $main = document.getElementById("sg-main");
const $nav = document.getElementById("sg-nav");
const $toast = document.getElementById("sg-toast");
let sgState = sgLoad();
let sgView = "chart";
let sgReroll = 0;
let sgLiff = null;

function sgToast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(sgToast.t);
  sgToast.t = setTimeout(() => { $toast.hidden = true; }, 2600);
}

function sgGo(view) {
  sgView = view;
  sgRender();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function sgRender() {
  if (!sgState.sg_chart) {
    $nav.hidden = true;
    $main.innerHTML = sgViewOnboard();
    return;
  }
  $nav.hidden = false;
  document.getElementById("sg-greet").textContent = `${sgState.sg_profile.sg_nickname},以命為墨,以行為筆`;
  const views = {
    chart: () => sgViewChart(sgState),
    assess: () => sgViewAssess(sgState),
    vows: () => (sgState.sg_vows ? sgViewVows(sgState) : sgViewVowSetup(sgState, sgSuggestVows(sgState, sgReroll))),
    today: () => sgViewToday(sgState),
    growth: () => sgViewGrowth(sgState),
  };
  $main.innerHTML = (views[sgView] || views.chart)();
  const tab = sgView === "assess" ? "chart" : sgView;
  $nav.querySelectorAll("button").forEach((b) => {
    if (b.dataset.sgTab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

function sgHandleBirth(form) {
  const fd = new FormData(form);
  const name = String(fd.get("sg_nickname") || "").trim();
  const date = String(fd.get("sg_birth_date") || "");
  const unknown = fd.get("sg_hour_unknown") === "on";
  const time = String(fd.get("sg_birth_time") || "12:00");
  if (!name) return sgToast("請填暱稱");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sgToast("請選擇出生日期");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  try {
    sgState.sg_chart = sgCalcChart({ year, month, day, hour: unknown ? null : hour, minute: unknown ? 0 : minute });
  } catch {
    return sgToast("日期需在 1900–2100 年之間");
  }
  sgState.sg_profile = { sg_nickname: name.slice(0, 12), sg_birth_date: date, sg_birth_time: unknown ? null : time };
  sgSave(sgState);
  sgGo("chart");
}

function sgHandleAssess(form) {
  const fd = new FormData(form);
  const answers = {};
  for (const [k] of SG_ASSESS) {
    const v = Number(fd.get(k));
    if (!(v >= 1 && v <= 5)) return sgToast("每一題都要作答");
    answers[k] = v;
  }
  sgState.sg_assess = answers;
  sgSave(sgState);
  sgToast("自評完成,雷達圖已疊上現況");
  sgGo("chart");
}

function sgHandleOath(form) {
  const text = String(new FormData(form).get("sg_oath") || "").trim();
  if (text.length < 4) return sgToast("誓言至少寫 4 個字");
  sgStartVows(sgState, sgSuggestVows(sgState, sgReroll), text);
  sgSave(sgState);
  sgToast("三誓已立,明早記得回來打卡");
  sgGo("today");
}

function sgHandleCheckin(form) {
  const fd = new FormData(form);
  const before = sgRealm(sgState).cur.sg_name;
  const { streak, earnedAmulet } = sgCheckin(sgState, {
    sg_precept_ok: fd.get("sg_precept_ok") === "on",
    sg_bond_ok: fd.get("sg_bond_ok") === "on",
    sg_oath_pct: Math.min(100, Math.max(0, Number(fd.get("sg_oath_pct")) || 0)),
    sg_note: String(fd.get("sg_note") || "").trim().slice(0, 60),
  });
  sgSave(sgState);
  const after = sgRealm(sgState).cur.sg_name;
  sgToast(after !== before ? `境界晉升:${after}!` : earnedAmulet ? `連續 ${streak} 天,獲得護符一枚` : `已落印,連續 ${streak} 天`);
  sgGo("growth");
}

async function sgShare() {
  const text = `我在「十神修行錄」立下誓言:${sgState.sg_vows.sg_oath.sg_text}。30 天後來驗收我!`;
  try {
    if (sgLiff?.isApiAvailable?.("shareTargetPicker")) {
      await sgLiff.shareTargetPicker([{ type: "text", text }]);
    } else if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      sgToast("已複製,貼給好友吧");
    }
  } catch { /* 使用者取消 */ }
}

$main.addEventListener("submit", (e) => {
  e.preventDefault();
  const handlers = { "sg-form-birth": sgHandleBirth, "sg-form-assess": sgHandleAssess, "sg-form-oath": sgHandleOath, "sg-form-checkin": sgHandleCheckin };
  handlers[e.target.id]?.(e.target);
});

$main.addEventListener("input", (e) => {
  if (e.target.name === "sg_oath_pct") document.getElementById("sg-pct-out").textContent = e.target.value;
});

$main.addEventListener("click", (e) => {
  const go = e.target.closest("[data-sg-go]");
  if (go) return sgGo(go.dataset.sgGo);
  const act = e.target.closest("[data-sg-act]")?.dataset.sgAct;
  if (act === "reroll") { sgReroll += 1; sgRender(); }
  if (act === "renew") { sgState.sg_vows = null; sgReroll = 0; sgSave(sgState); sgGo("vows"); }
  if (act === "share") sgShare();
  if (act === "reset" && confirm("確定要清除所有資料、重新排盤嗎?")) { sgState = sgEmptyState(); sgSave(sgState); sgGo("chart"); }
});

$nav.addEventListener("click", (e) => {
  const b = e.target.closest("[data-sg-tab]");
  if (b) sgGo(b.dataset.sgTab);
});

async function sgInitLiff() {
  if (!SG_LIFF_ID) return;
  try {
    await new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    await window.liff.init({ liffId: SG_LIFF_ID });
    sgLiff = window.liff;
  } catch { /* LIFF 失敗時退回單機模式 */ }
}

sgView = sgState.sg_vows ? "today" : "chart";
sgRender();
sgInitLiff();
