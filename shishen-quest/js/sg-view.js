// 十神修行錄 — 畫面
import { SG_GOD_KEYS, sgEnergyTotals } from "./sg-bazi.js";
import { SG_GODS, SG_ENERGIES, SG_ASSESS, SG_OATH_EXAMPLES, SG_INK_WORDS } from "./sg-data.js";
import {
  sgAssessToScores, sgBlendedScores, sgRankGods, sgStreak, sgRealm, sgBondProgress,
  sgDateStr, sgAddDays, sgGodLabel,
} from "./sg-store.js";

export const sgEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function sgViewOnboard() {
  return `
  <h2 class="sg-h">入門</h2>
  <div class="sg-card">
    <p>輸入生辰,排出你的十神能量。系統會依能量分布,給你三道修行:<b>戒律</b>、<b>約束</b>與<b>誓言</b>。</p>
    <form id="sg-form-birth" novalidate>
      <label class="sg-field"><span>暱稱</span><input class="sg-input" name="sg_nickname" maxlength="12" required placeholder="例如:小墨"></label>
      <label class="sg-field"><span>出生日期(國曆)</span><input class="sg-input" type="date" name="sg_birth_date" min="1900-01-01" max="2100-12-31" required></label>
      <label class="sg-field"><span>出生時間</span><input class="sg-input" type="time" name="sg_birth_time" value="12:00"></label>
      <label class="sg-check"><input type="checkbox" name="sg_hour_unknown"> 不知道出生時辰(只排三柱)</label>
      <p class="sg-muted">以台灣時區(UTC+8)計算;23:00 後出生算隔日子時。</p>
      <details class="sg-consent"><summary>個人資料蒐集說明</summary>
        <p>1. 蒐集項目:暱稱、出生日期與時間、LINE 使用者 ID、自評與打卡紀錄。</p>
        <p>2. 用途:排盤、產生修行任務、每日 LINE 提醒與成長紀錄,不做其他用途,不提供第三方。</p>
        <p>3. 期間:至你刪除資料為止。可隨時在「命盤」頁按「重新排盤(清除資料)」刪除全部紀錄。</p>
        <p>4. 性質:命理內容為自我覺察與娛樂參考,不構成醫療、心理或財務建議。</p>
      </details>
      <label class="sg-check"><input type="checkbox" name="sg_consent" required> 我已閱讀並同意上述個人資料蒐集與使用</label>
      <button class="sg-btn" type="submit">排盤</button>
    </form>
  </div>`;
}

function sgRadarSvg(series) {
  const cx = 150, cy = 140, r = 105;
  const pt = (i, v) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v];
  };
  const rings = [0.25, 0.5, 0.75, 1].map((s) =>
    `<polygon points="${[0, 1, 2, 3, 4].map((i) => pt(i, s).join(",")).join(" ")}" fill="none" stroke="rgba(35,32,28,.15)"/>`).join("");
  const axes = [0, 1, 2, 3, 4].map((i) => {
    const [x, y] = pt(i, 1); const [lx, ly] = pt(i, 1.2);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(35,32,28,.15)"/>
      <text x="${lx}" y="${ly + 7}" text-anchor="middle" font-size="20" font-family="var(--sg-font-brush)" fill="#1B2440">${SG_ENERGIES[i].sg_name}</text>`;
  }).join("");
  const max = Math.max(40, ...series.flatMap((s) => s.values));
  const polys = series.map((s) => `<polygon points="${s.values.map((v, i) => pt(i, v / max).join(",")).join(" ")}"
      fill="${s.fill}" stroke="${s.stroke}" stroke-width="2.5" stroke-linejoin="round" filter="url(#sg-brush-soft)"/>`).join("");
  return `<svg class="sg-radar" viewBox="0 0 300 290" role="img" aria-label="五能量雷達圖">${rings}${axes}${polys}</svg>`;
}

function sgBars(scores) {
  return `<div class="sg-bars">${SG_GOD_KEYS.map((k) => {
    const g = SG_GODS[k];
    return `<div class="sg-bar"><span>${g.sg_name}<small class="sg-muted"> ${g.sg_trad}</small></span>
      <div class="sg-bar-track"><div class="sg-bar-fill ${g.sg_inner ? "" : "sg-outer"}" style="width:${Math.min(100, scores[k] * 2.5)}%"></div></div>
      <em>${scores[k].toFixed(1)}%</em></div>`;
  }).join("")}</div>
  <p class="sg-muted" style="margin-top:8px">金色 = 內(調節自己)、墨色 = 外(作用環境)</p>`;
}

export function sgViewChart(state) {
  const c = state.sg_chart;
  const p = c.sg_pillars;
  const cols = [["時", p.hour], ["日", p.day], ["月", p.month], ["年", p.year]];
  const scores = sgBlendedScores(state);
  const ranked = sgRankGods(scores);
  const hi = SG_GODS[ranked[0]], lo = SG_GODS[ranked[9]];
  const series = [{ values: sgEnergyTotals(c.sg_scores), fill: "rgba(201,162,39,.30)", stroke: "#B8901C" }];
  if (state.sg_assess) series.push({ values: sgEnergyTotals(sgAssessToScores(state.sg_assess)), fill: "rgba(27,36,64,.18)", stroke: "#1B2440" });
  return `
  <h2 class="sg-h">命盤</h2>
  <div class="sg-card">
    <div class="sg-pillars">${cols.map(([n, x], i) => `<div class="sg-pillar ${i === 1 ? "sg-me" : ""}"><small>${n}柱</small><b>${x ? `${x.text[0]}<br>${x.text[1]}` : "?<br>?"}</b></div>`).join("")}</div>
    <p class="sg-muted" style="text-align:center">日主(你)為「${p.day.text[0]}」</p>
    ${c.sg_near_jie ? `<p class="sg-muted">⚠️ 出生時間接近節氣交界(1 小時內),月柱可能有誤差。</p>` : ""}
    ${!c.sg_hour_known ? `<p class="sg-muted">未提供時辰,能量分布只依三柱計算。</p>` : ""}
  </div>
  <div class="sg-card">
    <h3>五能量</h3>
    ${sgRadarSvg(series)}
    <div class="sg-legend"><span><i style="background:#C9A227"></i>先天(命盤)</span>${state.sg_assess ? `<span><i style="background:#1B2440"></i>現況(自評)</span>` : ""}</div>
  </div>
  <div class="sg-card">
    <h3>十格能量</h3>
    ${sgBars(c.sg_scores)}
  </div>
  <div class="sg-card sg-ink-card">
    <h3>最旺:${hi.sg_name}</h3><p>${hi.sg_desc}</p><p class="sg-muted">過旺時:${hi.sg_high}</p>
    <h3 style="margin-top:12px">最弱:${lo.sg_name}</h3><p class="sg-muted">不足時:${lo.sg_low}</p>
  </div>
  ${c.sg_yima.length ? `<div class="sg-card"><h3>行旅星</h3><p>傳統說法:你的命盤帶驛馬(${c.sg_yima.join("、")}),主奔波、遷動、外出。</p><p class="sg-muted">這是依地支推算的傳統神煞,目前沒有科學驗證。</p></div>` : ""}
  <button class="sg-btn sg-ghost" data-sg-go="assess">${state.sg_assess ? "重新自評現況" : "做 10 題自評,比對現況"}</button>
  ${state.sg_vows ? "" : `<button class="sg-btn" data-sg-go="vows">立下三誓</button>`}
  <button class="sg-btn sg-ghost" data-sg-act="reset" style="margin-top:22px;font-size:14px">重新排盤(清除資料)</button>`;
}

export function sgViewAssess(state) {
  const a = state.sg_assess || {};
  return `
  <h2 class="sg-h">現況自評</h2>
  <p class="sg-muted">依最近一個月的你作答。1 = 完全不符合,5 = 非常符合。</p>
  <form id="sg-form-assess">
    ${SG_ASSESS.map(([k, q], i) => `<div class="sg-card"><p><b>${i + 1}.</b> ${q}</p>
      <div class="sg-scale" role="radiogroup" aria-label="第 ${i + 1} 題">${[1, 2, 3, 4, 5].map((v) =>
        `<label><input type="radio" name="${k}" value="${v}" ${a[k] === v ? "checked" : ""} required><span>${v}</span></label>`).join("")}</div></div>`).join("")}
    <button class="sg-btn" type="submit">完成自評</button>
  </form>`;
}

export function sgViewVowSetup(state, sug) {
  const pg = SG_GODS[sug.sg_precept.sg_god], bg = SG_GODS[sug.sg_bond.sg_god];
  return `
  <h2 class="sg-h">立下三誓</h2>
  <div class="sg-card"><span class="sg-tag">戒律・每日</span><span class="sg-tag">${pg.sg_name}${["最旺", "次旺", "第三旺"][sug.sg_rank]}</span>
    <h3>${sug.sg_precept.sg_mode === "sg_drain" ? "引流" : "節制"}「${pg.sg_name}」</h3><p>${sug.sg_precept.sg_text}</p>
    <p class="sg-muted">${pg.sg_high}</p></div>
  <div class="sg-card"><span class="sg-tag">約束・7 天</span><span class="sg-tag">${bg.sg_name}${["最弱", "次弱", "第三弱"][sug.sg_rank]}</span>
    <h3>補足「${bg.sg_name}」</h3><p>${sug.sg_bond.sg_text}</p></div>
  <button class="sg-btn sg-ghost" data-sg-act="reroll">換一組建議</button>
  <form id="sg-form-oath" class="sg-card">
    <span class="sg-tag">誓言・30 天</span>
    <label class="sg-field"><span>寫下你 30 天內要達成的一個明確目標</span>
      <textarea class="sg-input sg-textarea" name="sg_oath" rows="2" maxlength="80" required placeholder="${sgEsc(SG_OATH_EXAMPLES[0])}"></textarea></label>
    <p class="sg-muted">範例:${SG_OATH_EXAMPLES.map(sgEsc).join(" / ")}</p>
    <button class="sg-btn" type="submit">落款立誓</button>
  </form>`;
}

export function sgViewVows(state) {
  const v = state.sg_vows;
  const bp = sgBondProgress(state);
  const daysLeft = Math.max(0, Math.round((new Date(v.sg_oath.sg_end) - new Date(sgDateStr())) / 864e5));
  return `
  <h2 class="sg-h">我的三誓</h2>
  <div class="sg-card"><span class="sg-tag">戒律</span><span class="sg-tag">${sgGodLabel(v.sg_precept.sg_god)}</span><p>${sgEsc(v.sg_precept.sg_text)}</p></div>
  <div class="sg-card"><span class="sg-tag">約束</span><span class="sg-tag">${sgGodLabel(v.sg_bond.sg_god)}</span><p>${sgEsc(v.sg_bond.sg_text)}</p>
    <div class="sg-progress"><div style="width:${bp.done / 7 * 100}%"></div></div>
    <p class="sg-muted">${bp.done} / 7 天${bp.ended ? "・已結算" : `・${v.sg_bond.sg_end} 截止`}</p></div>
  <div class="sg-card sg-ink-card"><span class="sg-tag">誓言</span><p style="font-size:18px">${sgEsc(v.sg_oath.sg_text)}</p>
    <div class="sg-progress"><div style="width:${v.sg_oath.sg_pct}%"></div></div>
    <p class="sg-muted">進度 ${v.sg_oath.sg_pct}%・剩 ${daysLeft} 天</p></div>
  ${bp.ended ? `<button class="sg-btn" data-sg-act="renew">約束已結算,重立三誓</button>` : ""}
  <button class="sg-btn sg-ghost" data-sg-act="share">分享誓言給 LINE 好友見證</button>`;
}

export function sgViewToday(state) {
  const today = sgDateStr();
  const done = state.sg_checkins[today];
  const v = state.sg_vows;
  const word = SG_INK_WORDS[Number(today.replaceAll("-", "")) % SG_INK_WORDS.length];
  if (!v) return `<h2 class="sg-h">今日</h2><div class="sg-card"><p>還沒立下三誓。</p><button class="sg-btn" data-sg-go="vows">立下三誓</button></div>`;
  return `
  <h2 class="sg-h">今日修行</h2>
  <p class="sg-quote">「${word}」</p>
  <form id="sg-form-checkin">
    <div class="sg-card"><label class="sg-toggle"><span><span class="sg-tag">戒律</span>${sgEsc(v.sg_precept.sg_text)}</span>
      <input type="checkbox" name="sg_precept_ok" ${done?.sg_precept_ok ? "checked" : ""}></label></div>
    <div class="sg-card"><label class="sg-toggle"><span><span class="sg-tag">約束</span>${sgEsc(v.sg_bond.sg_text)}</span>
      <input type="checkbox" name="sg_bond_ok" ${done?.sg_bond_ok ? "checked" : ""}></label></div>
    <div class="sg-card"><span class="sg-tag">誓言</span><p>${sgEsc(v.sg_oath.sg_text)}</p>
      <label class="sg-field"><span>目前進度 <output id="sg-pct-out">${done?.sg_oath_pct ?? v.sg_oath.sg_pct}</output>%</span>
      <input class="sg-range" type="range" name="sg_oath_pct" min="0" max="100" step="5" value="${done?.sg_oath_pct ?? v.sg_oath.sg_pct}"></label></div>
    <label class="sg-field"><span>一句心得(選填)</span><input class="sg-input" name="sg_note" maxlength="60" value="${sgEsc(done?.sg_note || "")}"></label>
    <button class="sg-btn" type="submit">${done ? "更新今日打卡" : "落印打卡"}</button>
  </form>`;
}

export function sgViewGrowth(state) {
  const { cur, next, days } = sgRealm(state);
  const streak = sgStreak(state);
  const today = sgDateStr();
  const cells = Array.from({ length: 14 }, (_, i) => sgAddDays(today, i - 13)).map((d) =>
    `<i class="${state.sg_checkins[d] ? "sg-on" : state.sg_amulet_used.includes(d) ? "sg-amulet" : ""}" title="${d}"></i>`).join("");
  const logs = Object.entries(state.sg_checkins).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  return `
  <h2 class="sg-h">修行</h2>
  <div class="sg-card sg-ink-card">
    <div class="sg-stats">
      <div class="sg-stat"><b>${streak}</b><small>連續天數</small></div>
      <div class="sg-stat"><b>${cur.sg_name}</b><small>境界</small></div>
      <div class="sg-stat"><b>${state.sg_amulets}</b><small>護符</small></div>
    </div>
    <p class="sg-muted" style="text-align:center">累積 ${days} 天${next ? `・再 ${next.sg_min - days} 天晉升「${next.sg_name}」` : "・已達最高境界"}</p>
  </div>
  <div class="sg-card"><h3>近 14 天</h3><div class="sg-heat">${cells}</div>
    <p class="sg-muted">金 = 打卡、墨 = 護符補上。每連續 7 天得 1 枚護符,斷一天時自動使用。</p></div>
  <div class="sg-card"><h3>歷程</h3>${logs.length ? logs.map(([d, e]) =>
    `<p><b>${d}</b> ${e.sg_precept_ok ? "戒✓" : "戒✗"} ${e.sg_bond_ok ? "約✓" : "約✗"} 誓${e.sg_oath_pct ?? 0}%${e.sg_note ? `<br><span class="sg-muted">${sgEsc(e.sg_note)}</span>` : ""}</p>`).join("") : `<p class="sg-muted">還沒有紀錄。</p>`}</div>`;
}
