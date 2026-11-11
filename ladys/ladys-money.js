// LadyS LIFF — 記帳頁:月支出 / 年支出 / 月收入 / 年收入(在 ladys.js 之前載入,只定義函式)
// 資料:ladysS.data.expenses,ladys_flow = "out"(支出,預設)/ "in"(收入)
const LADYS_INCOME_CATS = ["薪資", "獎金", "接案", "投資", "其他"];
const MONEY_TABS = [["mout", "月支出"], ["yout", "年支出"], ["min", "月收入"], ["yin", "年收入"], ["recv", "應收"]];
const flowOf = (x) => (x.ladys_flow === "in" ? "in" : "out");

function moneyRows(flow, prefix) {
  return ladysS.data.expenses.filter((x) => flowOf(x) === flow && x.ladys_date.startsWith(prefix));
}
const sumOf = (rows, f = () => true) => rows.filter(f).reduce((s, x) => s + Number(x.ladys_amount), 0);

function catBars(rows) {
  const total = sumOf(rows), cats = {};
  for (const x of rows) cats[x.ladys_category] = (cats[x.ladys_category] || 0) + Number(x.ladys_amount);
  return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => {
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `<div class="ladys-catbar"><span class="c">${esc(c)}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="n">${fmt$(n)}<small> ${pct}%</small></span></div>`;
  }).join("") || '<div class="ladys-empty">沒有資料</div>';
}

function payerStats(rows, flow) {
  const who = flow === "in" ? ["👨 老公收", "👩 老婆收", "👫 共同"] : ["👨 老公", "👩 老婆", "👫 共同"];
  return `<div class="ladys-stats">${["husband", "wife", "both"].map((p, i) => `<div><b>${fmt$(sumOf(rows, (x) => x.ladys_payer === p))}</b><span>${who[i]}</span></div>`).join("")}</div>`;
}

function moneyList(rows, flow) {
  return rows.length ? rows.map((x) => `<div class="ladys-item" data-edit="expense" data-id="${x.id}"><i class="ladys-bar ladys-o-${x.ladys_payer}"></i>
    <div class="t"><div>${esc(x.ladys_note || x.ladys_category)}</div><div class="s">${dayLabel(x.ladys_date)} · ${esc(x.ladys_category)} · ${LADYS_OWNER[x.ladys_payer]}</div></div>
    <div class="r${flow === "in" ? " ladys-in" : ""}">${flow === "in" ? "+" : ""}${fmt$(x.ladys_amount)}</div></div>`).join("")
    : `<div class="ladys-empty">這個月還沒有${flow === "in" ? "收入" : "記帳"}</div>`;
}

function viewMoneyMonth(flow) {
  const ym = ladysS.moneyMonth, rows = moneyRows(flow, ym), [y, m] = ym.split("-").map(Number);
  return `<div class="ladys-card"><div class="ladys-cal-head"><button data-mmonth="-1">‹</button><b>${y} 年 ${m} 月 · ${flow === "in" ? "收入 " : ""}${fmt$(sumOf(rows))}</b><button data-mmonth="1">›</button></div>
    ${payerStats(rows, flow)}${catBars(rows)}</div>
    <div class="ladys-card">${moneyList(rows, flow)}</div>`;
}

function viewMoneyYear(flow) {
  const y = ladysS.moneyYear, rows = moneyRows(flow, `${y}-`);
  const income = sumOf(moneyRows("in", `${y}-`)), spend = sumOf(moneyRows("out", `${y}-`)), net = income - spend;
  return `<div class="ladys-card"><div class="ladys-cal-head"><button data-myear="-1">‹</button><b>${y} 年${flow === "in" ? "收入" : "支出"} · ${fmt$(sumOf(rows))}</b><button data-myear="1">›</button></div>
    ${payerStats(rows, flow)}</div>
    <div class="ladys-sec">類別排行</div><div class="ladys-card">${catBars(rows)}</div>
    <div class="ladys-sec">${y} 年度結餘</div><div class="ladys-card"><div class="ladys-stats">
      <div><b>${fmt$(income)}</b><span>收入</span></div><div><b>${fmt$(spend)}</b><span>支出</span></div>
      <div><b class="${net >= 0 ? "ladys-in" : "ladys-neg"}">${net >= 0 ? "" : "−"}${fmt$(Math.abs(net))}</b><span>結餘</span></div></div></div>`;
}

// 應收帳款:未收的在上面(可按「已收款」→ 自動記成收入),已收的收在下面
function recvItem(x, done) {
  return `<div class="ladys-item" data-edit="receivable" data-id="${x.id}"><i class="ladys-bar ladys-o-${x.ladys_owner}"></i>
    <div class="t"><div>${esc(x.ladys_party)}</div><div class="s">${done ? "已收 " + dayLabel(ymdOf(x.ladys_received_at)) : "登記 " + dayLabel(ymdOf(x.ladys_created_at))} · ${LADYS_OWNER[x.ladys_owner]}</div></div>
    <div class="r">${fmt$(x.ladys_amount)}</div>
    ${done ? "" : `<button class="ladys-btn" style="flex:0 0 auto;padding:6px 10px;margin-left:8px" data-recv="${x.id}">已收款</button>`}</div>`;
}

function viewRecv() {
  const all = ladysS.data.receivables || [], open = all.filter((x) => x.ladys_status === "open"), done = all.filter((x) => x.ladys_status === "received").slice(0, 10);
  return `<div class="ladys-card"><div class="ladys-cal-head"><b>未收 ${fmt$(sumOf(open))} · ${open.length} 筆</b></div></div>
    <div class="ladys-card">${open.length ? open.map((x) => recvItem(x, false)).join("") : '<div class="ladys-empty">目前沒有應收帳款</div>'}</div>
    ${done.length ? `<div class="ladys-sec">最近已收款</div><div class="ladys-card">${done.map((x) => recvItem(x, true)).join("")}</div>` : ""}`;
}

function receivableSheet(row, isNew) {
  return `<h3>${isNew ? "新增" : "編輯"}應收帳款</h3>
    <div class="ladys-field"><label>對象(誰欠我們)</label><input id="fParty" maxlength="10" value="${esc(row?.ladys_party)}"></div>
    <div class="ladys-field"><label>金額</label><input type="number" inputmode="numeric" id="fAmount" value="${row?.ladys_amount ?? ""}"></div>
    <div class="ladys-field"><label>誰要收</label>${seg("owner", OWNER_OPTS, row?.ladys_owner || "both")}</div>`;
}

function viewMoney() {
  const tab = ladysS.moneyTab || "mout";
  const chips = `<div class="ladys-chips ladys-chips-fit">${MONEY_TABS.map(([v, l]) => `<button class="ladys-chip ${tab === v ? "on" : ""}" data-mtab="${v}">${l}</button>`).join("")}</div>`;
  const body = { mout: () => viewMoneyMonth("out"), yout: () => viewMoneyYear("out"), min: () => viewMoneyMonth("in"), yin: () => viewMoneyYear("in"), recv: viewRecv }[tab]();
  return chips + body;
}

const moneyFlowNow = () => ((ladysS.moneyTab || "mout").endsWith("in") ? "in" : "out");

function expenseSheet(row, isNew, today) {
  const flow = row ? flowOf(row) : moneyFlowNow(), cats = flow === "in" ? LADYS_INCOME_CATS : LADYS_CATS;
  const word = flow === "in" ? "收入" : "支出";
  return `<h3>${isNew ? "新增" : "編輯"}${word}</h3>
    <div class="ladys-row2"><div class="ladys-field"><label>金額</label><input type="number" inputmode="numeric" id="fAmount" value="${row?.ladys_amount ?? ""}"></div>
    <div class="ladys-field"><label>日期</label><input type="date" id="fDate" value="${row?.ladys_date || today}"></div></div>
    <div class="ladys-field"><label>類別</label><select id="fCat">${cats.map((c) => `<option ${c === (row?.ladys_category || "其他") ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    <div class="ladys-field"><label>說明</label><input id="fNote" maxlength="60" value="${esc(row?.ladys_note)}"></div>
    <div class="ladys-field"><label>${flow === "in" ? "誰收的" : "誰付的"}</label>${seg("owner", OWNER_OPTS, row?.ladys_payer || "both")}</div>
    <input type="hidden" id="fFlow" value="${flow}">`;
}
