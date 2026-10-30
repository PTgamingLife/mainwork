// 十神試煉場 — AI 美術圖(img/);沒有圖的角色沿用程式繪製
// 檔名:si-god-<十神key>-t<階>.webp、si-demon-<心魔序號>-t<階>.webp、si-bg-0.webp、si-wheel-0.webp
import { siDrawDemon, siDemonHeight } from "./si-demons.js";

const SI_ART_LIST = {
  si_bg: "img/si-bg-0.webp",
  si_wheel: "img/si-wheel-0.webp",
  si_gods: Object.fromEntries(["bi_jian", "jie_cai", "shi_shen", "shang_guan", "zheng_cai", "pian_cai",
    "zheng_guan", "qi_sha", "zheng_yin", "pian_yin"].map((k) => [k, [0, 1, 2, 3, 4]])),
  // 心魔:各自已完成的階段圖(其餘階沿用最近一階圖,再疊程式效果)
  si_demons: { 0: [0, 1, 2, 3, 4], 1: [0, 1, 2, 3, 4], 2: [0, 1, 2, 3], 3: [0], 4: [0], 5: [0], 6: [0],
    7: [0, 1, 2, 3, 4], 8: [0], 9: [0] },
};

const si_imgs = {};
function siLoad(src) {
  if (!(src in si_imgs)) {
    const im = new Image();
    si_imgs[src] = null;
    im.onload = () => { si_imgs[src] = im; window.dispatchEvent(new Event("si-art-loaded")); };
    im.src = src;
  }
  return si_imgs[src];
}

// 取得 ≤ 指定階的最高一張圖;還沒載入或沒有圖時回傳 null
function siPick(prefix, id, tiers, tier) {
  const have = (tiers || []).filter((t) => t <= tier);
  if (!have.length) return null;
  return siLoad(`img/${prefix}-${id}-t${Math.max(...have)}.webp`);
}

export const siArtBg = () => siLoad(SI_ART_LIST.si_bg);
export const siArtWheel = () => siLoad(SI_ART_LIST.si_wheel);
export const siArtGod = (key, tier) => siPick("si-god", key, SI_ART_LIST.si_gods[key], tier);
export const siArtDemon = (idx, tier) => siPick("si-demon", idx, SI_ART_LIST.si_demons[idx], tier);
// 這一階有沒有獨立圖(有就不再用程式疊光暈、冠飾)
export const siArtGodExact = (key, tier) => (SI_ART_LIST.si_gods[key] || []).includes(tier);
const siArtDemonExact = (idx, tier) => (SI_ART_LIST.si_demons[idx] || []).includes(tier);

// 心魔:有 AI 圖就畫圖,再依階段疊上氣場、金冠;沒有圖就用程式繪製
export function siDrawDemonAny(ctx, idx, tier, x, y, s = 1, t = 0, flash = false) {
  const art = siArtDemon(idx, tier);
  const h = siDemonHeight(tier, s);
  if (art) {
    const ah = h * (s > 1 ? 1.05 : 1.25), aw = ah * art.width / art.height, bob = Math.sin(t * 4) * 1.5;
    const fx = !siArtDemonExact(idx, tier) || tier === 0;
    ctx.save();
    if (fx && tier >= 2) { // 魔化以上:暗色氣場;真身:外圍火光
      ctx.fillStyle = tier >= 4 ? "rgba(227,190,43,.18)" : "rgba(30,30,30,.14)";
      ctx.beginPath(); ctx.ellipse(x, y - ah / 2, aw * 0.62, ah * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = flash ? 0.5 : tier === 0 ? 0.8 : 1;
    ctx.drawImage(art, x - aw / 2, y - ah + bob, aw, ah);
    ctx.globalAlpha = 1;
    if (fx && tier >= 3) { // 魔王以上:頭頂金冠
      const cy = y - ah + bob - 2;
      ctx.fillStyle = "#E3BE2B"; ctx.beginPath();
      ctx.moveTo(x - 7, cy); ctx.lineTo(x - 7, cy - 7); ctx.lineTo(x - 3.5, cy - 3); ctx.lineTo(x, cy - 9);
      ctx.lineTo(x + 3.5, cy - 3); ctx.lineTo(x + 7, cy - 7); ctx.lineTo(x + 7, cy); ctx.fill();
    }
    ctx.restore();
  } else siDrawDemon(ctx, idx, tier, x, y, s, t, flash);
}
