/* ========== IP 定位羅盤：測驗流程與分析引擎 ========== */

const state = {
  current: 0,
  answers: new Array(QUESTIONS.length).fill(null), // 每題存選項 index
  customDomain: "",
};

const $ = (id) => document.getElementById(id);
const screens = ["landing", "quiz", "analyzing", "result"];

function showScreen(name) {
  screens.forEach((s) => $("screen-" + s).classList.toggle("active", s === name));
  window.scrollTo(0, 0);
}

/* ---------- 測驗流程 ---------- */
function renderQuestion() {
  const i = state.current;
  const q = QUESTIONS[i];

  $("progress-bar").style.width = ((i + 1) / QUESTIONS.length) * 100 + "%";
  $("progress-text").textContent = `${i + 1} / ${QUESTIONS.length}`;
  $("btn-back").disabled = i === 0;
  $("q-num").textContent = "Q" + (i + 1);
  $("q-title").textContent = q.title;
  $("q-subtitle").textContent = q.subtitle;

  const wrap = $("options");
  wrap.innerHTML = "";
  $("custom-input-wrap").hidden = true;

  q.options.forEach((opt, oi) => {
    const btn = document.createElement("button");
    btn.className = "option" + (state.answers[i] === oi ? " selected" : "");
    btn.innerHTML =
      `<span class="emo">${opt.emo}</span><span>${opt.label}` +
      (opt.desc ? `<small>${opt.desc}</small>` : "") + `</span>`;
    btn.addEventListener("click", () => selectOption(oi));
    wrap.appendChild(btn);
  });

  // 重新播放進場動畫
  const card = $("question-card");
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "";
}

function selectOption(oi) {
  const q = QUESTIONS[state.current];
  const opt = q.options[oi];

  if (opt.custom) {
    // 「其他」：顯示輸入框，確認後才前進
    state.answers[state.current] = oi;
    [...$("options").children].forEach((el, idx) =>
      el.classList.toggle("selected", idx === oi)
    );
    $("custom-input-wrap").hidden = false;
    $("custom-input").focus();
    return;
  }

  state.answers[state.current] = oi;
  setTimeout(nextQuestion, 200);
}

function nextQuestion() {
  if (state.current < QUESTIONS.length - 1) {
    state.current++;
    renderQuestion();
  } else {
    runAnalysis();
  }
}

/* ---------- 分析引擎 ---------- */
function computeResult() {
  const scores = {};
  Object.keys(ARCHETYPES).forEach((k) => (scores[k] = 0));
  const tags = {};

  state.answers.forEach((oi, qi) => {
    const opt = QUESTIONS[qi].options[oi];
    Object.entries(opt.weights || {}).forEach(([k, v]) => (scores[k] += v));
    Object.assign(tags, opt.tags || {});
  });

  if (state.customDomain) tags.domain = state.customDomain;
  if (!tags.domain) tags.domain = "你的領域";

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top3 = ranked.slice(0, 3);
  const maxScore = top3[0][1] || 1;

  return {
    tags,
    results: top3.map(([key, score], rank) => ({
      key, rank,
      match: Math.max(60, Math.round((score / maxScore) * (86 + Math.min(12, score)))),
    })),
  };
}

/* 找出使用者哪些選擇，強烈支持這個原型（作為「為什麼適合你」的依據） */
function whyReasons(archKey) {
  const reasons = [];
  state.answers.forEach((oi, qi) => {
    const opt = QUESTIONS[qi].options[oi];
    if ((opt.weights || {})[archKey] >= 2) reasons.push(opt.label);
  });
  return reasons.slice(0, 3);
}

function runAnalysis() {
  showScreen("analyzing");
  const steps = [...document.querySelectorAll("#analyze-steps li")];
  steps.forEach((li) => li.classList.remove("doing", "done"));

  steps.forEach((li, i) => {
    setTimeout(() => {
      steps.forEach((s) => s.classList.remove("doing"));
      if (i > 0) steps[i - 1].classList.add("done");
      li.classList.add("doing");
    }, i * 700);
  });

  setTimeout(() => {
    steps[steps.length - 1].classList.add("done");
    renderResult(computeResult());
    showScreen("result");
  }, steps.length * 700 + 400);
}

/* ---------- 結果頁 ---------- */
function renderResult({ tags, results }) {
  const goalText = tags.goal ? `以「${tags.goal}」為目標、` : "";
  $("result-intro").innerHTML =
    `根據你的性格、擅長的表達方式與可投入時間，AI 為${goalText}想經營「<strong>${tags.domain}</strong>」相關主題的你，找出以下 3 個方向：`;

  const wrap = $("result-cards");
  wrap.innerHTML = "";

  results.forEach(({ key, rank, match }) => {
    const a = ARCHETYPES[key];
    const reasons = whyReasons(key);
    const topics = a.topics(tags.domain);
    const card = document.createElement("div");
    card.className = "result-card" + (rank === 0 ? " rank-1" : "");
    card.innerHTML = `
      <div class="rc-head">
        <span class="rc-emoji">${a.emoji}</span>
        <div>
          <div class="rc-name">${rank === 0 ? "🏆 " : ""}定位 ${rank + 1}：${a.name}</div>
          <div class="rc-en">${a.en}</div>
        </div>
        <div class="rc-match"><b>${match}%</b><small>匹配度</small></div>
      </div>
      <div class="rc-tagline">${a.tagline}</div>
      <p class="rc-desc">${a.desc}</p>
      ${reasons.length ? `
      <div class="rc-section">
        <h4>🔎 為什麼適合你</h4>
        <p>因為你選了：${reasons.map((r) => `「${r}」`).join("、")}</p>
      </div>` : ""}
      <div class="rc-section">
        <h4>📝 你可以做的內容（以「${tags.domain}」為例）</h4>
        <ul>${topics.map((t) => `<li>${t}</li>`).join("")}</ul>
      </div>
      <div class="rc-section">
        <h4>📱 建議平台與節奏</h4>
        <p>${platformAdvice(tags.format, tags.face)}。${TIME_ADVICE[tags.time] || ""}。</p>
      </div>
      <div class="rc-first"><b>🚀 第一步：</b>${a.firstStep}</div>
    `;
    wrap.appendChild(card);
  });

  state.lastResult = { tags, results };
}

function copyResult() {
  const { tags, results } = state.lastResult;
  const lines = [
    `【我的個人 IP 定位分析】領域：${tags.domain}`,
    "",
    ...results.flatMap(({ key, rank, match }) => {
      const a = ARCHETYPES[key];
      return [
        `定位 ${rank + 1}：${a.name}（匹配度 ${match}%）`,
        `${a.tagline}`,
        `第一步：${a.firstStep}`,
        "",
      ];
    }),
    "— 來自「IP 定位羅盤」10 題測驗",
  ];
  navigator.clipboard.writeText(lines.join("\n")).then(() => {
    $("btn-copy").textContent = "✓ 已複製";
    setTimeout(() => ($("btn-copy").textContent = "📋 複製結果"), 1600);
  });
}

function restart() {
  state.current = 0;
  state.answers.fill(null);
  state.customDomain = "";
  $("custom-input").value = "";
  renderQuestion();
  showScreen("quiz");
}

/* ---------- 事件綁定 ---------- */
$("btn-start").addEventListener("click", () => {
  renderQuestion();
  showScreen("quiz");
});

$("btn-back").addEventListener("click", () => {
  if (state.current > 0) {
    state.current--;
    renderQuestion();
  }
});

$("btn-custom-ok").addEventListener("click", () => {
  const v = $("custom-input").value.trim();
  if (!v) { $("custom-input").focus(); return; }
  state.customDomain = v;
  nextQuestion();
});

$("custom-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btn-custom-ok").click();
});

$("btn-copy").addEventListener("click", copyResult);
$("btn-restart").addEventListener("click", restart);
