import { JOURNEY_QUESTIONS, WEEKLY_REVIEW_ITEMS } from "./data.js";

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
}

function head(kicker, title, description, side = "") {
  return `<div class="page-head"><div><p class="kicker">${kicker}</p><h2>${title}</h2><p>${description}</p></div>${side}</div>`;
}

function button(label, action, className = "primary-button", extra = "") {
  return `<button class="${className}" type="button" data-action="${action}" ${extra}>${label}</button>`;
}

export function onboarding(user) {
  const name = escapeHtml(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "");
  return `${head("START", "先建立你的初始座標", "出生資料只用於建立固定命理層；你可以稍後更正。")}
    <form id="birth-form" class="card form-card">
      <div class="field"><label for="display-name">怎麼稱呼你？</label><input id="display-name" name="display_name" value="${name}" maxlength="80" required></div>
      <div class="field-grid">
        <div class="field"><label for="birth-date">出生日期</label><input id="birth-date" name="birth_date" type="date" required></div>
        <div class="field"><label for="birth-time">出生時間</label><input id="birth-time" name="birth_time" type="time"></div>
      </div>
      <div class="field-grid">
        <div class="field"><label for="birth-city">出生城市</label><input id="birth-city" name="birth_city" placeholder="例如：新北市" maxlength="80" required></div>
        <div class="field"><label for="birth-country">國家／地區</label><input id="birth-country" name="birth_country" value="台灣" maxlength="80" required></div>
      </div>
      <div class="field"><label for="birth-confidence">出生時間可信度</label><select id="birth-confidence" name="birth_time_confidence" required><option value="exact">戶口資料／非常確定</option><option value="approximate">大約時間</option><option value="unknown">不知道時辰</option></select></div>
      <div class="quote">命盤是初始假設，不是人生判決。系統會把它與你接下來30天的真實回答分開保存。</div>
      <div class="action-row"><button class="primary-button" type="submit">建立初始模型</button></div>
    </form>`;
}

function actionCard(state) {
  if (!state.goal) {
    return `<article class="card hero-card"><p class="kicker">TODAY'S STEP</p><h3 class="task-title">先設定一個90天主目標，守護天使才能替你安排真正有方向的每日行動。</h3>${button("設定我的目標", "route-goal")}</article>`;
  }
  if (!state.daily) {
    return `<article class="card hero-card"><p class="kicker">TODAY'S STEP</p><h3 class="task-title">今天，你有多少力量可以留給重要的目標？</h3>
      <form id="daily-action-form"><div class="field-grid"><div class="field"><label>目前能量</label><select name="energy"><option value="5">精力充足</option><option value="4">狀態不錯</option><option value="3" selected>普通</option><option value="2">有點疲累</option><option value="1">只想維持不中斷</option></select></div><div class="field"><label>可用時間</label><select name="available_minutes"><option value="5">5分鐘</option><option value="15">15分鐘</option><option value="25" selected>25分鐘</option><option value="45">45分鐘</option><option value="60">60分鐘</option></select></div></div><button class="primary-button" type="submit">產生今日行動</button></form></article>`;
  }
  const task = state.daily;
  const finished = task.status !== "pending";
  return `<article class="card hero-card"><p class="kicker">TODAY'S STEP · ${task.minutes} MIN</p><h3 class="task-title">${escapeHtml(task.action_text)}</h3><div class="task-meta"><span>完成：${escapeHtml(task.done_definition)}</span><span>輕量版：${escapeHtml(task.lite_version)}</span></div><p>${escapeHtml(task.rationale)}</p>
    ${finished ? `<div class="quote">今天已回報：${escapeHtml(task.status)}</div>` : `<div class="action-row">${button("完成了", "action-completed")}${button("完成一部分", "action-partial", "secondary-button")}${button("沒完成", "action-missed", "secondary-button")}</div>`}</article>`;
}

function fortuneCard(fortune) {
  if (!fortune) return `<article class="card wide-card fortune-card fortune-loading"><p class="kicker">DAILY FORTUNE</p><h3>今日運勢正在校準</h3><p>完成出生資料後，系統會結合你的日柱與當日干支建立行動參考。</p></article>`;
  const scoreItems = fortune.scores.map((item) => `<div class="fortune-score ${item.key === fortune.highlight.key ? "is-highlight" : ""}"><div><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.level)}</small></div><b>${item.score}</b><i style="--score:${item.score}%"></i></div>`).join("");
  return `<article class="card wide-card fortune-card">
    <div class="fortune-heading"><div><p class="kicker">DAILY FORTUNE · ${escapeHtml(fortune.date)}</p><h3>今日運勢重點</h3></div><span class="pillar-badge">今日 ${escapeHtml(fortune.day_pillar)} · ${escapeHtml(fortune.day_element)}</span></div>
    <div class="fortune-highlight"><small>今日最亮點</small><strong>${escapeHtml(fortune.highlight.label)} ${fortune.highlight.score} 分</strong><p>${escapeHtml(fortune.highlight.message)}</p></div>
    <div class="fortune-scores">${scoreItems}</div>
    <div class="fortune-reasons"><span>你的日柱 ${escapeHtml(fortune.natal_day_pillar)}</span><span>${escapeHtml(fortune.relation_text)}</span><span>${escapeHtml(fortune.branch_interaction)}</span></div>
    <p class="fortune-disclaimer">${escapeHtml(fortune.disclaimer)}</p>
  </article>`;
}

export function today(state) {
  const count = state.answers.length;
  const progress = Math.round(count / 30 * 100);
  const confidence = Math.round((state.model?.confidence ?? .1) * 100);
  return `${head("TODAY", `你好，${escapeHtml(state.profile.display_name || "旅人")}`, "今天不需要改變人生，只要完成下一步。", `<div class="progress-ring" style="--progress:${progress}%"><b>${count}/30</b></div>`)}
    <div class="grid">${actionCard(state)}
      <article class="card side-card"><p class="kicker">MODEL</p><h3>理解正在形成</h3><div class="stat"><span>探索進度</span><b>${progress}%</b></div><div class="stat"><span>模型信心</span><b>${confidence}%</b></div><div class="stat"><span>日主天干</span><b>${escapeHtml(state.profile.day_stem || "—")}${escapeHtml(state.profile.day_element || "")}</b></div></article>
      ${fortuneCard(state.fortune)}
      <article class="card half-card"><p class="kicker">GOAL</p><h3>${state.goal ? escapeHtml(state.goal.title) : "尚未設定主目標"}</h3><p>${state.goal ? `期限 ${escapeHtml(state.goal.target_date)} · 每週投入 ${state.goal.weekly_minutes} 分鐘` : "目標會把每日建議從漂亮話，變成可驗證的進展。"}</p>${!state.goal ? button("建立目標", "route-goal", "secondary-button") : ""}</article>
      <article class="card half-card"><p class="kicker">GUARDIAN</p><h3>${escapeHtml(state.guardianAssets?.guardian?.character_spec?.name || "守護天使正在靠近")}</h3><p>${state.guardianAssets?.guardian?.status === "ready" ? escapeHtml(state.guardianAssets.guardian.character_spec.essence) : "完成第一道探索後，AI會依天干與回答生成擬真、Q版兩個版本。"}</p>${state.answers.length && !state.guardianAssets?.guardian ? button("喚醒守護天使", "create-guardian", "secondary-button") : ""}</article>
    </div>`;
}

function weeklyReview(state) {
  const week = Math.floor(state.answers.length / 7);
  const existing = state.reviews.find((item) => item.week_index === week);
  if (![1, 2, 3, 4].includes(week) || state.answers.length % 7 !== 0) return "";
  if (existing) {
    const proposal = existing.proposal;
    return `<article class="card wide-card"><p class="kicker">WEEK ${week} REVIEW</p><h3>本週模型校準</h3>${proposal ? `<p>${escapeHtml(proposal.change_note)}</p><div class="quote">信心程度 ${Math.round(proposal.confidence * 100)}% · 你確認後才會更新模型。</div>${existing.proposal_status === "pending" ? button("同意這次更新", `accept-review:${existing.id}`) : `<p>狀態：${escapeHtml(existing.proposal_status)}</p>`}` : `<p>回顧已保存，模型更新草案正在等待產生。</p>${button("產生模型草案", `proposal-review:${existing.id}`)}`}</article>`;
  }
  return `<article class="card wide-card"><p class="kicker">WEEK ${week} REVIEW</p><h3>花一分鐘回看這一週</h3><form id="weekly-review-form" data-week="${week}">${WEEKLY_REVIEW_ITEMS.map((item) => `<div class="field"><label>${escapeHtml(item.text)}</label><select name="${item.id}" required><option value="">請選擇</option>${item.options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></div>`).join("")}<button class="primary-button" type="submit">完成本週回顧</button></form></article>`;
}

export function journey(state, todayText) {
  const count = state.answers.length;
  const question = JOURNEY_QUESTIONS[count];
  const answeredToday = state.answers.some((item) => item.answered_on === todayText);
  const weeks = ["我是誰", "我想去哪裡", "什麼阻止我", "我要如何前進"];
  let main = "";
  if (count >= 30) {
    main = `<article class="card wide-card guardian-panel"><p class="kicker">JOURNEY COMPLETE</p><h3>30天探索已完成</h3><p>你已累積足夠資料建立個人模型 V1。接下來，系統會繼續用每週回顧校準，而不是把你定型。</p></article>`;
  } else if (answeredToday) {
    main = `<article class="card wide-card empty"><h3>今天的探索已完成</h3><p>不用一次回答完人生。明天，守護天使會帶來下一題。</p></article>`;
  } else {
    main = `<article class="card wide-card"><p class="kicker">DAY ${count + 1} · ${escapeHtml(question.theme)}</p><h3>${escapeHtml(question.text)}</h3><form id="journey-form" data-day="${count + 1}" data-question="${question.id}"><div class="option-grid">${question.options.map((option) => `<button class="option" type="button" data-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}</div><input type="hidden" name="answer" required><button class="primary-button" type="submit" disabled>保存今天的回答</button></form></article>`;
  }
  return `${head("30-DAY JOURNEY", "每天認識自己一點", "一天一題，不補考、不歸零。", `<div class="progress-ring" style="--progress:${count / 30 * 100}%"><b>${count}/30</b></div>`)}
    <div class="journey-map">${weeks.map((week, index) => `<div class="journey-week ${Math.floor(count / 7) === index ? "active" : ""}"><small>第${index + 1}週</small><b>${week}</b></div>`).join("")}</div><div class="grid">${main}${weeklyReview(state)}</div>`;
}

export function goal(state) {
  if (state.goal) {
    const value = state.goal.current_value ?? 0;
    const target = state.goal.target_value ?? 0;
    return `${head("90-DAY GOAL", "你的主目標", "每天的建議都必須能解釋：為什麼更接近它？")}
      <article class="card form-card"><p class="kicker">ACTIVE</p><h3>${escapeHtml(state.goal.title)}</h3><p>${escapeHtml(state.goal.why_text)}</p><div class="stat"><span>衡量方式</span><b>${escapeHtml(state.goal.metric_name)}</b></div><div class="stat"><span>目前／目標</span><b>${value} / ${target || "—"}</b></div><div class="stat"><span>期限</span><b>${escapeHtml(state.goal.target_date)}</b></div><div class="stat"><span>每週投入</span><b>${state.goal.weekly_minutes} 分</b></div></article>`;
  }
  const target = new Date(); target.setDate(target.getDate() + 90);
  return `${head("90-DAY GOAL", "把願望變成可前進的目標", "第一版同時只保留一個主目標，避免努力被切碎。")}
    <form id="goal-form" class="card form-card"><div class="field"><label>90天後想完成什麼？</label><input name="title" maxlength="160" placeholder="例如：建立每月可產生10,000元的顧問服務" required></div><div class="field-grid"><div class="field"><label>截止日期</label><input type="date" name="target_date" value="${target.toISOString().slice(0,10)}" required></div><div class="field"><label>每週可投入分鐘</label><input type="number" name="weekly_minutes" min="15" max="10080" value="180" required></div></div><div class="field-grid"><div class="field"><label>衡量方式</label><input name="metric_name" placeholder="例如：有效提案數" required></div><div class="field"><label>目標數字</label><input type="number" step="any" name="target_value" placeholder="20"></div></div><div class="field"><label>為什麼這對你重要？</label><textarea name="why_text" maxlength="1000" required></textarea></div><div class="field"><label>目前的現實限制</label><textarea name="constraints" maxlength="1000" placeholder="時間、家庭、健康、資金…"></textarea></div><button class="primary-button" type="submit">設定主目標</button></form>`;
}

function guardianCompanion(state, message) {
  const guardian = state.guardianAssets?.guardian;
  const url = state.guardianAssets?.chibi_url;
  const name = escapeHtml(guardian?.character_spec?.name || "你的守護天使");
  const visual = url
    ? `<img src="${escapeHtml(url)}" alt="${name}，你的Q版守護天使">`
    : "<span>✦</span>";
  return `<div class="reading-guardian"><div class="reading-guardian-avatar">${visual}</div><div><small>${name}</small><strong>${escapeHtml(message)}</strong></div></div>`;
}

export function reading(state) {
  if (state.chat) return `${head("DAILY READING", "今天的解盤已完成", "每個曆日一次；服務失敗不扣次數。")}
    <article class="card form-card">${guardianCompanion(state, "我把這次理解整理好了。")}<p class="kicker">${escapeHtml(state.chat.category)}</p><h3>${escapeHtml(state.chat.question)}</h3><p>${escapeHtml(state.chat.answer)}</p><div class="quote">守護天使提供的是反思與行動方向，不替你做醫療、法律、財務或重大關係決定。</div></article>`;
  return `${head("DAILY READING", "問守護天使一件事", "先選情境，讓回答更具體。每天一次。")}
    <form id="reading-form" class="card form-card">${guardianCompanion(state, "告訴我你現在最想釐清的事。")}<div class="field"><label>問題類型</label><select name="category"><option>工作決定</option><option>感情互動</option><option>財務選擇</option><option>家庭問題</option><option>今日情緒</option><option>自由提問</option></select></div><div class="field"><label>你想釐清什麼？</label><textarea name="question" minlength="2" maxlength="2000" placeholder="描述現在的情況、你在意的目標，以及有哪些限制…" required></textarea></div><button class="primary-button" type="submit">使用今日解盤</button><p class="privacy-note">高風險醫療、法律、投資與安全問題會改為專業求助提醒。</p></form>`;
}

export function profile(state) {
  const guardian = state.guardianAssets?.guardian;
  const url = state.guardianAssets?.chibi_url;
  const spec = guardian?.character_spec || {};
  const traits = Array.isArray(spec.immutable_traits) ? spec.immutable_traits.slice(0, 6) : [];
  const symbols = Array.isArray(spec.symbols) ? spec.symbols.slice(0, 3) : [];
  const content = state.model?.content || {};
  const traitTags = traits.length
    ? traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")
    : "<span>會隨探索逐漸清晰</span>";
  const symbolTags = symbols.map((symbol) => `<span>${escapeHtml(symbol)}</span>`).join("");
  return `${head("MY MODEL", "你的自我模型", "固定命盤、真實回答與行為證據分開保存。")}
    <div class="grid"><article class="card half-card guardian-panel"><div class="guardian-large">${url ? `<img src="${escapeHtml(url)}" alt="你的Q版守護天使">` : "<span>✦</span>"}</div>
      <div class="guardian-identity"><small>守護天使的名字</small><h3>${escapeHtml(spec.name || "尚未成形")}</h3><p>${escapeHtml(spec.essence || "完成第一道探索後即可生成。")}</p></div>
      ${guardian ? `<div class="guardian-profile-details"><div class="guardian-detail"><small>核心特性</small><div class="guardian-traits">${traitTags}</div></div>${spec.voice ? `<div class="guardian-detail"><small>陪伴方式</small><p>${escapeHtml(spec.voice)}</p></div>` : ""}${symbolTags ? `<div class="guardian-detail"><small>守護象徵</small><div class="guardian-symbols">${symbolTags}</div></div>` : ""}</div>` : ""}
      ${!guardian && state.answers.length ? button("生成雙版本守護天使", "create-guardian") : ""}</article>
      <article class="card half-card"><p class="kicker">MODEL V${state.model?.version || 0}</p><h3>理解信心 ${Math.round((state.model?.confidence ?? .1)*100)}%</h3><div class="stat"><span>天干固定層</span><b>${escapeHtml(state.profile.day_stem || "—")}${escapeHtml(state.profile.day_element || "")}</b></div><div class="stat"><span>已回答</span><b>${state.answers.length}/30</b></div><div class="stat"><span>已確認模式</span><b>${content.confirmed_patterns?.length || 0}</b></div><div class="quote">模型只在你確認每週更新草案後升級。</div></article>
      ${state.isAdmin ? `<article class="card wide-card"><p class="kicker">ADMIN</p><h3>帳號主控後台</h3><p>查看使用狀況、AI失敗與退還次數；不預設展示私人對話。</p>${button("開啟後台", "open-admin", "secondary-button")}</article>` : ""}
      <article class="card wide-card"><p class="kicker">ACCOUNT</p><h3>${escapeHtml(state.profile.display_name || "旅人")}</h3><p>${escapeHtml(state.profile.birth_date || "")} · ${escapeHtml(state.profile.birth_city || "")} · ${escapeHtml(state.profile.timezone || "Asia/Taipei")}</p>${button("登出", "logout", "secondary-button")}</article></div>`;
}

function adminDate(value) {
  if (!value) return "尚無紀錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚無紀錄";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function adminStatus(status) {
  const labels = {
    not_started: "尚未生成",
    queued: "排隊中",
    processing: "生成中",
    ready: "已完成",
    failed: "失敗",
  };
  return labels[status] || status || "—";
}

export function admin(metrics, accounts = [], periodDays = 30) {
  const metricLabels = {
    auth_users: "登入帳號",
    onboarded_users: "完成建檔",
    active_users_7d: "近7日活躍",
    active_goals: "進行中目標",
    ai_calls_30d: `近${periodDays}日 AI 使用`,
    refunded_ai_calls_30d: "AI 退還",
  };
  const metricCards = Object.entries(metricLabels).map(([key, label]) =>
    `<article class="card admin-metric"><p class="kicker">${escapeHtml(label)}</p><h3>${Number(metrics?.[key] ?? 0)}</h3></article>`
  ).join("");
  const accountCards = accounts.map((account) => {
    const progress = Math.max(0, Math.min(30, Number(account.journey_progress || 0)));
    const confidence = account.model_confidence == null ? "—" : `${Math.round(Number(account.model_confidence) * 100)}%`;
    return `<article class="card admin-account">
      <div class="admin-account-head"><div class="admin-account-avatar">${escapeHtml((account.display_name || account.email || "?").slice(0, 1).toUpperCase())}</div><div><h3>${escapeHtml(account.display_name || "尚未命名")}</h3><p>${escapeHtml(account.email || "無 Email")}</p></div><span class="admin-state ${account.onboarded ? "ready" : ""}">${account.onboarded ? "已建檔" : "未建檔"}</span></div>
      <div class="admin-account-grid">
        <div><small>探索進度</small><strong>${progress}/30</strong></div>
        <div><small>模型版本</small><strong>${account.model_version ? `V${account.model_version}` : "—"}</strong></div>
        <div><small>模型信心</small><strong>${confidence}</strong></div>
        <div><small>守護天使</small><strong>${escapeHtml(adminStatus(account.guardian_status))}</strong></div>
        <div><small>主目標</small><strong>${account.has_active_goal ? "進行中" : "未設定"}</strong></div>
        <div><small>近${periodDays}日 AI</small><strong>${Number(account.ai_calls_30d || 0)} 次</strong></div>
      </div>
      <div class="admin-usage"><span>成功 ${Number(account.ai_succeeded_30d || 0)}</span><span class="${account.ai_refunded_30d ? "warning" : ""}">退還 ${Number(account.ai_refunded_30d || 0)}</span></div>
      <div class="admin-account-foot"><span>最近登入：${escapeHtml(adminDate(account.last_sign_in_at))}</span><span>最近活動：${escapeHtml(adminDate(account.last_activity_at))}</span></div>
    </article>`;
  }).join("");
  return `${head("ADMIN", "帳號主控後台", "只顯示使用狀況，不顯示出生資料、問題、對話或模型內文。", '<button class="secondary-button" type="button" data-route="profile">返回我的帳號</button>')}
    <div class="admin-metrics">${metricCards}</div>
    <section class="admin-section"><div class="admin-section-head"><div><p class="kicker">ACCOUNT USAGE</p><h3>所有帳號使用狀況</h3></div><span>${accounts.length} 個帳號</span></div>
      <div class="admin-account-list">${accountCards || '<div class="card empty">目前沒有帳號資料。</div>'}</div>
    </section>`;
}
