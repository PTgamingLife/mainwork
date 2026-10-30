// 十神試煉場 — 畫面片段(HTML 字串)
import {
  SI_GODS, SI_GOD_BY_KEY, SI_POINT_NAMES, SI_POINT_ENERGIES, SI_ELEM_COLORS, SI_ELEMENTS, SI_SKILLS, SI_SKILL_STEPS,
  SI_OATH_CUT_MIN, SI_THIEF_CHANCE, SI_THIEF_RATIO, SI_BOND_MULT, SI_TIERS, SI_PENALTY_CAP_MIN,
  siElemOfPoint, siPointOfEnergy, siTierOf, siGodElem,
} from "./si-data.js";
import { SG_TRANSFORMS } from "../../js/sg-wuxing.js";
import { siFmt } from "./si-field.js";
import { siCost, siCostMult } from "./si-store.js";
import { SI_DEMON_TIERS, SI_DEMON_STEPS, siDemonTierOf } from "./si-demons.js";
import { SI_DEMONS } from "./si-data.js";

const siColorOf = (dm, key) => SI_ELEM_COLORS[siElemOfPoint(dm, siPointOfEnergy(SI_GOD_BY_KEY[key].si_energy))];

export function siMmss(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function siViewPending(pending, dm) {
  const list = Object.entries(pending || {}).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
  if (!list.length) return `<span>待領取靈氣 0</span>`;
  const top = list.slice(0, 5).map(([k, v]) =>
    `<span><i class="si-dot" style="background:${siColorOf(dm, k)}"></i>${SI_GOD_BY_KEY[k].si_name} ${siFmt(Math.floor(v))}</span>`);
  return `<span>待領取</span>${top.join("")}${list.length > 5 ? "<span>…</span>" : ""}`;
}

export function siViewWeek(fx, dm) {
  if (!fx.si_labels.length) return "本週尚未立下戒律/約束/誓言,沒有轉化加成。";
  const rows = fx.si_labels.map(({ si_who, si_key }) => {
    const a = SI_ELEMENTS.indexOf(si_key[0]), b = SI_ELEMENTS.indexOf(si_key[2]);
    const pa = (a - Math.floor(dm / 2) + 5) % 5, pb = (b - Math.floor(dm / 2) + 5) % 5;
    const eff = si_key[1] === "剋" ? `星線發亮,${SI_POINT_NAMES[pa]}戰力 +20%` : `相生流加速,${SI_POINT_NAMES[pb]}靈氣 +20%`;
    return `${si_who} <em>${si_key}・${SG_TRANSFORMS[si_key]?.sg_name || ""}</em>(${eff})`;
  });
  return `本週轉化:<br>${rows.join("<br>")}`;
}

export function siViewSkillRow(levels) {
  const [o, p, b] = [levels.si_oath, levels.si_precept, levels.si_bond];
  return `
    <div class="si-skill"><b>誓言 Lv${o.si_level}</b><i>試煉 −${SI_OATH_CUT_MIN[o.si_level]} 分</i><br>累計 ${o.si_count} 次</div>
    <div class="si-skill"><b>戒律 Lv${p.si_level}</b><i>小偷 ${Math.round(SI_THIEF_CHANCE[p.si_level] * 100)}%</i><br>累計 ${p.si_count} 次</div>
    <div class="si-skill"><b>約束 Lv${b.si_level}</b><i>靈氣 ×${SI_BOND_MULT[b.si_level]}</i><br>累計 ${b.si_count} 次</div>`;
}

const siSkillEffect = (key, lv) => ({
  si_oath: `20 分鐘試煉縮短 ${SI_OATH_CUT_MIN[lv]} 分鐘`,
  si_precept: `注意力小偷出現 ${Math.round(SI_THIEF_CHANCE[lv] * 100)}%,偷走 ${Math.round(SI_THIEF_RATIO[lv] * 100)}%`,
  si_bond: `靈氣產量 ×${SI_BOND_MULT[lv]}`,
}[key]);

export function siViewSkills(levels) {
  return SI_SKILLS.map((k) => {
    const { si_level: lv, si_count: n } = levels[k.si_key];
    const next = SI_SKILL_STEPS[lv];
    return `<div class="si-skill-card"><b>${k.si_name} Lv${lv}</b>(累計打卡 ${n} 次)
      <div>目前:${siSkillEffect(k.si_key, lv)}</div>
      <div style="color:var(--si-gray)">${next ? `下一級(累計 ${next} 次):${siSkillEffect(k.si_key, lv + 1)}` : "已滿級"}</div>
      <div class="si-steps">${SI_SKILL_STEPS.map((s) => `<span class="${n >= s ? "on" : ""}"></span>`).join("")}</div></div>`;
  }).join("");
}

export function siViewGods(si, sg, powers, dm) {
  return SI_POINT_ENERGIES.map((e, i) => {
    const color = SI_ELEM_COLORS[siElemOfPoint(dm, i)];
    const rows = SI_GODS.filter((g) => g.si_energy === e).map((g) => {
      const lv = si.si_levels[g.si_key], cost = siCost(si, sg, g.si_key), have = Math.floor(si.si_aura[g.si_key]);
      return `<div class="si-god"><span class="si-swatch" style="background:${color}">${g.si_name[0]}</span>
        <div class="si-god-info"><b>${g.si_name}</b>Lv${lv}・${SI_TIERS[siTierOf(lv)]}<br>戰力 ${siFmt(powers[g.si_key])}・靈氣 ${siFmt(have)}/${siFmt(cost)}<br>命盤 ${sg?.sg_chart?.sg_scores?.[g.si_key] ?? "-"}・升級成本 ×${siCostMult(sg, g.si_key)}</div>
        <button class="si-up" data-si-up="${g.si_key}" ${have >= cost ? "" : "disabled"}>升級</button></div>`;
    }).join("");
    return `<div class="si-group"><div class="si-group-h">${SI_POINT_NAMES[i]}殿・${SI_ELEMENTS[siElemOfPoint(dm, i)]}</div>${rows}</div>`;
  }).join("");
}

function siGainsGrid(gains, dm) {
  return `<div class="si-gains">${SI_GODS.map((g) =>
    `<div style="color:${siColorOf(dm, g.si_key)}">${g.si_name}<b>+${siFmt(gains[g.si_key] || 0)}</b></div>`).join("")}</div>`;
}

function siThiefBox(t) {
  return t
    ? `<div class="si-thief">注意力小偷出現!偷走 ${SI_GOD_BY_KEY[t.si_key].si_name} 靈氣 ${siFmt(t.si_amount)}(${Math.round(t.si_ratio * 100)}%)</div>`
    : `<div class="si-thief si-safe">戒律守住心神,小偷沒有出現</div>`;
}

export function siViewSettle(res, demon, dm) {
  const thief = siThiefBox(res.si_thief);
  return `<h3>擊退 ${demon.si_boss}</h3><p>${demon.si_trait}之心魔已退散${res.si_units > 1 ? `・本場領取 ${res.si_units} 場收益` : ""}</p>
    ${thief}${siGainsGrid(res.si_gains, dm)}<button class="si-btn si-plum" data-si-close>收下靈氣</button>`;
}

export function siViewOffline(res, dm) {
  const h = Math.floor(res.si_away_ms / 3600000), m = Math.floor(res.si_away_ms / 60000) % 60;
  return `<h3>離線收益</h3><p>離開 ${h} 小時 ${m} 分・有效 ${res.si_hours.toFixed(1)} 小時</p>
    <p style="font-size:11.5px;color:var(--si-gray)">有打卡的日子全額、沒打卡 1/5;上次完成試煉後只算 5 天</p>
    ${siThiefBox(res.si_thief)}${siGainsGrid(res.si_gains, dm)}
    ${res.si_expired ? `<p style="color:var(--si-ink);font-weight:700">已超過 5 天沒完成試煉,離線收益已停止</p>` : ""}
    <button class="si-btn si-plum" data-si-close>收下</button>`;
}

export function siViewTimer(run, leftMs, penaltyMin) {
  if (!run) return `今日中斷 ${penaltyMin}/${SI_PENALTY_CAP_MIN}`;
  if (run.si_boss) return `頭目<b>決戰</b>`;
  return `剩餘<b>${siMmss(leftMs)}</b>中斷 +${penaltyMin} 分(今日上限 ${SI_PENALTY_CAP_MIN})`;
}

export function siViewBestiary(kills, dm) {
  return SI_DEMONS.map((d, i) => {
    const n = kills[i], tier = siDemonTierOf(n), next = SI_DEMON_STEPS[tier + 1];
    return `<div class="si-demon-card"><div class="si-demon-h"><b>${d.si_trait}・${d.si_boss}</b>
      <span>${SI_DEMON_TIERS[tier]}・已打倒 ${siFmt(n)}${next ? ` / ${siFmt(next)}` : "(已達真身)"}</span></div>
      <canvas data-si-demon="${i}" style="width:100%;aspect-ratio:330/78"></canvas>
      <div class="si-demon-tiers">${SI_DEMON_TIERS.map((t, k) => `<span class="${k <= tier ? "on" : ""}">${t}</span>`).join("")}</div>
      <div class="si-demon-drop">屬${SI_ELEMENTS[siGodElem(dm, d.si_drop)]}(代表${SI_GOD_BY_KEY[d.si_drop].si_name})・掉落${SI_GOD_BY_KEY[d.si_drop].si_name}靈氣・被剋傷害 +15%</div></div>`;
  }).join("");
}
