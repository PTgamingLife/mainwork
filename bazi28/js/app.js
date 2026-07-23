import { supabase, APP_TIMEZONE } from "./config.js";
import {
  getSession,
  invoke,
  loadUserState,
  saveGoal,
  saveJourneyAnswer,
  saveWeeklyReview,
  signInWithGoogle,
  signOut,
  updateJourneyProgress,
} from "./api.js";
import { admin, goal, journey, onboarding, profile, reading, today } from "./render.js?v=20260723-guardian-profile";

const landing = document.querySelector("#landing");
const app = document.querySelector("#app");
const view = document.querySelector("#view");
const toastEl = document.querySelector("#toast");
const loading = document.querySelector("#loading");
const loadingText = document.querySelector("#loading-text");
const loadingGuardianAvatar = document.querySelector("#loading-guardian-avatar");
const dock = document.querySelector("#guardian-dock");

let session = null;
let state = null;
let route = "today";

function todayText(timezone = APP_TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function requestId() {
  return crypto.randomUUID();
}

function renderGuardianAvatar(container, imageUrl, alt = "你的Q版守護天使") {
  container.replaceChildren();
  if (!imageUrl) {
    const fallback = document.createElement("span");
    fallback.textContent = "✦";
    container.append(fallback);
    return;
  }
  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = alt;
  image.decoding = "async";
  image.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.textContent = "✦";
    container.replaceChildren(fallback);
  }, { once: true });
  container.append(image);
}

function showLoading(message = "正在校準…") {
  loadingText.textContent = message;
  renderGuardianAvatar(loadingGuardianAvatar, state?.guardianAssets?.chibi_url);
  loading.classList.remove("hidden");
}

function hideLoading() {
  loading.classList.add("hidden");
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function errorMessage(error) {
  console.error(error);
  toast(error?.message || "操作沒有完成，請稍後再試");
}

function updateShell() {
  const name = state?.profile?.display_name || session?.user?.user_metadata?.full_name || "旅人";
  document.querySelector("#user-name").textContent = name;
  document.querySelector("#user-initial").textContent = name.slice(0, 1);
  document.querySelector("#model-label").textContent = `模型 V${state?.model?.version || 0}`;
  const guardian = state?.guardianAssets?.guardian;
  if (guardian || state?.profile?.guardian_status === "processing") {
    dock.classList.remove("hidden");
    document.querySelector("#guardian-state").textContent = guardian?.status === "ready" ? "陪你完成下一步" : "正在形成中";
    document.querySelector("#guardian-name").textContent = guardian?.character_spec?.name || "你的守護天使";
    const avatar = document.querySelector("#guardian-avatar");
    renderGuardianAvatar(avatar, state?.guardianAssets?.chibi_url);
  } else {
    dock.classList.add("hidden");
  }
}

async function refreshState() {
  if (!session?.user) return;
  const date = todayText(state?.profile?.timezone);
  state = await loadUserState(session.user.id, date);
  if (state.guardian || state.profile?.guardian_status === "ready") {
    try { state.guardianAssets = await invoke("destiny-guardian", { action: "get" }); }
    catch (error) { console.warn("guardian assets", error); }
  }
  updateShell();
}

function render() {
  if (!state?.profile) {
    view.innerHTML = onboarding(session.user);
    document.querySelectorAll(".bottom-nav button").forEach((button) => { button.disabled = true; });
    return;
  }
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.disabled = false;
    button.classList.toggle("active", button.dataset.route === route);
  });
  const pages = {
    today: () => today(state),
    journey: () => journey(state, todayText(state.profile.timezone)),
    goal: () => goal(state),
    reading: () => reading(state),
    profile: () => profile(state),
  };
  view.innerHTML = (pages[route] || pages.today)();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function boot(authSession) {
  session = authSession;
  if (!session) {
    landing.classList.remove("hidden");
    app.classList.add("hidden");
    state = null;
    return;
  }
  landing.classList.add("hidden");
  app.classList.remove("hidden");
  showLoading("正在讀取你的旅程…");
  try {
    await refreshState();
    render();
  } catch (error) {
    errorMessage(error);
    view.innerHTML = `<div class="card error-box">無法讀取資料，請重新整理或稍後再試。</div>`;
  } finally { hideLoading(); }
}

async function createGuardianInBackground() {
  state.profile.guardian_status = "processing";
  updateShell();
  toast("守護天使開始形成，你可以繼續探索其他頁面");
  try {
    state.guardianAssets = await invoke("destiny-guardian", { action: "create", request_id: requestId() });
    state.profile.guardian_status = "ready";
    updateShell();
    toast("你的雙版本守護天使已誕生");
    if (route === "profile" || route === "today") render();
  } catch (error) {
    state.profile.guardian_status = "failed";
    updateShell();
    errorMessage(error);
  }
}

async function handleBirth(form) {
  const values = Object.fromEntries(new FormData(form));
  showLoading("建立初始模型…");
  try {
    await invoke("destiny-orchestrator", { action: "save_birth", ...values, timezone: APP_TIMEZONE });
    await refreshState();
    route = "journey";
    render();
    toast("初始模型 V0 已建立");
  } finally { hideLoading(); }
}

async function handleJourney(form) {
  const answer = form.elements.answer.value;
  if (!answer) return;
  const nextCount = state.answers.length + 1;
  showLoading("保存今天的理解…");
  try {
    await saveJourneyAnswer({
      user_id: session.user.id,
      day_index: Number(form.dataset.day),
      question_id: form.dataset.question,
      answer: { selected: answer },
      answered_on: todayText(state.profile.timezone),
    });
    await updateJourneyProgress(session.user.id, nextCount);
    await refreshState();
    render();
    toast("今天的回答已保存");
    if (nextCount === 1 && !state.guardianAssets?.guardian) createGuardianInBackground();
  } finally { hideLoading(); }
}

async function handleGoal(form) {
  const values = Object.fromEntries(new FormData(form));
  showLoading("把目標轉成可前進的座標…");
  try {
    await saveGoal({
      user_id: session.user.id,
      title: values.title,
      target_date: values.target_date,
      metric_name: values.metric_name,
      target_value: values.target_value ? Number(values.target_value) : null,
      current_value: 0,
      why_text: values.why_text,
      constraints: values.constraints ? [values.constraints] : [],
      weekly_minutes: Number(values.weekly_minutes),
    });
    await refreshState();
    route = "today";
    render();
    toast("主目標已設定");
  } finally { hideLoading(); }
}

async function handleDaily(form) {
  const values = Object.fromEntries(new FormData(form));
  showLoading("守護天使正在安排最小可行的一步…");
  try {
    await invoke("destiny-orchestrator", {
      action: "daily_action",
      request_id: requestId(),
      energy: Number(values.energy),
      available_minutes: Number(values.available_minutes),
    });
    await refreshState();
    render();
  } finally { hideLoading(); }
}

async function handleReading(form) {
  const values = Object.fromEntries(new FormData(form));
  showLoading("守護天使正在整理你的問題…");
  try {
    const result = await invoke("destiny-orchestrator", {
      action: "reading",
      request_id: requestId(),
      category: values.category,
      question: values.question,
    });
    if (result.safety) {
      toast("這個問題需要專業協助，而不是命理解讀");
      view.querySelector("form").insertAdjacentHTML("beforebegin", `<div class="card error-box">${result.answer}</div>`);
      return;
    }
    await refreshState();
    render();
  } finally { hideLoading(); }
}

async function handleWeekly(form) {
  const values = Object.fromEntries(new FormData(form));
  showLoading("保存本週回顧…");
  try {
    const review = await saveWeeklyReview({
      user_id: session.user.id,
      week_index: Number(form.dataset.week),
      answers: values,
      proposal_status: "pending",
    });
    await invoke("destiny-orchestrator", { action: "weekly_proposal", review_id: review.id });
    await refreshState();
    render();
    toast("模型更新草案已完成，等待你確認");
  } finally { hideLoading(); }
}

async function recordAction(status) {
  const reason = status === "not_completed" ? window.prompt("主要原因是什麼？例如：時間不足、任務太大、方向不清楚") : "";
  showLoading("記錄今天的真實結果…");
  try {
    await invoke("destiny-orchestrator", {
      action: "record_action",
      action_id: state.daily.id,
      status,
      failure_reason: reason || null,
    });
    await refreshState();
    render();
    toast("已記錄，下一次建議會參考這個結果");
  } finally { hideLoading(); }
}

async function runAdmin() {
  showLoading("讀取系統健康度…");
  try {
    const result = await invoke("destiny-orchestrator", { action: "admin_dashboard" });
    view.innerHTML = admin(result.metrics);
  } finally { hideLoading(); }
}

async function handleAction(action) {
  if (action === "route-goal") { route = "goal"; render(); return; }
  if (action === "create-guardian") { createGuardianInBackground(); return; }
  if (action === "action-completed") return recordAction("completed");
  if (action === "action-partial") return recordAction("partial");
  if (action === "action-missed") return recordAction("not_completed");
  if (action === "open-admin") return runAdmin();
  if (action === "logout") { await signOut(); return; }
  if (action.startsWith("proposal-review:")) {
    showLoading("產生模型更新草案…");
    try { await invoke("destiny-orchestrator", { action: "weekly_proposal", review_id: action.split(":")[1] }); await refreshState(); render(); }
    finally { hideLoading(); }
    return;
  }
  if (action.startsWith("accept-review:")) {
    showLoading("建立新的模型版本…");
    try { await invoke("destiny-orchestrator", { action: "accept_proposal", review_id: action.split(":")[1] }); await refreshState(); render(); toast("新的自我模型版本已啟用"); }
    finally { hideLoading(); }
  }
}

document.querySelector("#google-login").addEventListener("click", () => signInWithGoogle().catch(errorMessage));
document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton && state?.profile) { route = routeButton.dataset.route; render(); return; }
  const option = event.target.closest("[data-option]");
  if (option) {
    option.closest("form").querySelectorAll(".option").forEach((item) => item.classList.remove("selected"));
    option.classList.add("selected");
    option.closest("form").elements.answer.value = option.dataset.option;
    option.closest("form").querySelector("button[type=submit]").disabled = false;
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) handleAction(actionButton.dataset.action).catch(errorMessage);
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const handlers = {
    "birth-form": handleBirth,
    "journey-form": handleJourney,
    "goal-form": handleGoal,
    "daily-action-form": handleDaily,
    "reading-form": handleReading,
    "weekly-review-form": handleWeekly,
  };
  const handler = handlers[event.target.id];
  if (handler) handler(event.target).catch(errorMessage);
});

supabase.auth.onAuthStateChange((_event, authSession) => {
  if (authSession?.access_token !== session?.access_token) {
    setTimeout(() => boot(authSession), 0);
  }
});

boot(await getSession());
