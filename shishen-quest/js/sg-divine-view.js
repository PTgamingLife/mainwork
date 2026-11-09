// 十神修行錄 — 今日卜卦畫面
import { sgTodayDivine, sgYaoLabel, sgHexName, SG_YAO_NAMES } from "./sg-divine.js?v=20261031a";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 爻由上往下畫(上爻在最上面);陽爻一整條、陰爻中間斷開;變爻加標記
function sgYaoStack(lines) {
  const rows = lines.map((v, i) => `<div class="sg-yao ${v === 7 || v === 9 ? "sg-yang" : "sg-yin"} ${v === 6 || v === 9 ? "sg-moving" : ""}">
      <small>${sgYaoLabel(i, v)}</small><i></i><i></i><em>${SG_YAO_NAMES[v]}${v === 6 || v === 9 ? "・變" : ""}</em></div>`);
  return `<div class="sg-yaos">${rows.reverse().join("")}</div>`;
}

function sgHexBlock(h, title) {
  return `<div class="sg-hex"><span class="sg-tag">${title}</span><h3>第 ${h.sg_no} 卦・${esc(h.sg_full_name)}</h3>
    <p class="sg-hex-judg">${esc(h.sg_name)}:${esc(h.sg_judgment)}</p>
    <p>${esc(h.sg_plain)}</p></div>`;
}

export function sgDivineCard(state, ui = {}) {
  const d = sgTodayDivine(state);
  const lines = d?.sg_lines || [];
  const head = `<h2 class="sg-h">今日一卦</h2>`;
  if (lines.length < 6) {
    return `${head}<div class="sg-card sg-divine">
      <p class="sg-muted">心裡默想今天最在意的一件事,按住龜殼搖一搖(約 1 秒)得一爻;搖滿 6 次成卦。一天只占一卦。</p>
      <button type="button" id="sg-turtle" class="sg-turtle ${ui.shaking ? "sg-shaking" : ""}" aria-label="按住搖龜殼">
        <img src="img/sg-turtle.webp" alt="龜殼與三枚古錢" draggable="false"></button>
      <p class="sg-divine-step">${lines.length ? `已得 ${lines.length} 爻,再搖 ${6 - lines.length} 次` : "按住龜殼,開始第一爻"}</p>
      ${lines.length ? sgYaoStack(lines) : ""}</div>`;
  }
  const t = d.sg_text;
  const moving = lines.map((v, i) => (v === 6 || v === 9 ? i : -1)).filter((i) => i >= 0);
  let body;
  if (!t) {
    body = `<h3>${esc(sgHexName(d.sg_bits))}</h3>
      <p class="sg-muted">${ui.divineError ? `卦辭暫時無法取得(${esc(ui.divineError)})。` : "卦辭載入中…"}</p>
      ${ui.divineError ? `<button type="button" class="sg-btn sg-ghost sg-small" data-sg-act="divine-text">重新取得卦辭</button>` : ""}`;
  } else {
    const allMove = moving.length === 6 && t.main.sg_extra;
    body = `${sgHexBlock(t.main, "本卦")}
      ${moving.length ? `<div class="sg-hex"><span class="sg-tag">變爻</span>
        ${allMove ? `<p>${esc(t.main.sg_extra)}</p>` : moving.map((i) => `<p>${esc(t.main.sg_lines[i])}</p>`).join("")}</div>` : `<p class="sg-muted">六爻皆不變,以本卦卦辭為主。</p>`}
      ${t.changed ? sgHexBlock(t.changed, "變卦・事情的走向") : ""}
      <p class="sg-muted">卦象只是提醒,怎麼走仍由你決定。</p>`;
  }
  return `${head}<div class="sg-card sg-divine">${sgYaoStack(lines)}${body}</div>`;
}
