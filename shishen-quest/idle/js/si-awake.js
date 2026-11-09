// 十神試煉場 — 試煉中保持螢幕常亮(避免手機自動關螢幕而中斷試煉)
// 優先用 Screen Wake Lock API;不支援(如部分 LINE 內建瀏覽器)時,播放隱藏的靜音循環小影片
let si_lock = null;
let si_video = null;
let si_on = false;

function siVideo() {
  if (si_video) return si_video;
  const v = document.createElement("video");
  v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
  v.muted = true; v.loop = true;
  v.setAttribute("webkit-playsinline", "");
  v.style.cssText = "position:fixed;width:2px;height:2px;opacity:0.02;pointer-events:none;left:0;bottom:0;";
  [["media/si-keepawake.mp4", "video/mp4"], ["media/si-keepawake.webm", "video/webm"]].forEach(([src, type]) => {
    const s = document.createElement("source"); s.src = src; s.type = type; v.appendChild(s);
  });
  document.body.appendChild(v);
  si_video = v;
  return v;
}

async function siLock() {
  if (!("wakeLock" in navigator)) return false;
  try {
    si_lock = await navigator.wakeLock.request("screen");
    si_lock.addEventListener("release", () => { si_lock = null; });
    return true;
  } catch { return false; }
}

// 開始試煉時呼叫,必須在使用者點擊的當下同步執行:
// iPhone(LINE 內建瀏覽器)不支援 Wake Lock,且影片只能在點擊當下開始播放,所以先播影片,Wake Lock 成功再停影片
export function siAwakeOn() {
  si_on = true;
  const v = siVideo();
  v.play().catch(() => {});
  siLock().then((ok) => { if (ok) v.pause(); });
}

// 回到畫面時重新取得(切 App 回來後 Wake Lock 會被系統釋放)
export function siAwakeResume() {
  if (!si_on || document.hidden) return;
  if (!si_lock) siAwakeOn();
}

export function siAwakeOff() {
  si_on = false;
  si_lock?.release().catch(() => {});
  si_lock = null;
  si_video?.pause();
}
