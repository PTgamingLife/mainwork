// 十神試煉場 — 十種心魔造型與 5 階變形(依被打倒次數)
export const SI_DEMON_TIERS = ["幼影", "成形", "魔化", "魔王", "真身"];
export const SI_DEMON_STEPS = [0, 1500, 4500, 9000, 18000]; // 被打倒次數門檻
export const siDemonTierOf = (kills) => SI_DEMON_STEPS.filter((s) => kills >= s).length - 1;

const SI_INK = "#2A2A2E", SI_PALE = "#D9DBD6", SI_EYE = "#B8951A", SI_GOLD = "#E3BE2B", SI_FIRE = "#D2553F";
const SI_TIER_SCALE = [0.85, 1, 1.2, 1.3, 1.4];
export const siDemonHeight = (tier, s = 1) => 40 * s * SI_TIER_SCALE[tier];

// 在 (x, y=地面) 畫第 idx 種心魔的第 tier 階;s = 額外縮放(頭目 2),t = 時間(動畫)
export function siDrawDemon(ctx, idx, tier, x, y, s = 1, t = 0, flash = false) {
  const u = s * SI_TIER_SCALE[tier];
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = flash ? 0.5 : tier === 0 ? 0.62 : 0.92;
  if (tier >= 2) { // 暗色氣場
    ctx.fillStyle = "rgba(30,30,30,.12)";
    ctx.beginPath(); ctx.ellipse(0, -18 * u, 26 * u, 24 * u, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (tier >= 4) { // 真身:外圍火光
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI, f = 6 * u + Math.sin(t * 8 + k) * 2 * u;
      ctx.fillStyle = k % 2 ? SI_GOLD : SI_FIRE; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 24 * u, -18 * u + Math.sin(a) * 24 * u, 3 * u, f, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = flash ? 0.5 : 0.92;
  }
  SI_DEMON_DRAW[idx](ctx, u, tier, t);
  ctx.restore();
}

function siEye(ctx, x, y, r, tier) {
  ctx.save();
  if (tier >= 3) { ctx.shadowColor = SI_GOLD; ctx.shadowBlur = 6; }
  ctx.fillStyle = tier >= 3 ? SI_GOLD : SI_EYE;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function siBlob(ctx, u, color = SI_INK, w = 15, h = 34) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-w * u, 0);
  ctx.quadraticCurveTo(-w * u, -h * u, 0, -h * u);
  ctx.quadraticCurveTo(w * u, -h * u, w * u, 0);
  for (let k = 0; k < 4; k++) ctx.lineTo((w - 6 - k * 6) * u, (k % 2 ? 0 : -4) * u);
  ctx.closePath(); ctx.fill();
}

function siHorns(ctx, u, y, spread = 6) {
  ctx.fillStyle = SI_INK;
  [-1, 1].forEach((d) => {
    ctx.beginPath(); ctx.moveTo(d * spread * u, y); ctx.quadraticCurveTo(d * (spread + 8) * u, y - 6 * u, d * (spread + 6) * u, y - 14 * u);
    ctx.lineTo(d * (spread - 2) * u, y - 2 * u); ctx.fill();
  });
}

function siCrown(ctx, u, y) {
  ctx.fillStyle = SI_GOLD;
  ctx.beginPath(); ctx.moveTo(-7 * u, y); ctx.lineTo(-7 * u, y - 7 * u); ctx.lineTo(-3.5 * u, y - 3 * u);
  ctx.lineTo(0, y - 9 * u); ctx.lineTo(3.5 * u, y - 3 * u); ctx.lineTo(7 * u, y - 7 * u); ctx.lineTo(7 * u, y); ctx.fill();
}

const SI_DEMON_DRAW = [
  // 0 對立:雙頭互瞪 → 互咬 → 黑白兩半 → 三頭
  (ctx, u, tier) => {
    siBlob(ctx, u, SI_INK, 16, 26);
    if (tier >= 2) { ctx.fillStyle = "#E6E7E4"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26 * u); ctx.quadraticCurveTo(16 * u, -26 * u, 16 * u, 0); ctx.fill(); }
    const heads = tier >= 4 ? [-10, 10, 0] : [-9, 9];
    heads.forEach((hx, i) => {
      const hy = i === 2 ? -44 : -32 + (tier >= 1 ? 2 : 0);
      const lean = i === 2 ? 0 : (tier >= 1 ? -Math.sign(hx) * 3 : 0);
      ctx.fillStyle = tier >= 2 && hx > 0 ? "#E6E7E4" : SI_INK;
      ctx.strokeStyle = SI_INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc((hx + lean) * u, hy * u, 7 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      siEye(ctx, (hx + lean - Math.sign(hx) * 3) * u, (hy - 1) * u, 1.6 * u, tier);
    });
    if (tier >= 3) siHorns(ctx, u, -38 * u, 4);
  },
  // 1 愚鈍:低垂巨頭 → 背石 → 霧遮眼
  (ctx, u, tier) => {
    siBlob(ctx, u, SI_INK, 12, 20);
    const r = (12 + tier * 2) * u;
    ctx.fillStyle = SI_INK; ctx.beginPath(); ctx.arc(8 * u, -12 * u - r * 0.4, r, 0, Math.PI * 2); ctx.fill();
    siEye(ctx, (8 - r / u * 0.3) * u, -12 * u - r * 0.3, 1.8 * u, tier);
    if (tier >= 1) { ctx.fillStyle = "#7A7A78"; for (let k = 0; k < Math.min(3, tier); k++) ctx.fillRect((-14 + k * 3) * u, (-28 - k * 7) * u, 12 * u, 7 * u); }
    if (tier >= 2) { ctx.fillStyle = "rgba(230,231,228,.75)"; ctx.beginPath(); ctx.ellipse(4 * u, -12 * u - r * 0.3, r * 0.8, 4 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    if (tier >= 3) siCrown(ctx, u, -12 * u - r * 1.3);
  },
  // 2 拒絕:縮殼遮臉 → 殼刺 → 盾牆 → 繭
  (ctx, u, tier) => {
    ctx.fillStyle = SI_INK; ctx.beginPath(); ctx.ellipse(0, -14 * u, 17 * u, 16 * u, 0, Math.PI, 0); ctx.lineTo(17 * u, 0); ctx.lineTo(-17 * u, 0); ctx.fill();
    if (tier >= 1) for (let k = 0; k < 3 + tier * 2; k++) {
      const a = Math.PI + ((k + 0.5) / (3 + tier * 2)) * Math.PI;
      ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * 16 * u, -14 * u + Math.sin(a - 0.12) * 15 * u);
      ctx.lineTo(Math.cos(a) * 24 * u, -14 * u + Math.sin(a) * 23 * u); ctx.lineTo(Math.cos(a + 0.12) * 16 * u, -14 * u + Math.sin(a + 0.12) * 15 * u); ctx.fill();
    }
    ctx.strokeStyle = "#7A7A78"; ctx.lineWidth = 2 * u; // 交叉遮臉的手
    ctx.beginPath(); ctx.moveTo(-8 * u, -8 * u); ctx.lineTo(8 * u, -20 * u); ctx.moveTo(8 * u, -8 * u); ctx.lineTo(-8 * u, -20 * u); ctx.stroke();
    siEye(ctx, 0, -22 * u, 1.4 * u, tier);
    if (tier >= 3) { ctx.fillStyle = "#3A3A38"; ctx.fillRect(-22 * u, -24 * u, 5 * u, 24 * u); }
    if (tier >= 4) { ctx.strokeStyle = SI_PALE; ctx.lineWidth = 1; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(0, -16 * u, 18 * u, (6 + k * 4) * u, 0, 0, Math.PI * 2); ctx.stroke(); } }
  },
  // 3 無感:灰白空殼 → 裂紋 → 結霜 → 透明冰殼
  (ctx, u, tier) => {
    if (tier >= 4) ctx.globalAlpha *= 0.55;
    siBlob(ctx, u, SI_PALE, 14, 36);
    ctx.strokeStyle = SI_INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, -18 * u, 13 * u, 18 * u, 0, Math.PI, 0); ctx.stroke();
    if (tier >= 1) { ctx.strokeStyle = "#7A7A78"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4 * u, -32 * u); ctx.lineTo(0, -24 * u); ctx.lineTo(-3 * u, -18 * u); ctx.lineTo(3 * u, -10 * u); if (tier >= 2) { ctx.moveTo(6 * u, -28 * u); ctx.lineTo(3 * u, -20 * u); } ctx.stroke(); }
    if (tier >= 2) { ctx.fillStyle = "#FFFFFF"; for (let k = 0; k < 6 + tier * 2; k++) ctx.fillRect(((k * 37) % 26 - 13) * u, -((k * 23) % 34) * u - 2 * u, 1.6 * u, 1.6 * u); }
    if (tier >= 3) siHorns(ctx, u, -32 * u, 5);
  },
  // 4 殘酷:尖刺獸 → 雙角 → 火鬃
  (ctx, u, tier, t) => {
    ctx.fillStyle = SI_INK; ctx.beginPath(); ctx.ellipse(0, -12 * u, 18 * u, 12 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-14 * u, -6 * u, 4 * u, 6 * u); ctx.fillRect(10 * u, -6 * u, 4 * u, 6 * u);
    const n = 4 + tier * 2;
    for (let k = 0; k < n; k++) {
      const px = (-14 + (28 * k) / (n - 1)) * u;
      ctx.beginPath(); ctx.moveTo(px - 2.5 * u, -20 * u); ctx.lineTo(px, (-30 - (k % 2) * 4) * u); ctx.lineTo(px + 2.5 * u, -20 * u); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(-18 * u, -16 * u, 7 * u, 0, Math.PI * 2); ctx.fill();
    siEye(ctx, -20 * u, -17 * u, 1.8 * u, tier);
    if (tier >= 1) { ctx.save(); ctx.translate(-18 * u, -16 * u); siHorns(ctx, u, -4 * u, 3); ctx.restore(); }
    if (tier >= 2) for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k % 2 ? SI_GOLD : SI_FIRE;
      ctx.beginPath(); ctx.ellipse((-10 + k * 5) * u, (-30 - Math.sin(t * 9 + k) * 2) * u, 2.2 * u, (5 + tier) * u, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 5 醜陋:扭曲肉塊 → 多眼 → 觸手 → 多臉
  (ctx, u, tier, t) => {
    ctx.fillStyle = SI_INK;
    [[-6, -10, 12], [7, -14, 11], [0, -24, 10], [-9, -26, 7], [10, -28, 6]].forEach(([bx, by, r]) => {
      ctx.beginPath(); ctx.arc(bx * u, by * u, r * u, 0, Math.PI * 2); ctx.fill();
    });
    if (tier >= 2) {
      ctx.strokeStyle = SI_INK; ctx.lineWidth = 2.5 * u;
      for (let k = 0; k < 2 + tier; k++) {
        const sx = (-14 + k * 7) * u;
        ctx.beginPath(); ctx.moveTo(sx, -4 * u);
        ctx.quadraticCurveTo(sx - 6 * u, 4 * u + Math.sin(t * 4 + k) * 3 * u, sx - 2 * u, 2 * u); ctx.stroke();
      }
    }
    const eyes = [[-6, -14], [6, -18], [0, -27], [-10, -26], [10, -28], [-2, -8], [9, -9]];
    eyes.slice(0, 1 + Math.ceil(tier * 1.5)).forEach(([ex, ey]) => siEye(ctx, ex * u, ey * u, 1.6 * u, tier));
    if (tier >= 4) { ctx.strokeStyle = SI_EYE; ctx.lineWidth = 1; [[-6, -8], [7, -12]].forEach(([mx, my]) => { ctx.beginPath(); ctx.arc(mx * u, my * u, 3 * u, 0.2, Math.PI - 0.2); ctx.stroke(); }); }
  },
  // 6 色慾:烏鴉羽、媚眼 → 展翅 → 羽冠 → 羽毛環繞
  (ctx, u, tier, t) => {
    const span = 10 + tier * 5;
    ctx.fillStyle = SI_INK;
    [-1, 1].forEach((d) => {
      ctx.beginPath(); ctx.moveTo(d * 6 * u, -22 * u);
      ctx.quadraticCurveTo(d * span * u, -32 * u - Math.sin(t * 5) * 2 * u, d * (span + 4) * u, -10 * u);
      ctx.lineTo(d * 6 * u, -10 * u); ctx.fill();
    });
    siBlob(ctx, u, SI_INK, 10, 34);
    [-3.5, 3.5].forEach((ex) => { ctx.save(); ctx.translate(ex * u, -24 * u); ctx.scale(1.6, 0.8); siEye(ctx, 0, 0, 1.6 * u, tier); ctx.restore(); });
    if (tier >= 2) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse((-3 + k * 3) * u, -38 * u, 1.5 * u, 5 * u, (k - 1) * 0.4, 0, Math.PI * 2); ctx.fill(); }
    if (tier >= 3) for (let k = 0; k < 4; k++) {
      const a = t * 1.5 + k * Math.PI / 2;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 22 * u, -20 * u + Math.sin(a) * 10 * u, 1.4 * u, 4 * u, a, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 7 貪婪:大嘴抱錢袋 → 嘴更大 → 多手 → 金幣環繞
  (ctx, u, tier, t) => {
    siBlob(ctx, u, SI_INK, 16, 32);
    const mw = (8 + tier * 1.5) * u;
    ctx.fillStyle = "#F4F4F2"; ctx.beginPath(); ctx.ellipse(0, -16 * u, mw, (4 + tier) * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SI_INK; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo((k * 3 - 1) * u, -20 * u); ctx.lineTo(k * 3 * u, -16 * u); ctx.lineTo((k * 3 + 1) * u, -20 * u); ctx.fill(); }
    siEye(ctx, -4 * u, -26 * u, 1.6 * u, tier); siEye(ctx, 4 * u, -26 * u, 1.6 * u, tier);
    ctx.fillStyle = SI_GOLD; ctx.beginPath(); ctx.arc(12 * u, -6 * u, 6 * u, 0, Math.PI * 2); ctx.fill();
    if (tier >= 2) { ctx.strokeStyle = SI_INK; ctx.lineWidth = 2.5 * u; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.moveTo(d * 14 * u, -18 * u); ctx.lineTo(d * 22 * u, -24 * u); ctx.stroke(); }); }
    if (tier >= 3) for (let k = 0; k < 5; k++) {
      const a = t * 2 + k * Math.PI * 0.4;
      ctx.fillStyle = SI_GOLD; ctx.beginPath(); ctx.arc(Math.cos(a) * 22 * u, -18 * u + Math.sin(a) * 12 * u, 2.4 * u, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 8 不安:抖動影子,殘影分身 1 → 4
  (ctx, u, tier, t) => {
    const amp = (1 + tier) * u;
    const base = ctx.globalAlpha;
    for (let k = tier; k >= 0; k--) {
      ctx.save();
      ctx.globalAlpha = base * (k === 0 ? 1 : 0.25);
      ctx.translate(Math.sin(t * 23 + k * 2) * amp + k * 6 * u, Math.cos(t * 19 + k) * amp * 0.5);
      siBlob(ctx, u, SI_INK, 13, 34);
      if (k === 0) { siEye(ctx, -4 * u, -24 * u, 1.8 * u, tier); siEye(ctx, 4 * u, -23 * u, 1.4 * u, tier); }
      ctx.restore();
    }
    if (tier >= 3) siHorns(ctx, u, -30 * u, 5);
  },
  // 9 物慾:器物纏身 → 鎖鏈 → 王冠
  (ctx, u, tier, t) => {
    ctx.fillStyle = SI_INK;
    ctx.beginPath(); ctx.moveTo(-11 * u, 0); ctx.lineTo(0, -26 * u); ctx.lineTo(11 * u, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -30 * u, 6 * u, 0, Math.PI * 2); ctx.fill();
    siEye(ctx, -2 * u, -31 * u, 1.3 * u, tier); siEye(ctx, 2 * u, -31 * u, 1.3 * u, tier);
    const n = 2 + tier * 2;
    for (let k = 0; k < n; k++) {
      const a = k * 2.4 + t * 0.6;
      const px = Math.cos(a) * (14 + (k % 3) * 3) * u, py = -14 * u + Math.sin(a) * 12 * u;
      ctx.fillStyle = k % 2 ? SI_GOLD : "#7A7A78";
      if (k % 3 === 0) ctx.fillRect(px - 2.5 * u, py - 2.5 * u, 5 * u, 5 * u);
      else { ctx.beginPath(); ctx.arc(px, py, 2.6 * u, 0, Math.PI * 2); ctx.fill(); }
    }
    if (tier >= 2) { ctx.strokeStyle = "#7A7A78"; ctx.lineWidth = 1.2; ctx.setLineDash([2 * u, 1.5 * u]); ctx.beginPath(); ctx.moveTo(-12 * u, -4 * u); ctx.lineTo(10 * u, -20 * u); ctx.moveTo(12 * u, -4 * u); ctx.lineTo(-8 * u, -18 * u); ctx.stroke(); ctx.setLineDash([]); }
    if (tier >= 3) siCrown(ctx, u, -35 * u);
  },
];
