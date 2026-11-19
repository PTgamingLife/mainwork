// 十神試煉場 — 畫面演出:結算數字跳動、寶箱、升階大演出(依序播放)
const si_reveals = [];
let si_revealing = false;

// 結算數字由 0 跳到目標值;進度條從舊值長到新值
export function siCountUp(root, ms = 900) {
  const nums = [...root.querySelectorAll("[data-si-count]")];
  const t0 = performance.now();
  const tick = (now) => {
    const u = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3);
    nums.forEach((n) => { n.textContent = `+${Math.round(Number(n.dataset.siCount) * e)}`; });
    if (u < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => root.querySelectorAll("[data-si-bar]").forEach((b) => { b.style.width = `${b.dataset.siBar}%`; }), 250);
}

// 寶箱(開箱動畫靠 CSS)
export const siChest = () => `<div class="si-chest"><i class="si-chest-glow"></i><i class="si-chest-lid"></i><i class="si-chest-box"></i></div>`;

// 升階大演出:{ si_img, si_title, si_sub };一次播一個,點一下換下一個
export function siRevealQueue(item) {
  si_reveals.push(item);
}

export function siRevealFlush() {
  if (si_revealing || !si_reveals.length) return;
  const el = document.getElementById("si-reveal");
  const r = si_reveals.shift();
  si_revealing = true;
  el.innerHTML = `<div class="si-reveal-rays"></div><div class="si-reveal-body">
    ${r.si_img ? `<img src="${r.si_img}" alt="">` : ""}<h3>${r.si_title}</h3><p>${r.si_sub}</p><small>點一下繼續</small></div>`;
  el.classList.add("on");
  if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
  el.onclick = () => {
    el.classList.remove("on");
    si_revealing = false;
    setTimeout(siRevealFlush, 250);
  };
}
