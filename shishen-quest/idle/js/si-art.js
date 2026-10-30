// 十神試煉場 — AI 美術圖(img/);沒有圖的角色沿用程式繪製
// 檔名:si-god-<十神key>-t<階>.webp、si-demon-<心魔序號>-t<階>.webp、si-bg-0.webp
const SI_ART_LIST = {
  si_bg: "img/si-bg-0.webp",
  si_gods: { bi_jian: [0] },
  si_demons: { 7: [0] },
};

const si_imgs = {};
function siLoad(src) {
  if (!(src in si_imgs)) {
    const im = new Image();
    si_imgs[src] = null;
    im.onload = () => { si_imgs[src] = im; };
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
export const siArtGod = (key, tier) => siPick("si-god", key, SI_ART_LIST.si_gods[key], tier);
export const siArtDemon = (idx, tier) => siPick("si-demon", idx, SI_ART_LIST.si_demons[idx], tier);
