// LadyS LIFF — 生活紀錄、經期統計、每年重複紀念日(在 ladys.js 之前載入,只定義函式)
const LADYS_LIFE_KINDS = { period_start: "🩸 經期開始", period_end: "🩸 經期結束", health: "🩺 身體", other: "🌸 生活" };

const ymdUtc = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const daysBetween = (a, b) => Math.round((ymdUtc(b) - ymdUtc(a)) / 864e5);
function addDaysYmd(ymd, n) { return new Date(ymdUtc(ymd) + n * 864e5).toISOString().slice(0, 10); }

function nextYearly(originYmd, fromYmd) {
  const md = originYmd.slice(5);
  for (let y = +fromYmd.slice(0, 4); ; y++) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const d = `${y}-${md === "02-29" && !leap ? "02-28" : md}`;
    if (d >= fromYmd) return d;
  }
}

// 每年重複的行程展開成 [from, toExcl) 之間的實際日期;保留原始 id 方便編輯
function expandYearly(rows, from, toExcl) {
  const out = [];
  for (const e of rows || []) {
    const origin = ymdOf(e.ladys_start_at);
    for (let d = nextYearly(origin, from); d < toExcl; d = nextYearly(origin, addDaysYmd(d, 1))) {
      const shift = ymdUtc(d) - ymdUtc(origin);
      out.push({ ...e, ladys_start_at: new Date(new Date(e.ladys_start_at).getTime() + shift).toISOString(),
        ladys_end_at: e.ladys_end_at ? new Date(new Date(e.ladys_end_at).getTime() + shift).toISOString() : null,
        _years: +d.slice(0, 4) - +origin.slice(0, 4) });
    }
  }
  return out;
}

const eventsIn = (from, toExcl) => [...ladysS.data.events, ...expandYearly(ladysS.data.yearly, from, toExcl)]
  .sort((a, b) => a.ladys_start_at.localeCompare(b.ladys_start_at));

function yearlyBadge(e) {
  if (e.ladys_recur !== "yearly") return "";
  return e._years > 0 ? ` 💝${e._years} 週年` : " 💝每年";
}

// 經期:開始日 ~ 結束日(沒有結束日就標 5 天)→ 行事曆粉點
function periodDaySet() {
  const life = ladysS.data.life || [], set = new Set();
  const starts = life.filter((r) => r.ladys_kind === "period_start").map((r) => r.ladys_date).sort();
  const ends = life.filter((r) => r.ladys_kind === "period_end").map((r) => r.ladys_date).sort();
  for (const s of starts) {
    const end = ends.find((e) => e >= s && daysBetween(s, e) <= 10) || addDaysYmd(s, 4);
    for (let d = s; d <= end; d = addDaysYmd(d, 1)) set.add(d);
  }
  return set;
}

function lifeItem(r) {
  return `<div class="ladys-item" data-edit="life" data-id="${r.id}"><i class="ladys-bar ladys-o-${r.ladys_kind.startsWith("period") ? "wife" : r.ladys_owner}"></i>
    <div class="t"><div>${LADYS_LIFE_KINDS[r.ladys_kind]}${LADYS_LIFE_KINDS[r.ladys_kind].endsWith(r.ladys_content) ? "" : " " + esc(r.ladys_content)}</div><div class="s">${dayLabel(r.ladys_date)} · ${LADYS_OWNER[r.ladys_owner] || ""}</div></div></div>`;
}

function viewLife() {
  const d = ladysS.data, p = d.period || {}, today = d.today;
  const left = p.next ? daysBetween(today, p.next) : null;
  const upcoming = expandYearly(d.yearly, today, addDaysYmd(today, 366));
  const groups = {};
  for (const r of d.life || []) (groups[r.ladys_date.slice(0, 7)] ||= []).push(r);
  return `<div class="ladys-sec">🩸 經期</div><div class="ladys-card"><div class="ladys-stats">
      <div><b>${p.last ? dayLabel(p.last) : "—"}</b><span>上次開始</span></div>
      <div><b>${p.avg ? p.avg + " 天" : "—"}</b><span>平均週期</span></div>
      <div><b>${p.next ? dayLabel(p.next) : "—"}</b><span>${left !== null ? (left >= 0 ? `預測(${left} 天後)` : "預測(已過)") : "預測下次"}</span></div></div>
      ${p.count < 2 ? '<div class="s" style="color:var(--ladys-muted);font-size:12px;margin-top:8px">記錄滿 2 次開始日後會自動預測</div>' : ""}</div>
    <div class="ladys-sec">💝 紀念日(一年內)</div><div class="ladys-card">${upcoming.length ? upcoming.map((e) => eventItem(e, true)).join("") : '<div class="ladys-empty">還沒有紀念日,行程勾「每年重複」就會出現在這裡</div>'}</div>
    ${Object.keys(groups).length ? Object.keys(groups).sort().reverse().map((ym) => `<div class="ladys-sec">${+ym.slice(0, 4)} 年 ${+ym.slice(5)} 月</div><div class="ladys-card">${groups[ym].map(lifeItem).join("")}</div>`).join("")
      : '<div class="ladys-card"><div class="ladys-empty">還沒有生活紀錄 🌸</div></div>'}`;
}

function lifeSheet(row, isNew, today) {
  return `<h3>${isNew ? "新增生活紀錄" : "編輯生活紀錄"}</h3>
    <div class="ladys-field"><label>類型</label>${seg("lkind", Object.entries(LADYS_LIFE_KINDS).map(([v, l]) => [v, l.split(" ")[0] + " " + l.split(" ")[1].replace("經期", "")]), row?.ladys_kind || "other")}</div>
    <div class="ladys-field"><label>日期</label><input type="date" id="fDate" value="${row?.ladys_date || today}"></div>
    <div class="ladys-field"><label>內容</label><textarea id="fContent" rows="2" maxlength="120" placeholder="例如:感冒去看醫生、體重 68kg">${esc(row?.ladys_content)}</textarea></div>
    <div class="ladys-field"><label>是誰的</label>${seg("owner", OWNER_OPTS, row?.ladys_owner || "both")}</div>`;
}

function lifeSettingsHtml(s) {
  const to = s.ladys_period_remind_to || "both";
  return `<div class="ladys-sec">💝 紀念日 & 🩸 經期提醒</div><div class="ladys-card">
    <div class="ladys-field"><label>紀念日提前幾天提醒(逗號分隔,0 = 當天)</label><input id="ladysAnnivDays" inputmode="numeric" value="${(s.ladys_anniv_remind_days || [7, 0]).join(",")}"></div>
    <div class="ladys-field"><label>經期預測提醒(一對一私訊,不發在群組)</label>${seg("premto", [["wife", "👩 只給老婆"], ["both", "👫 兩人"], ["off", "關閉"]], to)}</div>
    <div class="ladys-field"><label>預測日前幾天提醒</label><input id="ladysPeriodDays" type="number" min="0" max="14" value="${s.ladys_period_remind_days ?? 2}"></div></div>`;
}
