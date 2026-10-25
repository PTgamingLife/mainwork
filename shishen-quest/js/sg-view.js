// 十神修行錄 — 畫面
import { SG_GOD_KEYS, sgPercent } from "./sg-bazi.js?v=20261024a";
import { SG_GODS, SG_ENERGIES, SG_WEEKLY_QUESTIONS, SG_INK_WORDS } from "./sg-data.js?v=20261024a";
import {
  sgBaseEnergies, sgEnergies, sgInsight, sgStrongWeak, sgUp, sgTotalDelta,
  sgAngel, sgStreak, sgRealm, sgWeekProgress, sgDateStr, sgAddDays, sgWishPool, SG_WEEK_DAYS, SG_PASS_DAYS, SG_WISH_COST,
} from "./sg-store.js?v=20261024a";
import { SG_TRANSFORMS, SG_ELEMENTS, sgElemOf } from "./sg-wuxing.js?v=20261024a";

// 轉化型態標籤:「木剋土・掌握吸收」+ 行動方向
function sgTransformTag(key, withDir = false) {
  const t = SG_TRANSFORMS[key];
  if (!t) return "";
  return `<span class="sg-transform">${key}・${t.sg_name}</span>${withDir ? `<p class="sg-muted">行動方向:${t.sg_dir}</p>` : ""}`;
}

export const sgEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sgFmt = (v) => (Math.round(v * 100) / 100).toFixed(2);

export function sgViewOnboard() {
  return `
  <h2 class="sg-h">入門</h2>
  <div class="sg-card">
    <p>輸入生辰,看見你的五種能量。接著立下<b>戒律、約束、誓言</b>,由守護天使陪你修行一週。</p>
    <form id="sg-form-birth" novalidate>
      <label class="sg-field"><span>暱稱</span><input class="sg-input" name="sg_nickname" maxlength="12" required placeholder="例如:小墨"></label>
      <label class="sg-field"><span>出生日期(國曆)</span><input class="sg-input" type="date" name="sg_birth_date" min="1900-01-01" max="2100-12-31" required></label>
      <label class="sg-field"><span>出生時間</span><input class="sg-input" type="time" name="sg_birth_time" value="12:00"></label>
      <label class="sg-check"><input type="checkbox" name="sg_hour_unknown"> 不知道出生時辰</label>
      <p class="sg-muted">以台灣時區(UTC+8)計算;23:00 後出生算隔日。</p>
      <details class="sg-consent"><summary>個人資料蒐集說明</summary>
        <p>1. 蒐集項目:暱稱、出生日期與時間、LINE 使用者 ID、每日打卡與每週問卷。</p>
        <p>2. 用途:計算能量、產生修行任務、LINE 提醒與成長紀錄,不做其他用途,不提供第三方。</p>
        <p>3. 期間:至你刪除資料為止。可隨時在「命盤」頁最下方清除全部紀錄。</p>
        <p>4. 性質:內容為自我覺察與娛樂參考,不構成醫療、心理或財務建議。</p>
      </details>
      <label class="sg-check"><input type="checkbox" name="sg_consent" required> 我已閱讀並同意上述個人資料蒐集與使用</label>
      <button class="sg-btn" type="submit">排盤</button>
    </form>
  </div>`;
}

// 五角雷達:多組數列
function sgRadar(series, label = "五能量雷達圖") {
  const cx = 150, cy = 142, r = 100;
  const pt = (i, v) => { const a = (-90 + i * 72) * Math.PI / 180; return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v]; };
  const rings = [0.25, 0.5, 0.75, 1].map((k) => `<polygon points="${[0, 1, 2, 3, 4].map((i) => pt(i, k).join(",")).join(" ")}" fill="none" class="sg-ring"/>`).join("");
  const axes = [0, 1, 2, 3, 4].map((i) => {
    const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.24);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="sg-ring"/><text x="${lx}" y="${ly + 6}" text-anchor="middle" class="sg-axis">${SG_ENERGIES[i].sg_name}</text>`;
  }).join("");
  const max = Math.max(...series.flatMap((s) => s.values));
  const polys = series.map((s) => `<polygon points="${s.values.map((v, i) => pt(i, v / max).join(",")).join(" ")}" class="${s.cls}" filter="url(#sg-brush-soft)"/>`).join("");
  return `<svg class="sg-radar" viewBox="0 0 300 290" role="img" aria-label="${label}">${rings}${axes}${polys}</svg>`;
}

// 原始 vs 進化後
function sgEnergyBars(base, now) {
  const max = Math.max(...base, ...now);
  const pct = sgPercent(now);
  return `<div class="sg-bars">${now.map((v, i) => {
    const d = Math.round((v - base[i]) * 100) / 100;
    return `<div class="sg-bar"><span>${SG_ENERGIES[i].sg_name}</span>
      <div class="sg-bar-track"><div class="sg-bar-base" style="width:${base[i] / max * 100}%"></div><div class="sg-bar-fill" style="width:${v / max * 100}%"></div></div>
      <em>${sgFmt(v)}${d ? `<b class="${d > 0 ? "sg-up" : "sg-down"}">${d > 0 ? "+" : ""}${d.toFixed(1)}</b>` : ""}<small>${pct[i]}%</small></em></div>`;
  }).join("")}</div>`;
}

function sgGodBars(gods) {
  const max = Math.max(...Object.values(gods));
  return `<div class="sg-gods">${SG_GOD_KEYS.map((k) => `<div class="sg-god"><span>${SG_GODS[k].sg_name}</span>
    <div class="sg-bar-track"><div class="sg-bar-fill sg-e${SG_GODS[k].sg_energy}" style="width:${gods[k] / max * 100}%"></div></div><em>${sgFmt(gods[k])}</em></div>`).join("")}</div>`;
}

export function sgDeltaChips(delta) {
  const items = delta.map((v, i) => (v ? `<span class="sg-chip ${v > 0 ? "sg-up" : "sg-down"}">${SG_ENERGIES[i].sg_name} ${v > 0 ? "↑" : "↓"}${Math.abs(v).toFixed(1)}</span>` : "")).join("");
  return items || `<span class="sg-chip">無變化</span>`;
}

function sgResearch(e, kind) {
  const E = SG_ENERGIES[e];
  const a = kind === "high" ? [E.sg_high, E.sg_high2] : [E.sg_low, E.sg_low2];
  return a.map((r) => `<li>${r.sg_text}<cite>${r.sg_cite}</cite></li>`).join("");
}

function sgAngelCard(state, compact) {
  const a = sgAngel(state);
  return `<div class="sg-card sg-angel">
    <img class="sg-angel-img" src="${a.sg_img}" alt="守護天使${a.sg_name}" width="84" height="84" loading="lazy">
    <div><span class="sg-tag">守護天使</span><h3>${a.sg_name}</h3>
      <p class="sg-muted">${a.sg_trait}・最強的是「${SG_ENERGIES[a.sg_energy].sg_name}」</p>
      <p class="sg-say">「${a.sg_line}」</p>
      ${compact ? "" : `<button class="sg-btn sg-ghost sg-small" data-sg-go="angel">認識我的天使</button>`}</div></div>`;
}

export function sgViewChart(state, ui) {
  const c = state.sg_chart, p = c.sg_pillars;
  const cols = [["時", p.hour], ["日", p.day], ["月", p.month], ["年", p.year]];
  const base = sgBaseEnergies(state), now = sgEnergies(state);
  const ins = sgInsight(state);
  const evolved = now.some((v, i) => v !== base[i]);
  return `
  <h2 class="sg-h">命盤</h2>
  <div class="sg-card">
    <div class="sg-pillars">${cols.map(([n, x], i) => `<div class="sg-pillar ${i === 1 ? "sg-me" : ""}"><small>${n}</small><b>${x ? `${x.text[0]}<br>${x.text[1]}` : "?<br>?"}</b></div>`).join("")}</div>
    ${c.sg_near_jie ? `<p class="sg-muted">出生時間接近節氣交界(1 小時內),月份可能有誤差。</p>` : ""}
    ${!c.sg_hour_known ? `<p class="sg-muted">未提供時辰,只依年月日計算。</p>` : ""}
  </div>
  <div class="sg-card sg-insight">
    <h3>你的命盤狀態</h3>
    <div class="sg-state sg-good"><b>發揮最好時</b><p>${ins.sg_best}</p><p class="sg-muted">結果:${ins.sg_best_result}</p></div>
    <div class="sg-state sg-bad"><b>發揮最差時</b><p>${ins.sg_worst}</p><p class="sg-muted">結果:${ins.sg_worst_result}</p></div>
  </div>
  <div class="sg-card">
    <h3>五種能量</h3>
    ${sgRadar(evolved ? [{ values: base, cls: "sg-poly-base" }, { values: now, cls: "sg-poly" }] : [{ values: now, cls: "sg-poly" }])}
    ${sgEnergyBars(base, now)}
    <p class="sg-muted">每種能量基礎值 1,再加上出生時的加成。${evolved ? "淡色 = 原始能量,深色 = 修行後的能量。" : "每天完成任務,這裡就會顯示能量的進化。"}</p>
  </div>
  <div class="sg-card"><h3>十格能量</h3>${sgGodBars(c.sg_scores)}</div>
  <h2 class="sg-h">能量科學實證</h2>
  <div class="sg-card">
    <h3>過旺:${SG_ENERGIES[ins.s].sg_name}</h3><ul class="sg-research">${sgResearch(ins.s, "high")}</ul>
    <h3>過弱:${SG_ENERGIES[ins.w].sg_name}</h3><ul class="sg-research">${sgResearch(ins.w, "low")}</ul>
  </div>
  ${sgAngelCard(state, false)}
  ${state.sg_week ? sgWeekSummary(state) : sgVowSetup(state, ui)}
  <button class="sg-btn sg-ghost sg-small" data-sg-act="reset" style="margin-top:28px">清除全部資料、重新排盤</button>`;
}

// 立誓兩步驟:① 寫下想法 → AI 整理 ② 三類各選一個 → 落款
function sgVowSetup(state, ui) {
  const { s, w, w2 } = sgStrongWeak(sgEnergies(state));
  const n = (e) => SG_ENERGIES[e].sg_name;
  const head = `<h2 class="sg-h">立下戒律、約束、誓言</h2>`;
  if (!ui.options) {
    return `${head}
  <form id="sg-form-wish">
    <div class="sg-card"><p>寫下你的想法,AI 會依你的能量分布(最旺「${n(s)}」、最弱「${n(w)}」、第二弱「${n(w2)}」)整理出誓言、戒律、約束各三個選項。</p>
      <label class="sg-field"><span>我想立下的誓言</span><textarea class="sg-input" name="sg_oath_wish" rows="2" maxlength="200" required placeholder="例如:靠 AI 每天多賺 500 元">${sgEsc(ui.oathWish || "")}</textarea></label>
      <label class="sg-field"><span>我想遵守的戒律(選填)</span><input class="sg-input" name="sg_precept_wish" maxlength="200" placeholder="例如:不再衝動答應每個邀約" value="${sgEsc(ui.preceptWish || "")}"></label>
      <button class="sg-btn" type="submit" ${ui.loading ? "disabled" : ""}>${ui.loading ? "AI 整理中…" : "請 AI 整理"}</button>
      <p class="sg-muted">每天最多整理 5 次。</p></div>
  </form>`;
  }
  const o = ui.options;
  const dm = state.sg_chart.sg_day_master;
  const ne = (e) => `「${n(e)}」(${SG_ELEMENTS[sgElemOf(dm, e)]})`;
  const group = (name, tag, title, items, chips, intro = "") => `<div class="sg-card"><span class="sg-tag">${tag}</span><h3>${title}</h3>${intro}
    ${items.map((it, i) => `<label class="sg-option"><input type="radio" name="${name}" value="${i}" ${i === 0 ? "checked" : ""}><span>${sgEsc(it.text)}
      ${name === "sg_oath" ? sgTransformTag(it.transform) : ""}<span class="sg-chips">${sgDeltaChips(chips(it))}</span></span></label>`).join("")}
    <label class="sg-field"><span>選好後可再微調文字</span><textarea class="sg-input" name="${name}_text" data-sg-edit="${name}" rows="2" maxlength="80" required>${sgEsc(items[0]?.text || "")}</textarea></label></div>`;
  return `${head}
  <form id="sg-form-vow">
    ${o.fallback ? `<p class="sg-muted">AI 暫時無法使用(${sgEsc(o.fallback)}),以下為系統建議選項。</p>` : ""}
    ${group("sg_oath", "誓言・30 天", "選一個誓言", o.oaths, (it) => sgUp(it.energy))}
    ${group("sg_precept", "戒律・每日", `以${ne(o.c)}剋${ne(o.s)}`, o.precepts, () => sgUp(o.c), sgTransformTag(o.precept_key, true))}
    ${group("sg_bond", "約束・7 天", `以${ne(o.m)}生${ne(o.w2)}`, o.bonds, () => sgUp(o.w2), sgTransformTag(o.bond_key, true))}
    <p class="sg-muted">每天每完成一項任務,對應能量就 +0.1,立刻加進你的能量表。</p>
    <button class="sg-btn" type="submit">落款立誓</button>
    <button class="sg-btn sg-ghost sg-small" type="button" data-sg-act="rewish">修改想法、重新整理</button>
  </form>`;
}

function sgWeekSummary(state) {
  const wk = state.sg_week, pr = sgWeekProgress(state);
  const row = (tag, v, done) => `<div class="sg-card"><span class="sg-tag">${tag}</span>${sgTransformTag(v.sg_transform)}<p>${sgEsc(v.sg_text)}</p>
    <div class="sg-progress"><div style="width:${done / SG_WEEK_DAYS * 100}%"></div></div>
    <p class="sg-muted">${done} / ${SG_WEEK_DAYS} 天・每天完成</p><div class="sg-chips">${sgDeltaChips(v.sg_delta)}</div></div>`;
  return `
  <h2 class="sg-h">本週的戒律、約束、誓言</h2>
  <p class="sg-muted">第 ${pr.sg_day} / ${SG_WEEK_DAYS} 天(${wk.sg_start} – ${wk.sg_end})</p>
  ${row("戒律", wk.sg_precept, pr.sg_precept)}${row("約束", wk.sg_bond, pr.sg_bond)}${row("誓言", wk.sg_oath, pr.sg_oath)}
  <div class="sg-card sg-ink-card"><h3>每天全部完成可得</h3><div class="sg-chips">${sgDeltaChips(sgTotalDelta(wk))}</div></div>
  ${pr.sg_ended ? `<button class="sg-btn" data-sg-go="review">一週結束,填寫修行回顧</button>` : ""}
  <button class="sg-btn sg-ghost sg-small" data-sg-act="share">分享誓言給 LINE 好友見證</button>
  <button class="sg-btn sg-ghost sg-small" data-sg-act="revow">重新立誓</button>`;
}

export function sgViewToday(state) {
  const today = sgDateStr();
  const done = state.sg_checkins[today];
  const wk = state.sg_week;
  const word = SG_INK_WORDS[Number(today.replaceAll("-", "")) % SG_INK_WORDS.length];
  if (!wk) return `<h2 class="sg-h">今日</h2>${sgAngelCard(state, true)}<div class="sg-card"><p>還沒立下戒律、約束、誓言。</p><button class="sg-btn" data-sg-go="chart">前往命盤立誓</button></div>`;
  const pr = sgWeekProgress(state);
  if (pr.sg_ended) return `<h2 class="sg-h">今日</h2>${sgAngelCard(state, true)}<div class="sg-card"><p>這週的修行已結束,填寫回顧後就能立下新一週的誓言。</p><button class="sg-btn" data-sg-go="review">填寫修行回顧</button></div>`;
  const chk = (name, tag, text, v) => `<div class="sg-card"><label class="sg-toggle"><span><span class="sg-tag">${tag}</span>${sgEsc(text)}
    <span class="sg-chips">${sgDeltaChips(v.sg_delta.map((x) => Math.max(0, x)))}</span></span>
    <input type="checkbox" name="${name}" ${done?.[name] ? "checked" : ""}></label></div>`;
  const score = done?.sg_score ?? 7;
  return `
  <h2 class="sg-h">今日修行・第 ${pr.sg_day} 天</h2>
  <p class="sg-quote">「${word}」</p>
  ${sgAngelCard(state, true)}
  <form id="sg-form-checkin">
    ${chk("sg_precept_ok", "戒律", wk.sg_precept.sg_text, wk.sg_precept)}${chk("sg_bond_ok", "約束", wk.sg_bond.sg_text, wk.sg_bond)}${chk("sg_oath_ok", "誓言", `今天有推進:${wk.sg_oath.sg_text}`, wk.sg_oath)}
    <div class="sg-card"><label class="sg-field"><span>誓言進度 <output id="sg-pct-out">${done?.sg_oath_pct ?? wk.sg_oath.sg_pct}</output>%</span>
      <input class="sg-range" type="range" name="sg_oath_pct" min="0" max="100" step="5" value="${done?.sg_oath_pct ?? wk.sg_oath.sg_pct}"></label>
      <label class="sg-field"><span>給今天的自己打分數 <output id="sg-score-out">${score}</output> / 10</span>
      <input class="sg-range" type="range" name="sg_score" min="1" max="10" step="1" value="${score}"></label>
      <label class="sg-field"><span>一句心得(選填)</span><input class="sg-input" name="sg_note" maxlength="60" value="${sgEsc(done?.sg_note || "")}"></label></div>
    <button class="sg-btn" type="submit">${done ? "更新今日打卡" : "落印打卡"}</button>
  </form>`;
}

export function sgViewAngel(state, ui = {}) {
  const a = sgAngel(state);
  return `
  <h2 class="sg-h">守護天使</h2>
  ${sgAngelCard(state, true)}
  <div class="sg-card"><img class="sg-angel-hero" src="${a.sg_img}" alt="守護天使${a.sg_name}"></div>
  <div class="sg-card"><h3>${a.sg_name}的能量</h3>
    <p class="sg-muted">天使的能量與你完全相反:你最弱的,正是它最強的。它會用自己的強項,陪你補上你的弱項、完成誓言。</p>
    ${sgRadar([{ values: sgEnergies(state), cls: "sg-poly-base" }, { values: a.sg_values, cls: "sg-poly-angel" }], "你與天使的能量")}
    <div class="sg-legend"><span><i class="sg-k-base"></i>你</span><span><i class="sg-k-angel"></i>${a.sg_name}</span></div></div>
  ${sgWishCard(state, a, ui)}`;
}

function sgWishCard(state, a, ui) {
  const { pool, total } = sgWishPool(state);
  const ok = total >= SG_WISH_COST;
  const last = ui.wishResult;
  const list = [...(state.sg_wishes || [])].reverse().slice(0, 5);
  return `
  <h2 class="sg-h">向${a.sg_name}許願</h2>
  <div class="sg-card">
    <p>修行累積的能量:<b>${total.toFixed(1)}</b> / 每次許願消耗 ${SG_WISH_COST}</p>
    <div class="sg-progress"><div style="width:${Math.min(100, total / SG_WISH_COST * 100)}%"></div></div>
    <div class="sg-chips">${pool.some((v) => v > 0) ? pool.map((v, i) => (v > 0 ? `<span class="sg-chip">${SG_ENERGIES[i].sg_name} ${v.toFixed(1)}</span>` : "")).join("") : `<span class="sg-chip">尚未累積</span>`}</div>
    <form id="sg-form-wish-angel">
      <label class="sg-field"><span>你的願望</span><textarea class="sg-input" name="sg_wish" rows="2" maxlength="120" required ${ok ? "" : "disabled"} placeholder="${ok ? "例如:希望這個月順利接到第一個 AI 顧問案" : "每天完成任務累積能量,滿 2 就能許願"}"></textarea></label>
      <button class="sg-btn" type="submit" ${ok && !ui.wishing ? "" : "disabled"}>${ui.wishing ? `${a.sg_name}傾聽中…` : ok ? "許願" : `還差 ${(SG_WISH_COST - total).toFixed(1)} 能量`}</button>
    </form>
    <p class="sg-muted">只會消耗修行後多出來的能量;${a.sg_name}會依願望內容決定各種能量的消耗比例。</p>
  </div>
  ${last ? `<div class="sg-card sg-ink-card"><h3>${a.sg_name}的回應</h3><p>${sgEsc(last.sg_blessing)}</p>
    <p><span class="sg-tag">今天的小行動</span>${sgEsc(last.sg_action)}</p><div class="sg-chips">${sgDeltaChips(last.sg_cost.map((v) => -v))}</div></div>` : ""}
  ${list.length ? `<div class="sg-card"><h3>願望清單</h3>${list.map((w) => `<div class="sg-week"><b>${w.sg_date}</b> ${sgEsc(w.sg_text)}
    <p class="sg-muted">${sgEsc(w.sg_action)}</p></div>`).join("")}</div>` : ""}`;
}

export function sgViewReview(state) {
  const pr = sgWeekProgress(state);
  return `
  <h2 class="sg-h">一週修行回顧</h2>
  <div class="sg-card"><p>戒律 ${pr.sg_precept} 天・約束 ${pr.sg_bond} 天・誓言 ${pr.sg_oath} 天・平均自評 ${pr.sg_avg ?? "—"} 分</p>
    <p class="sg-muted">能量已在每天打卡時加上;這份回顧用來記錄你這週的狀態。</p></div>
  <form id="sg-form-review">
    ${SG_WEEKLY_QUESTIONS.map((q, i) => `<div class="sg-card"><p><b>${i + 1}.</b> ${q}</p>
      <div class="sg-scale" role="radiogroup" aria-label="第 ${i + 1} 題">${[1, 2, 3, 4, 5].map((v) =>
        `<label><input type="radio" name="q${i}" value="${v}" required><span>${v}</span></label>`).join("")}</div></div>`).join("")}
    <button class="sg-btn" type="submit">送出並結算能量</button>
  </form>`;
}

export function sgViewGrowth(state) {
  const { cur, next, days } = sgRealm(state);
  const streak = sgStreak(state);
  const today = sgDateStr();
  const cells = Array.from({ length: 14 }, (_, i) => sgAddDays(today, i - 13)).map((d) =>
    `<i class="${state.sg_checkins[d] ? "sg-on" : state.sg_amulet_used.includes(d) ? "sg-amulet" : ""}" title="${d}"></i>`).join("");
  const hist = [...state.sg_history].reverse();
  return `
  <h2 class="sg-h">修行</h2>
  <div class="sg-card sg-ink-card"><div class="sg-stats">
      <div class="sg-stat"><b>${streak}</b><small>連續天數</small></div>
      <div class="sg-stat"><b>${cur.sg_name}</b><small>境界</small></div>
      <div class="sg-stat"><b>${state.sg_amulets}</b><small>護符</small></div></div>
    <p class="sg-muted" style="text-align:center">累積 ${days} 天${next ? `・再 ${next.sg_min - days} 天晉升「${next.sg_name}」` : "・已達最高境界"}</p></div>
  <div class="sg-card"><h3>近 14 天</h3><div class="sg-heat">${cells}</div>
    <p class="sg-muted">梅黃 = 打卡、墨 = 護符補上。連續 7 天得 1 枚護符,斷一天時自動使用。</p></div>
  <div class="sg-card"><h3>每週結算</h3>${hist.length ? hist.map((h) => `<div class="sg-week">
    <b>${h.sg_start} – ${h.sg_end}</b>・平均自評 ${h.sg_avg ?? "—"}
    <p class="sg-muted">戒律${h.sg_passed.sg_precept ? "✓" : "✗"} 約束${h.sg_passed.sg_bond ? "✓" : "✗"} 誓言${h.sg_passed.sg_oath ? "✓" : "✗"}</p>
    <div class="sg-chips">${sgDeltaChips(h.sg_applied)}</div></div>`).join("") : `<p class="sg-muted">完成第一週後,這裡會記錄你的能量進化。</p>`}</div>`;
}
