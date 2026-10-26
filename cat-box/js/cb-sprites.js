// cb-sprites.js — 角色圖片(Higgsfield 生成)+ 程式動作(呼吸/走路/落地壓扁/跳進紙箱/被打飛)
(function (cb_root) {
  const CB_SP = { ready: false, cat: null, catHurt: null, dog: null, box: null, boxBurnt: null };
  const CB_DRAW_W = { cat: 6.6, dog: 7.2, box: 7.2 };   // 圖寬(格)
  const dust = [];

  function load(src) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  function tint(im, color) {
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  load('assets/cb_bg.webp').then((im) => { CB_SP.bg = im; });
  load('assets/cb_wall.webp').then((im) => { CB_SP.wall = im; });
  Promise.all(['assets/cb_cat.webp', 'assets/cb_dog.webp', 'assets/cb_box.webp'].map(load)).then(([cat, dog, box]) => {
    if (!cat || !dog || !box) return;   // 任一張失敗 → 維持向量畫法
    Object.assign(CB_SP, { cat, dog, box, catHurt: tint(cat, 'rgba(120,40,40,.4)'), boxBurnt: tint(box, 'rgba(50,25,15,.75)'), ready: true });
  });

  // 落地偵測 → 壓扁回彈 + 揚塵
  function track(e, s, now) {
    if (!e.grounded) e._air = true;
    else if (e._air) {
      e._air = false; e._landAt = now;
      for (let k = 0; k < 6; k++) dust.push({ x: e.rx + e.w / 2 + (k - 2.5) * 0.8, y: e.ry + e.h, vx: (k - 2.5) * 0.9, born: now });
    }
  }

  function motion(e, now) {
    const m = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
    if (!e.grounded) { m.sx = 0.93; m.sy = 1.08; return m; }
    const land = e._landAt ? Math.max(0, 1 - (now - e._landAt) / 260) : 0;
    if (land > 0) { const k = Math.sin(land * Math.PI) * 0.22; m.sx += k; m.sy -= k; }
    if (e.walking) {
      const sp = e.kind === 'dog' ? 70 : 85;
      m.dy = -Math.abs(Math.sin(now / sp)) * 0.45;
      m.rot = Math.sin(now / sp) * 0.07;
    } else {
      const b = Math.sin(now / (e.kind === 'dog' ? 300 : 450)) * 0.025;
      m.sx -= b; m.sy += b;
    }
    return m;
  }

  // 以「底部中心」為錨點畫圖
  function blit(ctx, img, ax, ay, wCells, s, m, flip, alpha) {
    const w = wCells * s, h = w * img.height / img.width;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(ax * s + m.dx * s, ay * s + m.dy * s);
    ctx.rotate(m.rot);
    ctx.scale((flip ? -1 : 1) * m.sx, m.sy);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function cbSpriteCat(ctx, e, s, now, g, hiding, box) {
    if (!CB_SP.ready) return false;
    if (!e.alive) return true;
    track(e, s, now);
    let ax = e.rx + e.w / 2, ay = e.ry + e.h + 0.15;
    let m = motion(e, now);
    if (hiding > 0) {   // 跳進紙箱:拋物線 + 縮小,最後只露出頭
      const tx = box.rx + box.w / 2, ty = box.ry + box.h - 2.4;
      ax += (tx - ax) * hiding; ay += (ty - ay) * hiding - Math.sin(hiding * Math.PI) * 4;
      const sc = 1 - 0.22 * hiding;
      m = { dx: 0, dy: 0, sx: sc, sy: sc, rot: Math.sin(hiding * Math.PI) * -0.3 * e.face };
    }
    const lost = g.state === 'lose' && (g.reason === 'cat_burn' || g.reason === 'dog');
    if (lost) { m.dx = Math.sin(now / 30) * 0.25; m.rot = 0.15; }
    if (hiding > 0) {   // 紙箱先畫好,貓只畫在箱口以上 → 看起來坐進箱子裡
      const bw = CB_DRAW_W.box, bh = bw * CB_SP.box.height / CB_SP.box.width;
      const rim = box.ry + box.h + 0.1 - bh * 0.6;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1e4, rim * s); ctx.clip();
      blit(ctx, CB_SP.cat, ax, ay, CB_DRAW_W.cat, s, m, e.face < 0);
      ctx.restore();
      return true;
    }
    blit(ctx, lost ? CB_SP.catHurt : CB_SP.cat, ax, ay, CB_DRAW_W.cat, s, m, e.face < 0);
    return true;
  }

  function cbSpriteDog(ctx, e, s, now) {
    if (!CB_SP.ready) return false;
    const ax = e.rx + e.w / 2, ay = e.ry + e.h + 0.15;
    if (!e.alive) {   // 被打飛:旋轉、縮小、淡出
      e._deadAt = e._deadAt || now;
      const t = (now - e._deadAt) / 650;
      if (t < 1) blit(ctx, CB_SP.dog, ax, ay - t * 3, CB_DRAW_W.dog, s, { dx: 0, dy: 0, sx: 1 - t * 0.4, sy: 1 - t * 0.4, rot: t * 4 }, e.face > 0, 1 - t);
      return true;
    }
    track(e, s, now);
    blit(ctx, CB_SP.dog, ax, ay, CB_DRAW_W.dog, s, motion(e, now), e.face > 0);
    return true;
  }

  function cbSpriteBox(ctx, e, s, now) {
    if (!CB_SP.ready) return false;
    if (!e.alive && !e.burnt) return true;
    track(e, s, now);
    const m = motion(e, now);
    m.rot = 0; m.dy = 0;
    if (!e.burnt && e.grounded && !e._landAt) { m.sx = 1; m.sy = 1; }
    blit(ctx, e.burnt ? CB_SP.boxBurnt : CB_SP.box, e.rx + e.w / 2, e.ry + e.h + 0.1, CB_DRAW_W.box, s, m, false);
    return true;
  }

  function cbSpriteDust(ctx, s, now) {
    ctx.fillStyle = '#E9D8C4';
    for (let k = dust.length - 1; k >= 0; k--) {
      const d = dust[k], t = (now - d.born) / 450;
      if (t >= 1) { dust.splice(k, 1); continue; }
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.beginPath(); ctx.arc((d.x + d.vx * t) * s, (d.y - t * 1.2) * s, s * (0.5 + t * 0.8), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  cb_root.CB_SPRITES = { CB_SP, cbSpriteCat, cbSpriteDog, cbSpriteBox, cbSpriteDust };
})(window);
