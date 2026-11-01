// LadyS LIFF 前端:行事曆 / 列表 / 記帳 / 目標 / 待辦 / 設定
// 本機預覽:http://localhost:<port>/ladys/?mock=1(只在 localhost 生效,用假資料)
const LADYS_LIFF_ID = "2012319360-V7Vis4HM";
const LADYS_API_URL = "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/ladys-api";
const LADYS_MOCK = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).has("mock");
const LADYS_OWNER = { husband: "👨 老公", wife: "👩 老婆", both: "👫 一起" };
const LADYS_CATS = ["餐飲", "交通", "日用品", "居家", "育兒", "醫療", "娛樂", "服飾", "禮金", "其他"];
const LADYS_PERSONAS = { butler: "溫柔管家", secretary: "簡潔秘書", buddy: "幽默朋友", custom: "自訂" };
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

const ladysS = { data: null, view: "calendar", month: "", sel: "", filter: "all", moneyMonth: "", idToken: "" };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt$ = (n) => "$" + Number(n).toLocaleString("en-US");

// ---------- 台北時間 ----------
const ymdOf = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const hmOf = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const wdOf = (ymd) => new Date(ymd + "T12:00:00+08:00").getUTCDay();
const dayLabel = (ymd) => `${+ymd.slice(5, 7)}/${+ymd.slice(8, 10)}(${WEEK[wdOf(ymd)]})`;
function addMonths(ym, n) { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }

// ---------- API ----------
async function ladysApi(action, extra = {}) {
  if (LADYS_MOCK) return ladysMockApi(action, extra);
  const res = await fetch(LADYS_API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: ladysS.idToken, action, ...extra }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "SERVER");
  return j;
}

function toast(msg) { const t = $("ladysToast"); t.textContent = msg; t.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = "none"), 1800); }

async function reload() { ladysS.data = await ladysApi("load"); render(); }

// ---------- 啟動 ----------
function viewFromUrl() {
  const q = new URLSearchParams(location.search);
  let v = q.get("view");
  if (!v && q.get("liff.state")) v = new URLSearchParams(q.get("liff.state").replace(/^[^?]*\?/, "")).get("view");
  return v;
}

async function ladysBoot() {
  const v = viewFromUrl();
  if (v === "settings") ladysS.view = "settings";
  else if (["calendar", "list", "money", "goals", "todos"].includes(v)) ladysS.view = v;
  try {
    if (!LADYS_MOCK) {
      await new Promise((ok, ng) => { const s = document.createElement("script"); s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js"; s.onload = ok; s.onerror = ng; document.head.appendChild(s); });
      await window.liff.init({ liffId: LADYS_LIFF_ID });
      if (!window.liff.isLoggedIn()) { window.liff.login({ redirectUri: location.href }); return; }
      ladysS.idToken = window.liff.getIDToken();
    }
    await reload();
  } catch (e) {
    const m = String(e.message || e);
    $("ladysMain").innerHTML = `<div class="ladys-center">${m === "NOT_MEMBER" ? "這個頁面只開放給綁定群組的兩位成員 🙏<br>請先在 LadyS 群組說一句話完成登記。" : "載入失敗,請關閉後重新開啟。<br><small>" + esc(m) + "</small>"}</div>`;
  }
}

// ---------- 畫面 ----------
function render() {
  const d = ladysS.data; if (!d) return;
  if (!ladysS.month) { ladysS.month = d.today.slice(0, 7); ladysS.sel = d.today; ladysS.moneyMonth = d.today.slice(0, 7); }
  document.querySelectorAll("#ladysNav button").forEach((b) => b.classList.toggle("on", b.dataset.view === ladysS.view));
  $("ladysFab").style.display = ladysS.view === "settings" ? "none" : "block";
  const titles = { calendar: "行事曆", list: "行程列表", money: "記帳", goals: "目標", todos: "待辦", settings: "設定" };
  $("ladysTitle").innerHTML = `${titles[ladysS.view]}<small>LadyS 生活秘書</small>`;
  const fn = { calendar: viewCalendar, list: viewList, money: viewMoney, goals: () => viewNotes("goal"), todos: () => viewNotes("todo"), settings: viewSettings }[ladysS.view];
  $("ladysMain").innerHTML = fn();
}

const filtered = () => ladysS.data.events.filter((e) => ladysS.filter === "all" || e.ladys_owner === ladysS.filter || (ladysS.filter !== "both" && e.ladys_owner === "both"));

function filterChips() {
  const opts = [["all", "全部"], ["husband", "👨 老公"], ["wife", "👩 老婆"], ["both", "👫 共同"]];
  return `<div class="ladys-chips">${opts.map(([v, l]) => `<button class="ladys-chip ${ladysS.filter === v ? "on" : ""}" data-filter="${v}">${l}</button>`).join("")}</div>`;
}

function eventItem(e, showDate) {
  const t = e.ladys_all_day ? "全天" : hmOf(e.ladys_start_at) + (e.ladys_end_at ? "–" + hmOf(e.ladys_end_at) : "");
  return `<div class="ladys-item" data-edit="event" data-id="${e.id}"><i class="ladys-bar ladys-o-${e.ladys_owner}"></i>
    <div class="t"><div>${esc(e.ladys_title)}</div><div class="s">${showDate ? dayLabel(ymdOf(e.ladys_start_at)) + " · " : ""}${t}${e.ladys_location ? " · 📍" + esc(e.ladys_location) : ""}</div></div>
    <div class="s">${LADYS_OWNER[e.ladys_owner].slice(0, 2)}</div></div>`;
}

function viewCalendar() {
  const ym = ladysS.month, [y, m] = ym.split("-").map(Number);
  const first = wdOf(`${ym}-01`), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay = {};
  for (const e of filtered()) (byDay[ymdOf(e.ladys_start_at)] ||= []).push(e);
  let cells = WEEK.map((w) => `<div class="wd">${w}</div>`).join("");
  for (let i = 0; i < first; i++) cells += "<div></div>";
  for (let dd = 1; dd <= days; dd++) {
    const k = `${ym}-${String(dd).padStart(2, "0")}`, list = byDay[k] || [];
    const owners = [...new Set(list.map((e) => e.ladys_owner))];
    cells += `<button class="ladys-day ${k === ladysS.data.today ? "today" : ""} ${k === ladysS.sel ? "sel" : ""}" data-day="${k}"><b>${dd}</b>
      <div class="ladys-dots">${owners.map((o) => `<i class="ladys-o-${o}"></i>`).join("")}</div></button>`;
  }
  const sel = byDay[ladysS.sel] || [];
  return `${filterChips()}<div class="ladys-card"><div class="ladys-cal-head"><button data-month="-1">‹</button><b>${y} 年 ${m} 月</b><button data-month="1">›</button></div>
    <div class="ladys-grid">${cells}</div></div>
    <div class="ladys-sec">${dayLabel(ladysS.sel)}${ladysS.sel === ladysS.data.today ? " 今天" : ""}</div>
    <div class="ladys-card">${sel.length ? sel.map((e) => eventItem(e, false)).join("") : '<div class="ladys-empty">這天沒有安排 🌿</div>'}</div>`;
}

function viewList() {
  const today = ladysS.data.today, groups = {};
  for (const e of filtered()) { const k = ymdOf(e.ladys_start_at); if (k >= today) (groups[k] ||= []).push(e); }
  const keys = Object.keys(groups).sort();
  return filterChips() + (keys.length ? keys.map((k) => `<div class="ladys-sec">${dayLabel(k)}${k === today ? " 今天" : ""}</div><div class="ladys-card">${groups[k].map((e) => eventItem(e, false)).join("")}</div>`).join("")
    : '<div class="ladys-card"><div class="ladys-empty">接下來沒有安排 🌿</div></div>');
}

function viewMoney() {
  const ym = ladysS.moneyMonth, rows = ladysS.data.expenses.filter((x) => x.ladys_date.startsWith(ym));
  const sum = (f) => rows.filter(f).reduce((s, x) => s + Number(x.ladys_amount), 0);
  const total = sum(() => true), cats = {};
  for (const x of rows) cats[x.ladys_category] = (cats[x.ladys_category] || 0) + Number(x.ladys_amount);
  const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const [y, m] = ym.split("-").map(Number);
  return `<div class="ladys-card"><div class="ladys-cal-head"><button data-mmonth="-1">‹</button><b>${y} 年 ${m} 月 · ${fmt$(total)}</b><button data-mmonth="1">›</button></div>
    <div class="ladys-stats"><div><b>${fmt$(sum((x) => x.ladys_payer === "husband"))}</b><span>👨 老公</span></div><div><b>${fmt$(sum((x) => x.ladys_payer === "wife"))}</b><span>👩 老婆</span></div><div><b>${fmt$(sum((x) => x.ladys_payer === "both"))}</b><span>👫 共同</span></div></div>
    ${catRows.map(([c, n]) => `<div class="ladys-catbar"><span class="c">${esc(c)}</span><span class="bar"><i style="width:${total ? Math.round((n / total) * 100) : 0}%"></i></span><span class="n">${fmt$(n)}</span></div>`).join("")}</div>
    <div class="ladys-card">${rows.length ? rows.map((x) => `<div class="ladys-item" data-edit="expense" data-id="${x.id}"><i class="ladys-bar ladys-o-${x.ladys_payer}"></i>
      <div class="t"><div>${esc(x.ladys_note || x.ladys_category)}</div><div class="s">${dayLabel(x.ladys_date)} · ${esc(x.ladys_category)} · ${LADYS_OWNER[x.ladys_payer]}</div></div><div class="r">${fmt$(x.ladys_amount)}</div></div>`).join("")
      : '<div class="ladys-empty">這個月還沒有記帳</div>'}</div>`;
}

function viewNotes(kind) {
  const rows = ladysS.data.notes.filter((n) => (kind === "goal" ? n.ladys_kind === "goal" : n.ladys_kind !== "goal"));
  const open = rows.filter((n) => !n.ladys_done), done = rows.filter((n) => n.ladys_done);
  const item = (n) => `<div class="ladys-item ${n.ladys_done ? "ladys-done" : ""}" data-edit="note" data-id="${n.id}">
    <button class="ladys-check ${n.ladys_done ? "on" : ""}" data-toggle="${n.id}" aria-label="完成">${n.ladys_done ? "✓" : ""}</button>
    <div class="t"><div>${kind === "goal" ? "🎯 " : ""}${esc(n.ladys_content)}</div><div class="s">${LADYS_OWNER[n.ladys_owner] || ""}</div></div></div>`;
  return `<div class="ladys-card">${open.length ? open.map(item).join("") : `<div class="ladys-empty">${kind === "goal" ? "還沒有目標 🌱" : "全部完成了 ✨"}</div>`}</div>
    ${done.length ? `<div class="ladys-sec">已完成 ${done.length}</div><div class="ladys-card">${done.map(item).join("")}</div>` : ""}`;
}

function viewSettings() {
  const s = ladysS.data.settings;
  const sw = (k, label) => `<label class="ladys-switch"><span>${label}</span><input type="checkbox" data-set="${k}" ${s["ladys_" + k] ? "checked" : ""}></label>`;
  return `<div class="ladys-sec">說話方式</div><div class="ladys-card">
    <div class="ladys-seg" id="ladysPersona">${Object.entries(LADYS_PERSONAS).map(([v, l]) => `<button data-persona="${v}" class="${s.ladys_persona === v ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="ladys-field" style="margin-top:10px;${s.ladys_persona === "custom" ? "" : "display:none"}" id="ladysCustomBox"><label>自訂角色描述</label>
    <textarea id="ladysCustom" rows="3" maxlength="200" placeholder="例如:像貼心的姊姊,講話溫柔但會提醒我們存錢">${esc(s.ladys_persona_custom)}</textarea></div></div>
    <div class="ladys-sec">推播時間</div><div class="ladys-card"><div class="ladys-row2">
    <div class="ladys-field"><label>早上推播行程</label><input type="time" id="ladysMorning" value="${s.ladys_morning_time}"></div>
    <div class="ladys-field"><label>晚上整理對話</label><input type="time" id="ladysNightly" value="${s.ladys_nightly_time}"></div></div>
    ${sw("push_empty", "今天沒行程也推「今天沒有安排」")}</div>
    <div class="ladys-sec">晚上要整理哪些</div><div class="ladys-card">${sw("extract_events", "📅 行事曆")}${sw("extract_expenses", "💰 支出")}${sw("extract_notes", "🎯 目標與 ☑️ 待辦")}</div>
    <div class="ladys-sec">成員</div><div class="ladys-card">${ladysS.data.members.map((m) => `<div class="ladys-row2 ladys-mrow">
      <input data-mname="${m.ladys_line_uid}" value="${esc(m.ladys_name)}" maxlength="20">
      <select data-mrole="${m.ladys_line_uid}"><option value="husband" ${m.ladys_role === "husband" ? "selected" : ""}>👨 老公</option><option value="wife" ${m.ladys_role === "wife" ? "selected" : ""}>👩 老婆</option></select></div>`).join("")}
      ${ladysS.data.members.length < 2 ? '<div class="s" style="color:var(--ladys-muted);font-size:12px">另一位在群組說一句話後會自動加入</div>' : ""}</div>
    <div class="ladys-actions"><button class="ladys-btn" id="ladysSaveSettings">儲存設定</button></div>`;
}

// ---------- 編輯面板 ----------
function seg(name, opts, val) {
  return `<div class="ladys-seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === val ? "on" : ""}">${l}</button>`).join("")}</div>`;
}
const OWNER_OPTS = [["husband", "👨 老公"], ["wife", "👩 老婆"], ["both", "👫 一起"]];

function openSheet(kind, row) {
  const d = ladysS.data, isNew = !row;
  let html = "";
  if (kind === "event") {
    const date = row ? ymdOf(row.ladys_start_at) : (ladysS.view === "calendar" ? ladysS.sel : d.today);
    html = `<h3>${isNew ? "新增行程" : "編輯行程"}</h3>
      <div class="ladys-field"><label>內容</label><input id="fTitle" maxlength="80" value="${esc(row?.ladys_title)}"></div>
      <div class="ladys-field"><label>日期</label><input type="date" id="fDate" value="${date}"></div>
      <div class="ladys-row2"><div class="ladys-field"><label>開始(空白=全天)</label><input type="time" id="fTime" value="${row && !row.ladys_all_day ? hmOf(row.ladys_start_at) : ""}"></div>
      <div class="ladys-field"><label>結束</label><input type="time" id="fEnd" value="${row?.ladys_end_at ? hmOf(row.ladys_end_at) : ""}"></div></div>
      <div class="ladys-field"><label>地點</label><input id="fLoc" maxlength="60" value="${esc(row?.ladys_location)}"></div>
      <div class="ladys-field"><label>是誰的</label>${seg("owner", OWNER_OPTS, row?.ladys_owner || "both")}</div>`;
  } else if (kind === "expense") {
    html = `<h3>${isNew ? "新增支出" : "編輯支出"}</h3>
      <div class="ladys-row2"><div class="ladys-field"><label>金額</label><input type="number" inputmode="numeric" id="fAmount" value="${row?.ladys_amount ?? ""}"></div>
      <div class="ladys-field"><label>日期</label><input type="date" id="fDate" value="${row?.ladys_date || d.today}"></div></div>
      <div class="ladys-field"><label>類別</label><select id="fCat">${LADYS_CATS.map((c) => `<option ${c === (row?.ladys_category || "其他") ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="ladys-field"><label>說明</label><input id="fNote" maxlength="60" value="${esc(row?.ladys_note)}"></div>
      <div class="ladys-field"><label>誰付的</label>${seg("owner", OWNER_OPTS, row?.ladys_payer || "both")}</div>`;
  } else {
    const k = row?.ladys_kind === "goal" || (!row && ladysS.view === "goals") ? "goal" : "todo";
    html = `<h3>${isNew ? "新增" : "編輯"}</h3>
      <div class="ladys-field"><label>類型</label>${seg("kind", [["goal", "🎯 目標"], ["todo", "☑️ 待辦"]], k)}</div>
      <div class="ladys-field"><label>內容</label><textarea id="fContent" rows="3" maxlength="120">${esc(row?.ladys_content)}</textarea></div>
      <div class="ladys-field"><label>是誰的</label>${seg("owner", OWNER_OPTS, row?.ladys_owner || "both")}</div>`;
  }
  html += `<div class="ladys-actions">${isNew ? "" : '<button class="ladys-btn danger" id="fDel">刪除</button>'}<button class="ladys-btn ghost" id="fCancel">取消</button><button class="ladys-btn" id="fSave">儲存</button></div>`;
  const sh = $("ladysSheet"); sh.innerHTML = html; sh.dataset.kind = kind; sh.dataset.id = row?.id || "";
  $("ladysSheetBg").style.display = "block"; requestAnimationFrame(() => sh.classList.add("open"));
}
function closeSheet() { $("ladysSheet").classList.remove("open"); $("ladysSheetBg").style.display = "none"; }
const segVal = (name) => $("ladysSheet").querySelector(`[data-seg="${name}"] .on`)?.dataset.v;

async function saveSheet() {
  const sh = $("ladysSheet"), kind = sh.dataset.kind, id = sh.dataset.id || undefined, v = (x) => $(x)?.value ?? "";
  let data;
  if (kind === "event") data = { id, title: v("fTitle"), date: v("fDate"), time: v("fTime"), end_time: v("fEnd"), location: v("fLoc"), owner: segVal("owner") };
  else if (kind === "expense") data = { id, amount: v("fAmount"), date: v("fDate"), category: v("fCat"), note: v("fNote"), payer: segVal("owner") };
  else { const old = ladysS.data.notes.find((n) => n.id === id); data = { id, content: v("fContent"), kind: segVal("kind"), owner: segVal("owner"), done: old?.ladys_done === true }; }
  if (kind === "event" && !data.title.trim()) return toast("請填內容");
  if (kind === "expense" && !(Number(data.amount) > 0)) return toast("請填金額");
  if (kind === "note" && !data.content.trim()) return toast("請填內容");
  try { await ladysApi("save", { kind, data }); closeSheet(); await reload(); toast("已儲存"); } catch (e) { toast("儲存失敗:" + e.message); }
}

// ---------- 事件 ----------
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button, [data-edit]"); if (!t) return;
  const d = ladysS.data;
  if (t.closest("#ladysNav")) { ladysS.view = t.dataset.view; render(); window.scrollTo(0, 0); return; }
  if (t.id === "ladysGear") { ladysS.view = "settings"; render(); return; }
  if (t.id === "ladysFab") return openSheet({ calendar: "event", list: "event", money: "expense" }[ladysS.view] || "note");
  if (t.dataset.filter) { ladysS.filter = t.dataset.filter; render(); return; }
  if (t.dataset.month) { ladysS.month = addMonths(ladysS.month, +t.dataset.month); render(); return; }
  if (t.dataset.mmonth) { ladysS.moneyMonth = addMonths(ladysS.moneyMonth, +t.dataset.mmonth); render(); return; }
  if (t.dataset.day) { ladysS.sel = t.dataset.day; render(); return; }
  if (t.dataset.toggle) {
    ev.stopPropagation();
    const n = d.notes.find((x) => x.id === t.dataset.toggle);
    try { await ladysApi("save", { kind: "note", data: { id: n.id, content: n.ladys_content, kind: n.ladys_kind, owner: n.ladys_owner, done: !n.ladys_done } }); await reload(); } catch (e) { toast("更新失敗"); }
    return;
  }
  if (t.dataset.edit) {
    const list = { event: d.events, expense: d.expenses, note: d.notes }[t.dataset.edit];
    return openSheet(t.dataset.edit, list.find((x) => x.id === t.dataset.id));
  }
  if (t.closest("[data-seg]")) { t.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === t)); return; }
  if (t.id === "fCancel") return closeSheet();
  if (t.id === "fSave") return saveSheet();
  if (t.id === "fDel") {
    if (!confirm("確定刪除?")) return;
    try { await ladysApi("delete", { kind: $("ladysSheet").dataset.kind, id: $("ladysSheet").dataset.id }); closeSheet(); await reload(); toast("已刪除"); } catch (e) { toast("刪除失敗"); }
    return;
  }
  if (t.dataset.persona) {
    document.querySelectorAll("[data-persona]").forEach((b) => b.classList.toggle("on", b === t));
    $("ladysCustomBox").style.display = t.dataset.persona === "custom" ? "" : "none"; return;
  }
  if (t.id === "ladysSaveSettings") {
    const data = { persona: document.querySelector("[data-persona].on")?.dataset.persona, persona_custom: $("ladysCustom").value, morning_time: $("ladysMorning").value, nightly_time: $("ladysNightly").value };
    document.querySelectorAll("[data-set]").forEach((c) => (data[c.dataset.set] = c.checked));
    try {
      await ladysApi("settings", { data });
      for (const m of d.members) {
        const name = document.querySelector(`[data-mname="${m.ladys_line_uid}"]`).value, role = document.querySelector(`[data-mrole="${m.ladys_line_uid}"]`).value;
        if (name !== m.ladys_name || role !== m.ladys_role) await ladysApi("member", { data: { uid: m.ladys_line_uid, name, role } });
      }
      await reload(); toast("設定已儲存");
    } catch (e) { toast("儲存失敗:" + e.message); }
  }
});
$("ladysSheetBg").addEventListener("click", closeSheet);

// ---------- 本機假資料(只在 localhost?mock=1)----------
function ladysMockApi(action, extra) {
  const db = (ladysMockApi.db ||= (() => {
    const today = ymdOf(new Date().toISOString()), at = (n, hm) => new Date(new Date(today + "T" + (hm || "00:00") + ":00+08:00").getTime() + n * 864e5).toISOString();
    const id = () => crypto.randomUUID();
    return { me: "Umock", today, settings: { ladys_persona: "butler", ladys_persona_custom: "", ladys_morning_time: "07:30", ladys_nightly_time: "23:00", ladys_push_empty: true, ladys_extract_events: true, ladys_extract_expenses: true, ladys_extract_notes: true },
      members: [{ ladys_line_uid: "U" + "a".repeat(32), ladys_name: "柏廷", ladys_role: "husband" }, { ladys_line_uid: "U" + "b".repeat(32), ladys_name: "老婆", ladys_role: "wife" }],
      events: [{ id: id(), ladys_title: "跟媽媽分享:請款30、誰先找到工作誰上班", ladys_start_at: at(0), ladys_all_day: true, ladys_owner: "both", ladys_location: "" },
        { id: id(), ladys_title: "牙醫回診", ladys_start_at: at(1, "10:30"), ladys_end_at: at(1, "11:30"), ladys_all_day: false, ladys_owner: "wife", ladys_location: "仁愛診所" },
        { id: id(), ladys_title: "跟客戶開會", ladys_start_at: at(3, "14:00"), ladys_all_day: false, ladys_owner: "husband", ladys_location: "" }],
      expenses: [{ id: id(), ladys_date: today, ladys_amount: 850, ladys_category: "日用品", ladys_payer: "wife", ladys_note: "全聯" }, { id: id(), ladys_date: today, ladys_amount: 320, ladys_category: "餐飲", ladys_payer: "husband", ladys_note: "午餐" }],
      notes: [{ id: id(), ladys_content: "利用半年把債務還清", ladys_kind: "goal", ladys_owner: "both", ladys_done: false },
        { id: id(), ladys_content: "準備戶口名簿、401 報表、國泰存摺", ladys_kind: "todo", ladys_owner: "both", ladys_done: false }] };
  })());
  const key = { event: "events", expense: "expenses", note: "notes" };
  if (action === "load") return Promise.resolve(JSON.parse(JSON.stringify(db)));
  if (action === "delete") { db[key[extra.kind]] = db[key[extra.kind]].filter((x) => x.id !== extra.id); return Promise.resolve({ ok: true }); }
  if (action === "save") {
    const b = extra.data; let row;
    if (extra.kind === "event") { const all = !b.time; row = { ladys_title: b.title, ladys_start_at: new Date(`${b.date}T${all ? "00:00" : b.time}:00+08:00`).toISOString(), ladys_end_at: !all && b.end_time ? new Date(`${b.date}T${b.end_time}:00+08:00`).toISOString() : null, ladys_all_day: all, ladys_location: b.location, ladys_owner: b.owner }; }
    else if (extra.kind === "expense") row = { ladys_date: b.date, ladys_amount: Math.round(+b.amount), ladys_category: b.category, ladys_payer: b.payer, ladys_note: b.note };
    else row = { ladys_content: b.content, ladys_kind: b.kind, ladys_owner: b.owner, ladys_done: b.done };
    const list = db[key[extra.kind]], i = list.findIndex((x) => x.id === b.id);
    if (i >= 0) Object.assign(list[i], row); else list.push({ id: crypto.randomUUID(), ...row });
    if (extra.kind === "event") list.sort((a, c) => a.ladys_start_at.localeCompare(c.ladys_start_at));
    return Promise.resolve({ ok: true });
  }
  if (action === "settings") { for (const [k, v] of Object.entries(extra.data)) if (v !== undefined) db.settings["ladys_" + k] = v; return Promise.resolve({ ok: true }); }
  if (action === "member") { const m = db.members.find((x) => x.ladys_line_uid === extra.data.uid); m.ladys_name = extra.data.name; m.ladys_role = extra.data.role; return Promise.resolve({ ok: true }); }
  return Promise.reject(new Error("BAD_ACTION"));
}

ladysBoot();
