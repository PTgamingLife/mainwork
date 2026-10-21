// 十神修行錄 — 控制器
import { sgCalcChart } from "./sg-bazi.js";
import {
  sgLoad, sgSave, sgEmptyState, sgStartWeek, sgCheckin, sgRealm, sgSubmitReview, sgWeekProgress,
} from "./sg-store.js";
import {
  sgViewOnboard, sgViewChart, sgViewToday, sgViewAngel, sgViewReview, sgViewGrowth, sgDeltaChips,
} from "./sg-view.js";
import { SG_OATH_TYPES, SG_WEEKLY_QUESTIONS } from "./sg-data.js";
import { sgOathDelta } from "./sg-store.js";

// LINE Developers 的 LIFF ID;空字串 = 單機模式(只存 localStorage)
const SG_LIFF_ID = "2011684838-Jdzxtrxn";
const SG_API_URL = "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/sg-api";

const $main = document.getElementById("sg-main");
const $nav = document.getElementById("sg-nav");
const $toast = document.getElementById("sg-toast");
let sgState = sgLoad();
let sgView = "chart";
const sgUi = { oathType: 0, precept: 0 };
let sgLiff = null;
let sgSyncTimer = 0;

async function sgApi(action, extra = {}) {
  const idToken = sgLiff?.getIDToken?.();
  if (!idToken) throw new Error("NO_ID_TOKEN");
  const res = await fetch(SG_API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, idToken, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.reason || data.error || `HTTP_${res.status}`);
  return data;
}

// 存本機,登入 LINE 時再同步到雲端(合併 1 秒內的多次變更);notify = 要伺服器順便推 LINE 訊息
function sgPersist(notify = "") {
  sgSave(sgState);
  if (!sgLiff || !sgState.sg_profile?.sg_consent_at) return;
  clearTimeout(sgSyncTimer);
  sgSyncTimer = setTimeout(() => {
    sgApi("save", { state: sgState, notify }).catch((e) => sgToast(`雲端同步失敗(${e.message}),資料已先存在手機`));
  }, notify ? 0 : 1000);
}

function sgToast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(sgToast.t);
  sgToast.t = setTimeout(() => { $toast.hidden = true; }, 3200);
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
    chart: () => sgViewChart(sgState, sgUi),
    today: () => sgViewToday(sgState),
    angel: () => sgViewAngel(sgState),
    review: () => (sgState.sg_week ? sgViewReview(sgState) : sgViewGrowth(sgState)),
    growth: () => sgViewGrowth(sgState),
  };
  $main.innerHTML = (views[sgView] || views.chart)();
  const tab = sgView === "review" ? "growth" : sgView;
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
  if (fd.get("sg_consent") !== "on") return sgToast("請先閱讀並同意個人資料說明");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sgToast("請選擇出生日期");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  try {
    sgState.sg_chart = sgCalcChart({ year, month, day, hour: unknown ? null : hour, minute: unknown ? 0 : minute });
  } catch {
    return sgToast("日期需在 1900–2100 年之間");
  }
  sgState.sg_profile = { sg_nickname: name.slice(0, 12), sg_birth_date: date, sg_birth_time: unknown ? null : time, sg_consent_at: new Date().toISOString() };
  sgPersist();
  sgGo("chart");
}

function sgHandleVow(form) {
  const fd = new FormData(form);
  const text = String(fd.get("sg_oath") || "").trim();
  if (text.length < 4) return sgToast("誓言至少寫 4 個字");
  sgStartWeek(sgState, Number(fd.get("sg_precept")) || 0, Number(fd.get("sg_oath_type")) || 0, text);
  sgPersist("vows");
  sgToast("已落款立誓,第一週修行開始");
  sgGo("today");
}

function sgHandleCheckin(form) {
  const fd = new FormData(form);
  const before = sgRealm(sgState).cur.sg_name;
  const { streak, earnedAmulet } = sgCheckin(sgState, {
    sg_precept_ok: fd.get("sg_precept_ok") === "on",
    sg_bond_ok: fd.get("sg_bond_ok") === "on",
    sg_oath_ok: fd.get("sg_oath_ok") === "on",
    sg_oath_pct: Math.min(100, Math.max(0, Number(fd.get("sg_oath_pct")) || 0)),
    sg_score: Math.min(10, Math.max(1, Number(fd.get("sg_score")) || 1)),
    sg_note: String(fd.get("sg_note") || "").trim().slice(0, 60),
  });
  sgPersist();
  const after = sgRealm(sgState).cur.sg_name;
  sgToast(after !== before ? `境界晉升:${after}!` : earnedAmulet ? `連續 ${streak} 天,獲得護符一枚` : `已落印,連續 ${streak} 天`);
  sgGo("growth");
}

function sgHandleReview(form) {
  const fd = new FormData(form);
  const answers = SG_WEEKLY_QUESTIONS.map((_, i) => Number(fd.get(`q${i}`)));
  if (answers.some((v) => !(v >= 1 && v <= 5))) return sgToast("每一題都要作答");
  const { passed } = sgSubmitReview(sgState, answers);
  sgPersist();
  const n = Object.values(passed).filter(Boolean).length;
  sgToast(n ? `${n} 項任務完成,能量已進化!` : "這週沒有任務達標,下週再來");
  sgGo("chart");
}

async function sgShare() {
  const text = `我在「十神修行錄」立下誓言:${sgState.sg_week?.sg_oath.sg_text ?? ""}。來當我的見證人!`;
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
  const handlers = { "sg-form-birth": sgHandleBirth, "sg-form-vow": sgHandleVow, "sg-form-checkin": sgHandleCheckin, "sg-form-review": sgHandleReview };
  handlers[e.target.id]?.(e.target);
});

$main.addEventListener("input", (e) => {
  const out = { sg_oath_pct: "sg-pct-out", sg_score: "sg-score-out" }[e.target.name];
  if (out) document.getElementById(out).textContent = e.target.value;
  if (e.target.name === "sg_precept") sgUi.precept = Number(e.target.value);
  if (e.target.name === "sg_oath_type") {
    // 只換誓言區的提示,不重畫整頁(保留已輸入的文字)
    sgUi.oathType = Number(e.target.value);
    const t = SG_OATH_TYPES[sgUi.oathType];
    document.getElementById("sg-oath-chips").innerHTML = sgDeltaChips(sgOathDelta(sgUi.oathType));
    e.target.form.sg_oath.placeholder = t.sg_example;
  }
});

$main.addEventListener("click", (e) => {
  const go = e.target.closest("[data-sg-go]");
  if (go) return sgGo(go.dataset.sgGo);
  const act = e.target.closest("[data-sg-act]")?.dataset.sgAct;
  if (act === "share") sgShare();
  if (act === "reset" && confirm("確定要清除所有資料(含雲端紀錄)、重新排盤嗎?")) {
    if (sgLiff) sgApi("delete").catch(() => {});
    sgState = sgEmptyState(); sgSave(sgState); sgGo("chart");
  }
});

$nav.addEventListener("click", (e) => {
  const b = e.target.closest("[data-sg-tab]");
  if (b) sgGo(b.dataset.sgTab);
});

function sgDefaultView() {
  if (!sgState.sg_week) return "chart";
  return sgWeekProgress(sgState).sg_ended ? "review" : "today";
}

async function sgInitLiff() {
  if (!SG_LIFF_ID || new URLSearchParams(location.search).has("mock")) return; // ?mock=1 = 單機試玩
  try {
    await new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    await window.liff.init({ liffId: SG_LIFF_ID });
    if (!window.liff.isLoggedIn()) { window.liff.login(); return; }
    sgLiff = window.liff;
    const r = await sgApi("load");
    if (r?.state?.sg_chart) {
      // 雲端有資料 → 以雲端為準(換手機也能接續)
      sgState = { ...sgEmptyState(), ...r.state };
      sgSave(sgState);
      sgView = sgDefaultView();
      sgRender();
    } else if (sgState.sg_profile?.sg_consent_at) {
      sgPersist(); // 先在單機玩過 → 上傳
    }
  } catch (e) {
    if (sgLiff) sgToast(`無法連上雲端(${e.message})`);
  }
}

sgView = sgDefaultView();
sgRender();
sgInitLiff();
