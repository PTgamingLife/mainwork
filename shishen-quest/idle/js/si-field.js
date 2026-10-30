// 十神試煉場 — 戰場(canvas):風火輪、五芒星、十神、心魔、靈氣流動
import { siDrawDemon, siDemonHeight } from "./si-demons.js";
import { siArtBg, siArtGod, siArtDemon } from "./si-art.js";
import { siCounterMult } from "./si-data.js";
import { SI_GODS, SI_DEMONS, SI_ELEM_COLORS, SI_POINT_SHORT, siPointOfEnergy, siElemOfPoint, siTierOf } from "./si-data.js";

const SI_W = 390, SI_H = 300, SI_GROUND = 266;
const SI_CX = 128, SI_CY = 152, SI_R = 104, SI_FLOW_R = 68;
const SI_SPAWN_S = 2.5, SI_HIT_S = 0.3, SI_ENEMY_SPEED = 42;

const siAng = (i) => (-90 + i * 72) * Math.PI / 180;
const siAt = (i, r) => [SI_CX + r * Math.cos(siAng(i)), SI_CY + r * Math.sin(siAng(i))];

export function siCreateField(canvas, hooks) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = SI_W * dpr; canvas.height = SI_H * dpr;
  canvas.style.width = "100%"; canvas.style.aspectRatio = `${SI_W} / ${SI_H}`;
  ctx.scale(dpr, dpr);

  const f = {
    si_model: null, si_running: false, si_boss_phase: false, si_t: 0, si_scroll: 0, si_roll: 0,
    si_enemies: [], si_fx: [], si_auras: [], si_spawn_cd: 0.5, si_hit_cd: 0,
  };

  // 十神位置:各點內側 / 外側
  const godPos = (g) => {
    const pt = siPointOfEnergy(g.si_energy);
    return siAt(pt, g.si_inner ? 42 : 92);
  };

  const totalPower = () => SI_GODS.reduce((s, g) => s + (f.si_model?.si_powers[g.si_key] || 0), 0);
  const godColor = (g) => SI_ELEM_COLORS[siElemOfPoint(f.si_model.si_dm, siPointOfEnergy(g.si_energy))];

  function spawn(boss = false) {
    const m = f.si_model;
    const theme = SI_DEMONS.indexOf(m.si_demon);
    const idx = boss || Math.random() < 0.4 ? theme : Math.floor(Math.random() * SI_DEMONS.length);
    const hp = boss ? Math.max(1, totalPower() / 10 * 8) : m.si_enemy_hp;
    f.si_enemies.push({ x: SI_W + 30, hp, max: hp, idx, boss, flash: 0, wob: Math.random() * 6 });
  }

  function pickGod() {
    const p = f.si_model.si_powers;
    let r = Math.random() * totalPower();
    for (const g of SI_GODS) { r -= p[g.si_key]; if (r <= 0) return g; }
    return SI_GODS[0];
  }

  function kill(e) {
    if (e.boss) { hooks.si_onBossDead(e.idx); f.si_boss_phase = false; return; }
    const key = SI_DEMONS[e.idx].si_drop;
    hooks.si_onKill(key, e.idx);
    const g = SI_GODS.find((x) => x.si_key === key);
    f.si_auras.push({ x0: e.x, y0: SI_GROUND - 22, t: 0, g, pt: siPointOfEnergy(g.si_energy) });
  }

  function step(dt) {
    f.si_t += dt;
    const moving = f.si_running && !f.si_enemies.some((e) => e.x < frontX(0) + 2);
    f.si_scroll += (moving ? 60 : f.si_running ? 6 : 14) * dt;
    f.si_roll += (moving ? 2.4 : 0.6) * dt;
    if (f.si_running && !f.si_boss_phase) {
      f.si_spawn_cd -= dt;
      if (f.si_spawn_cd <= 0 && f.si_enemies.length < 6) { spawn(); f.si_spawn_cd = SI_SPAWN_S; }
    }
    // 心魔前進、排隊
    f.si_enemies.forEach((e, i) => {
      e.x = Math.max(frontX(i) + (e.boss ? 16 : 0), e.x - SI_ENEMY_SPEED * dt);
      e.flash = Math.max(0, e.flash - dt);
    });
    // 十神攻擊最前面的心魔
    const front = f.si_enemies[0];
    f.si_hit_cd -= dt;
    if (front && front.x < SI_W - 20 && f.si_hit_cd <= 0) {
      f.si_hit_cd = SI_HIT_S;
      const g = pickGod();
      const cm = siCounterMult(f.si_model.si_dm, g.si_key, SI_DEMONS[front.idx].si_drop);
      const dmg = Math.max(1, Math.round(totalPower() / 10 * SI_HIT_S * (0.8 + Math.random() * 0.4) * cm));
      front.hp -= dmg; front.flash = 0.12;
      const [gx, gy] = godPos(g);
      f.si_fx.push({ k: "shot", x0: gx, y0: gy, x1: front.x, y1: SI_GROUND - siDemonHeight(f.si_model.si_demon_tiers[front.idx], front.boss ? 1.5 : 1) * 0.6, t: 0, c: godColor(g) });
      f.si_fx.push({ k: "num", x: front.x + (Math.random() * 30 - 15), y: SI_GROUND - 60, t: 0, v: dmg, c: godColor(g), cm });
      if (front.hp <= 0) { f.si_enemies.shift(); kill(front); }
    }
    f.si_fx.forEach((x) => { x.t += dt; });
    f.si_fx = f.si_fx.filter((x) => x.t < (x.k === "num" ? 0.9 : 0.25));
    f.si_auras.forEach((a) => { a.t += dt; });
    f.si_auras = f.si_auras.filter((a) => a.t < 1.6);
  }

  const frontX = (i) => SI_CX + SI_R + 34 + i * 36;

  // ---- 繪製 ----
  function drawBg() {
    ctx.clearRect(0, 0, SI_W, SI_H);
    const hill = (amp, base, color, speed, wl) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, SI_H);
      for (let x = 0; x <= SI_W; x += 6) {
        const u = (x + f.si_scroll * speed) / wl;
        ctx.lineTo(x, base - amp * (Math.sin(u) * 0.6 + Math.sin(u * 2.3 + 1) * 0.4));
      }
      ctx.lineTo(SI_W, SI_H); ctx.fill();
    };
    const bg = siArtBg();
    if (bg) { // 水墨山水圖:左右鏡像交替平鋪,接縫不明顯
      const w = SI_H * bg.width / bg.height, off = (f.si_scroll * 0.3) % (w * 2);
      for (let x = -off, k = 0; x < SI_W; x += w, k++) {
        ctx.save();
        if (k % 2) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(bg, 0, 0, w, SI_H); }
        else ctx.drawImage(bg, x, 0, w, SI_H);
        ctx.restore();
      }
    } else {
      hill(28, 95, "#DFE0DC", 0.15, 70);
      hill(22, 145, "#D2D4CF", 0.35, 50);
      ctx.fillStyle = "#C3C6C0"; ctx.fillRect(0, SI_GROUND, SI_W, SI_H - SI_GROUND);
    }
    ctx.strokeStyle = "#9A9C97"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, SI_GROUND); ctx.lineTo(SI_W, SI_GROUND); ctx.stroke();
    ctx.strokeStyle = "rgba(122,122,120,.35)";
    for (let x = -((f.si_scroll * 1.2) % 40); x < SI_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, SI_GROUND + 12); ctx.lineTo(x + 14, SI_GROUND + 12); ctx.stroke();
    }
  }

  function drawWheel() {
    const m = f.si_model;
    // 火焰外圈(旋轉)
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12 + f.si_roll;
      const flick = 16 + (k % 3) * 5 + Math.sin(f.si_t * 9 + k) * 4;
      ctx.fillStyle = k % 2 ? "rgba(227,190,43,.9)" : "rgba(210,85,63,.85)";
      ctx.beginPath();
      ctx.moveTo(SI_CX + SI_R * Math.cos(a), SI_CY + SI_R * Math.sin(a));
      ctx.quadraticCurveTo(SI_CX + (SI_R + flick) * Math.cos(a + 0.22), SI_CY + (SI_R + flick) * Math.sin(a + 0.22),
        SI_CX + SI_R * Math.cos(a + 0.26), SI_CY + SI_R * Math.sin(a + 0.26));
      ctx.fill();
    }
    ctx.fillStyle = "rgba(250,250,248,.94)"; ctx.strokeStyle = "#1E1E1E"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(SI_CX, SI_CY, SI_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 輪輻(隨滾動旋轉)
    ctx.strokeStyle = "rgba(30,30,30,.08)"; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = f.si_roll + k * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(SI_CX + 96 * Math.cos(a), SI_CY + 96 * Math.sin(a));
      ctx.lineTo(SI_CX + 102 * Math.cos(a), SI_CY + 102 * Math.sin(a)); ctx.stroke();
    }
    // 相生流:外圈
    ctx.setLineDash([3, 4]); ctx.strokeStyle = "#B9BAB6"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(SI_CX, SI_CY, SI_FLOW_R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    m.si_fx.si_sheng.forEach((p) => {
      ctx.strokeStyle = SI_ELEM_COLORS[siElemOfPoint(m.si_dm, p.si_from)];
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(f.si_t * 3); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(SI_CX, SI_CY, SI_FLOW_R, siAng(p.si_from), siAng(p.si_to)); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    for (let k = 0; k < 20; k++) {
      const u = (k / 20 + f.si_t * 0.05) % 1;
      const a = -Math.PI / 2 + u * Math.PI * 2;
      ctx.fillStyle = SI_ELEM_COLORS[siElemOfPoint(m.si_dm, Math.floor(u * 5))];
      ctx.beginPath(); ctx.arc(SI_CX + SI_FLOW_R * Math.cos(a), SI_CY + SI_FLOW_R * Math.sin(a), 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // 相剋:五芒星
    for (let i = 0; i < 5; i++) {
      const j = (i + 2) % 5;
      const hot = m.si_fx.si_ke.some((p) => p.si_from === i && p.si_to === j);
      const [x1, y1] = siAt(i, SI_FLOW_R), [x2, y2] = siAt(j, SI_FLOW_R);
      ctx.strokeStyle = hot ? "#E3BE2B" : "rgba(30,30,30,.3)"; ctx.lineWidth = hot ? 3.5 : 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // 核心
    const pulse = 1 + 0.15 * Math.sin(f.si_t * 4);
    ctx.fillStyle = "rgba(227,190,43,.25)";
    ctx.beginPath(); ctx.arc(SI_CX, SI_CY, 15 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#E3BE2B"; ctx.beginPath(); ctx.arc(SI_CX, SI_CY, 8, 0, Math.PI * 2); ctx.fill();
    // 殿閣
    for (let i = 0; i < 5; i++) {
      const [hx, hy] = siAt(i, SI_FLOW_R);
      const c = SI_ELEM_COLORS[siElemOfPoint(m.si_dm, i)];
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(hx - 12, hy - 1);
      ctx.quadraticCurveTo(hx, hy - 12, hx + 12, hy - 1); ctx.fill();
      ctx.fillStyle = "#FBF6F0"; ctx.strokeStyle = c; ctx.lineWidth = 1.2;
      ctx.fillRect(hx - 8, hy - 1, 16, 9); ctx.strokeRect(hx - 8, hy - 1, 16, 9);
      ctx.fillStyle = c; ctx.font = "bold 7px serif"; ctx.textAlign = "center";
      ctx.fillText(SI_POINT_SHORT[i], hx, hy + 6.5);
    }
    SI_GODS.forEach(drawGod);
  }

  function drawGod(g) {
    const m = f.si_model;
    const [x, y] = godPos(g);
    const c = godColor(g);
    const tier = siTierOf(m.si_levels[g.si_key]);
    const max = Math.max(...Object.values(m.si_powers));
    const glow = 0.15 + 0.5 * (m.si_powers[g.si_key] / max);
    const bob = Math.sin(f.si_t * 3 + x) * 1.2;
    ctx.save(); ctx.translate(x, y + bob);
    ctx.globalAlpha = glow; ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, -3, 9 + tier * 2.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const art = siArtGod(g.si_key, tier);
    if (art) {
      const h = 30, w = h * art.width / art.height;
      ctx.drawImage(art, -w / 2, 10 - h, w, h);
      ctx.fillStyle = "#3A3A38"; ctx.font = "7.5px serif"; ctx.textAlign = "center";
      ctx.fillText(g.si_name, 0, 18);
      ctx.restore();
      return;
    }
    if (tier >= 4) { ctx.strokeStyle = "#E3BE2B"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -3, 15, f.si_t, f.si_t + Math.PI * 1.5); ctx.stroke(); }
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-6 - tier * 0.6, 8); ctx.lineTo(0, -3); ctx.lineTo(6 + tier * 0.6, 8); ctx.fill();
    ctx.fillStyle = "#FBF6F0"; ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -7, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (tier >= 1) { ctx.strokeStyle = "#3A3A38"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(7, 8); ctx.lineTo(9, -6); ctx.stroke(); }
    if (tier >= 2) { ctx.strokeStyle = "#E3BE2B"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -7, 7, Math.PI, 0); ctx.stroke(); }
    if (tier >= 3) { ctx.strokeStyle = "#E3BE2B"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(0, -16); ctx.lineTo(4, -12); ctx.stroke(); }
    ctx.fillStyle = "#3A3A38"; ctx.font = "7.5px serif"; ctx.textAlign = "center";
    ctx.fillText(g.si_name, 0, 17);
    ctx.restore();
  }

  function drawEnemy(e) {
    const s = e.boss ? 1.5 : 1, x = e.x, y = SI_GROUND;
    const tier = f.si_model.si_demon_tiers[e.idx];
    const d = SI_DEMONS[e.idx], h = siDemonHeight(tier, s);
    const art = siArtDemon(e.idx, tier);
    if (art) {
      const ah = h * 1.25, aw = ah * art.width / art.height, bob = Math.sin(f.si_t * 4 + e.wob) * 1.5;
      ctx.save(); ctx.globalAlpha = e.flash > 0 ? 0.5 : 1;
      ctx.drawImage(art, x - aw / 2, y - ah + bob, aw, ah);
      ctx.restore();
    } else siDrawDemon(ctx, e.idx, tier, x, y, s, f.si_t + e.wob, e.flash > 0);
    ctx.fillStyle = "#3A3A38"; ctx.font = `${e.boss ? "bold 11" : "8.5"}px serif`; ctx.textAlign = "center";
    ctx.fillText(e.boss ? `${d.si_boss}・${d.si_trait}` : `${d.si_trait}之影`, x, e.boss ? y - h - 14 : y + 13);
    if (e.boss || e.hp < e.max) {
      ctx.fillStyle = "rgba(30,30,30,.15)"; ctx.fillRect(x - 16 * s, y - h - 8, 32 * s, 3);
      ctx.fillStyle = "#3A3A38"; ctx.fillRect(x - 16 * s, y - h - 8, 32 * s * Math.max(0, e.hp / e.max), 3);
    }
  }

  function drawFx() {
    f.si_fx.forEach((x) => {
      if (x.k === "shot") {
        const u = x.t / 0.25;
        const px = x.x0 + (x.x1 - x.x0) * u, py = x.y0 + (x.y1 - x.y0) * u;
        ctx.fillStyle = x.c; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        // 相剋:大字梅黃加「剋」;被剋:小字灰
        const up = x.cm > 1, down = x.cm < 1;
        ctx.globalAlpha = 1 - x.t / 0.9; ctx.fillStyle = down ? "#9A9C97" : up ? "#E3BE2B" : "#B8951A";
        ctx.font = `bold ${up ? 17 : down ? 11 : 14}px serif`; ctx.textAlign = "center";
        ctx.fillText(up ? `剋 ${siFmt(x.v)}` : siFmt(x.v), x.x, x.y - x.t * 30); ctx.globalAlpha = 1;
      }
    });
    // 靈氣:心魔 → 核心 → 沿相生流到該點
    f.si_auras.forEach((a) => {
      let px, py;
      if (a.t < 0.7) {
        const u = a.t / 0.7;
        px = a.x0 + (SI_CX - a.x0) * u; py = a.y0 + (SI_CY - a.y0) * u - Math.sin(u * Math.PI) * 50;
      } else {
        const u = (a.t - 0.7) / 0.9;
        const r = SI_FLOW_R * Math.min(1, u * 2);
        const ang = siAng(a.pt) - (1 - u) * 1.2;
        px = SI_CX + r * Math.cos(ang); py = SI_CY + r * Math.sin(ang);
      }
      ctx.fillStyle = godColor(a.g); ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    });
  }

  function draw() {
    if (!f.si_model) return;
    drawBg();
    // 速度線
    if (f.si_running) {
      ctx.strokeStyle = "rgba(122,122,120,.6)"; ctx.lineWidth = 2; ctx.lineCap = "round";
      [SI_GROUND - 40, SI_GROUND - 24, SI_GROUND - 8].forEach((y, i) => { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(18 + i * 6, y); ctx.stroke(); });
    }
    drawWheel();
    f.si_enemies.slice().reverse().forEach(drawEnemy);
    drawFx();
  }

  return {
    si_setModel(m) { f.si_model = m; },
    si_setRunning(on) { f.si_running = on; if (!on) { f.si_enemies = []; f.si_boss_phase = false; } },
    si_startBoss() {
      if (f.si_boss_phase) return;
      f.si_boss_phase = true; spawn(true);
    },
    si_isBoss: () => f.si_boss_phase,
    si_step(dt) { const n = Math.ceil(dt / 0.05); for (let i = 0; i < n; i++) step(dt / n); },
    si_draw: draw,
  };
}

export function siFmt(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}m`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(Math.round(v));
}
