// 十神修行錄 — 控制器
import { sgCalcChart } from "./sg-bazi.js?v=20261024a";
import {
  sgLoad, sgSave, sgEmptyState, sgStartWeek, sgResetWeek, sgCheckin, sgRealm, sgSubmitReview, sgWeekProgress,
  sgFallbackOptions, sgEnergies, sgWishPool, sgMakeWish, sgFallbackWish, sgAngel,
} from "./sg-store.js?v=20261024a";
import {
  sgViewOnboard, sgViewChart, sgViewToday, sgViewAngel, sgViewReview, sgViewGrowth,
} from "./sg-view.js?v=20261024a";
import { SG_WEEKLY_QUESTIONS } from "./sg-data.js?v=20261024a";
import { SG_TRANSFORMS, sgVowPlan, sgOathDefaultKey } from "./sg-wuxing.js?v=20261024a";
import { sgCastYao, sgAddYao, sgTodayDivine, sgSetDivineText } from "./sg-divine.js?v=20261024a";

// LINE Developers 的 LIFF ID;空字串 = 單機模式(只存 localStorage)
const SG_LIFF_ID = "2011684838-Jdzxtrxn";
const SG_API_URL = "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/sg-api";

const $main = document.getElementById("sg-main");
const $toast = document.getElementById("sg-toast");
let sgState = sgLoad();
let sgView = "chart";
const sgUi = { options: null, oathWish: "", preceptWish: "", loading: false, wishing: false, wishResult: null, divineError: "" };
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
    $main.innerHTML = sgViewOnboard();
    return;
  }
  document.getElementById("sg-greet").textContent = `${sgState.sg_profile.sg_nickname},以命為墨,以行為筆`;
  const views = {
    chart: () => sgViewChart(sgState, sgUi),
    today: () => sgViewToday(sgState, sgUi),
    angel: () => sgViewAngel(sgState, sgUi),
    review: () => (sgState.sg_week ? sgViewReview(sgState) : sgViewGrowth(sgState)),
    growth: () => sgViewGrowth(sgState),
  };
  $main.innerHTML = (views[sgView] || views.chart)();
  // 今天已成卦但還沒有卦辭(例如上次離線):進到今日頁時自動補抓
  const d = sgTodayDivine(sgState);
  if (sgView === "today" && d?.sg_bits && !d.sg_text && !sgUi.divineError) setTimeout(sgFetchDivineText, 0);
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

// ① 寫下想法 → AI 整理(未登入 LINE 或 AI 失敗時用系統建議)
async function sgHandleWish(form) {
  const fd = new FormData(form);
  sgUi.oathWish = String(fd.get("sg_oath_wish") || "").trim();
  sgUi.preceptWish = String(fd.get("sg_precept_wish") || "").trim();
  if (sgUi.oathWish.length < 2) return sgToast("請先寫下你想立下的誓言");
  sgUi.loading = true; sgRender();
  try {
    if (!sgLiff) throw new Error("離線模式");
    clearTimeout(sgSyncTimer);
    await sgApi("save", { state: sgState }); // 確保雲端已有資料列(AI 次數記在上面)
    const r = await sgApi("suggest", { oath_wish: sgUi.oathWish, precept_wish: sgUi.preceptWish, energies: sgEnergies(sgState), day_master: sgState.sg_chart.sg_day_master });
    const o = r.options;
    if (!(o?.oaths?.length && o?.precepts?.length && o?.bonds?.length)) throw new Error("AI 回傳不完整");
    sgUi.options = sgWithPlan(o);
  } catch (e) {
    sgUi.options = { ...sgFallbackOptions(sgState, sgUi.oathWish, sgUi.preceptWish), fallback: e.message === "AI_LIMIT" ? "今天的 5 次已用完" : e.message };
  }
  sgUi.loading = false;
  sgRender();
}

// 轉化型態一律由前端依命盤計算(舊版伺服器回傳沒有這些欄位也能用)
function sgWithPlan(o) {
  const dm = sgState.sg_chart.sg_day_master;
  return {
    ...o, ...sgVowPlan(dm, o.s, o.w2),
    oaths: o.oaths.map((x) => ({ ...x, transform: SG_TRANSFORMS[x.transform] ? x.transform : sgOathDefaultKey(dm, x.energy) })),
  };
}

// ② 三類各選一個 → 落款
function sgHandleVow(form) {
  const fd = new FormData(form);
  const pick = { oath: Number(fd.get("sg_oath")) || 0, precept: Number(fd.get("sg_precept")) || 0, bond: Number(fd.get("sg_bond")) || 0 };
  const edits = { oath: fd.get("sg_oath_text"), precept: fd.get("sg_precept_text"), bond: fd.get("sg_bond_text") };
  for (const k in edits) edits[k] = String(edits[k] || "").trim().slice(0, 80);
  if (!edits.oath || !edits.precept || !edits.bond) return sgToast("誓言、戒律、約束的文字都不能空白");
  sgStartWeek(sgState, sgUi.options, pick, edits);
  sgUi.options = null;
  sgPersist("vows");
  sgToast("已落款立誓,第一週修行開始");
  sgGo("today");
}

function sgHandleCheckin(form) {
  const fd = new FormData(form);
  const before = sgRealm(sgState).cur.sg_name;
  const { streak, earnedAmulet, gain } = sgCheckin(sgState, {
    sg_precept_ok: fd.get("sg_precept_ok") === "on",
    sg_bond_ok: fd.get("sg_bond_ok") === "on",
    sg_oath_ok: fd.get("sg_oath_ok") === "on",
  });
  sgPersist();
  const after = sgRealm(sgState).cur.sg_name;
  const got = gain.reduce((a, b) => a + b, 0);
  sgToast(after !== before ? `境界晉升:${after}!` : earnedAmulet ? `連續 ${streak} 天,獲得護符一枚` : `已落印,連續 ${streak} 天${got ? `・能量 +${got.toFixed(1)}` : ""}`);
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

// 許願:AI 依願望決定消耗比例並回應;未登入 LINE 或 AI 失敗時用固定回應
async function sgHandleAngelWish(form) {
  const text = String(new FormData(form).get("sg_wish") || "").trim();
  if (text.length < 2) return sgToast("請寫下你的願望");
  const { pool, total } = sgWishPool(sgState);
  if (total < 2) return sgToast("修行能量還不夠 2");
  const a = sgAngel(sgState);
  sgUi.wishing = true; sgRender();
  let result;
  try {
    if (!sgLiff) throw new Error("離線模式");
    const r = await sgApi("wish", { wish: text, pool, angel_name: a.sg_name, angel_trait: a.sg_trait });
    result = r.wish;
  } catch (e) {
    result = sgFallbackWish(sgState, text);
    if (e.message === "AI_LIMIT") sgToast("今天的 AI 次數已用完,由天使先給你一段祝福");
  }
  sgUi.wishResult = sgMakeWish(sgState, text, result);
  sgUi.wishing = false;
  sgPersist();
  sgRender();
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
  const handlers = { "sg-form-birth": sgHandleBirth, "sg-form-wish": sgHandleWish, "sg-form-vow": sgHandleVow, "sg-form-checkin": sgHandleCheckin, "sg-form-wish-angel": sgHandleAngelWish, "sg-form-review": sgHandleReview };
  handlers[e.target.id]?.(e.target);
});

$main.addEventListener("input", (e) => {
  const out = { sg_score: "sg-score-out" }[e.target.name];
  if (out) document.getElementById(out).textContent = e.target.value;
});

// ---- 今日卜卦:按住龜殼約 1 秒(或實際搖手機約 1 秒)得一爻 ----
const SG_SHAKE_MS = 1000;
let sgHoldTimer = 0;
let sgShakeMs = 0;
let sgLastMotion = 0;

function sgTurtle(on) {
  document.getElementById("sg-turtle")?.classList.toggle("sg-shaking", on);
}

function sgYao() {
  clearTimeout(sgHoldTimer); sgHoldTimer = 0; sgShakeMs = 0;
  const d = sgTodayDivine(sgState);
  if (d?.sg_lines?.length >= 6) return;
  const yao = sgCastYao();
  const done = sgAddYao(sgState, yao);
  sgToast(`得一爻:${yao.coins.map((c) => (c === 3 ? "正" : "反")).join("、")} → ${yao.value}`);
  sgPersist();
  sgRender();
  if (done) sgFetchDivineText();
}

async function sgFetchDivineText() {
  const d = sgTodayDivine(sgState);
  if (!d?.sg_bits || d.sg_text || sgUi.divineLoading) return;
  sgUi.divineError = "";
  sgUi.divineLoading = true;
  try {
    if (!sgLiff) throw new Error("離線模式");
    const r = await sgApi("hexagram", { bits: d.sg_bits, changed: d.sg_changed || "" });
    if (!r?.main) throw new Error("查無此卦");
    sgSetDivineText(sgState, r);
    sgPersist();
  } catch (e) {
    sgUi.divineError = e.message;
  }
  sgUi.divineLoading = false;
  if (sgView === "today") sgRender();
}

// iOS 需在使用者手勢內請求動作感測權限
let sgMotionAsked = false;
function sgAskMotion() {
  if (sgMotionAsked) return;
  sgMotionAsked = true;
  const DM = window.DeviceMotionEvent;
  if (DM && typeof DM.requestPermission === "function") DM.requestPermission().catch(() => {});
}

$main.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#sg-turtle")) return;
  e.preventDefault();
  sgAskMotion();
  sgTurtle(true);
  clearTimeout(sgHoldTimer);
  sgHoldTimer = setTimeout(sgYao, SG_SHAKE_MS);
});
const sgHoldEnd = () => {
  if (!sgHoldTimer) return;
  clearTimeout(sgHoldTimer); sgHoldTimer = 0;
  sgTurtle(false);
  sgToast("再按久一點,搖滿約 1 秒才會出爻");
};
["pointerup", "pointercancel", "pointerleave"].forEach((t) => $main.addEventListener(t, (e) => {
  if (e.target.closest?.("#sg-turtle")) sgHoldEnd();
}));
$main.addEventListener("contextmenu", (e) => { if (e.target.closest("#sg-turtle")) e.preventDefault(); });

// 實際搖手機:加速度明顯變化累積約 1 秒就出一爻
window.addEventListener("devicemotion", (e) => {
  if (sgView !== "today" || !document.getElementById("sg-turtle")) return;
  const a = e.acceleration || e.accelerationIncludingGravity;
  if (!a) return;
  const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0) - (e.acceleration ? 0 : 9.8);
  const now = Date.now();
  if (Math.abs(mag) > 6) {
    sgShakeMs += Math.min(100, now - (sgLastMotion || now));
    sgTurtle(true);
    if (sgShakeMs >= SG_SHAKE_MS) sgYao();
  } else if (now - sgLastMotion > 400) {
    sgShakeMs = 0;
    if (!sgHoldTimer) sgTurtle(false);
  }
  sgLastMotion = now;
});

// 換選項時,把該選項文字帶進下方的微調欄
$main.addEventListener("change", (e) => {
  const t = e.target;
  if (t.type !== "radio" || !sgUi.options) return;
  const list = { sg_oath: sgUi.options.oaths, sg_precept: sgUi.options.precepts, sg_bond: sgUi.options.bonds }[t.name];
  const box = t.form?.querySelector(`[data-sg-edit="${t.name}"]`);
  if (list && box) box.value = list[Number(t.value)]?.text || "";
});

$main.addEventListener("click", (e) => {
  const go = e.target.closest("[data-sg-go]");
  if (go) return sgGo(go.dataset.sgGo);
  const act = e.target.closest("[data-sg-act]")?.dataset.sgAct;
  if (act === "share") sgShare();
  if (act === "rewish") { sgUi.options = null; sgRender(); }
  if (act === "divine-text") sgFetchDivineText();
  if (act === "revow" && confirm("重新立誓會結束本週的戒律、約束、誓言(已打卡紀錄保留),確定嗎?")) {
    sgResetWeek(sgState); sgUi.options = null; sgPersist(); sgGo("chart");
    setTimeout(() => document.getElementById("sg-form-wish")?.scrollIntoView({ behavior: "smooth" }), 100);
  }
  if (act === "reset" && confirm("確定要清除所有資料(含雲端紀錄)、重新排盤嗎?")) {
    if (sgLiff) sgApi("delete").catch(() => {});
    sgState = sgEmptyState(); sgSave(sgState); sgGo("chart");
  }
});

// LINE 圖文選單四格各自開 LIFF:…?view=chart|today|angel|growth
// (LIFF 首次開啟時參數會包在 liff.state 裡,init 後才還原到網址)
const SG_VIEWS = ["chart", "today", "angel", "growth"];
function sgRequestedView() {
  const q = new URLSearchParams(location.search);
  let v = q.get("view");
  if (!v && q.get("liff.state")) v = new URLSearchParams(q.get("liff.state").replace(/^[^?]*\?/, "")).get("view");
  return SG_VIEWS.includes(v) ? v : "";
}

function sgDefaultView() {
  const asked = sgRequestedView();
  if (asked) return asked === "growth" && sgState.sg_week && sgWeekProgress(sgState).sg_ended ? "review" : asked;
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
