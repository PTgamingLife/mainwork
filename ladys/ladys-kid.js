// LadyS LIFF — 👶 小孩每日:待辦頁的分頁。記哥哥 / 弟弟每天完成的事(喝藥、魚油…),文字紀錄、不打勾。在 ladys.js 之前載入
const LADYS_KIDS = [["elder", "🧒 哥哥"], ["younger", "👦 弟弟"]];
const LADYS_TODO_TABS = [["todo", "☑️ 一般待辦"], ["kid", "👶 小孩每日"]];

function todoTabs() {
  const tab = ladysS.todoTab || "todo";
  return `<div class="ladys-chips ladys-chips-fit">${LADYS_TODO_TABS.map(([v, l]) =>
    `<button class="ladys-chip ${tab === v ? "on" : ""} ${v === "kid" ? "ladys-chip-kid" : ""}" data-ttab="${v}">${l}</button>`).join("")}</div>`;
}

function kidItem(x) {
  return `<div class="ladys-item ladys-kid-item" data-edit="kid" data-id="${x.id}"><i class="ladys-bar ladys-o-kid"></i>
    <div class="t"><div>${esc(x.ladys_content)}</div></div></div>`;
}

function viewKids() {
  const today = ladysS.data.today, by = {};
  for (const x of ladysS.data.kids || []) ((by[x.ladys_date] ||= { elder: [], younger: [] })[x.ladys_child] ||= []).push(x);
  const days = [...new Set([today, ...Object.keys(by)])].sort().reverse().slice(0, 14);
  const day = (d) => {
    const g = by[d] || { elder: [], younger: [] };
    const block = ([c, label]) => `<div class="ladys-kid-col"><div class="ladys-kid-head">${label}<span>${(g[c] || []).length} 項</span></div>
      ${(g[c] || []).length ? g[c].map(kidItem).join("") : `<div class="ladys-empty" style="padding:8px 0;font-size:12px">${d === today ? "還沒記" : "沒有紀錄"}</div>`}</div>`;
    return `<div class="ladys-sec">${dayLabel(d)}${d === today ? " 今天" : ""}</div><div class="ladys-card ladys-kid-card"><div class="ladys-kid-grid">${LADYS_KIDS.map(block).join("")}</div></div>`;
  };
  return `${todoTabs()}<div class="s" style="font-size:12px;color:var(--ladys-muted);margin:6px 2px">群組裡說「哥哥喝藥了」「弟弟吃魚油」,晚上整理時也會自動記到這裡</div>
    ${days.map(day).join("")}`;
}

function kidSheet(row, isNew, today) {
  return `<h3>${isNew ? "新增" : "編輯"}小孩每日紀錄</h3>
    <div class="ladys-field"><label>誰</label>${seg("child", LADYS_KIDS, row?.ladys_child || "elder")}</div>
    <div class="ladys-field"><label>日期</label><input type="date" id="fDate" value="${row?.ladys_date || today}"></div>
    <div class="ladys-field"><label>完成了什麼</label><input id="fContent" maxlength="120" value="${esc(row?.ladys_content)}" placeholder="例如:喝藥、魚油、刷牙"></div>`;
}
