// 十神試煉場 — 與十神修行錄共用 LINE 登入與雲端存檔(sg-api;試煉進度存在 sg_state.sg_idle)
const SI_LIFF_ID = "2011684838-Jdzxtrxn"; // 與 sg-app.js 相同
const SI_API_URL = "https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/sg-api";

let si_liff = null;
let si_sync_timer = 0;

async function siApi(action, extra = {}, keepalive = false) {
  const idToken = si_liff?.getIDToken?.();
  if (!idToken) throw new Error("NO_ID_TOKEN");
  const res = await fetch(SI_API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive,
    body: JSON.stringify({ action, idToken, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.reason || data.error || `HTTP_${res.status}`);
  return data;
}

const siSavedAt = (sg) => sg?.sg_idle?.si_saved_at || 0;
const siCanSync = (sg) => !!(si_liff && sg?.sg_profile?.sg_consent_at && sg?.sg_chart);

// 登入 LINE 並讀雲端;回傳合併後的狀態(本機為主,試煉進度取較新的一份),失敗回傳 null
export async function siCloudInit(local) {
  try {
    await new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    await window.liff.init({ liffId: SI_LIFF_ID });
    if (!window.liff.isLoggedIn()) { window.liff.login(); return null; }
    si_liff = window.liff;
    const cloud = (await siApi("load"))?.state;
    if (!cloud?.sg_chart) return null;
    // 十神修行錄剛同步過本機,所以本機為主;只有雲端的試煉進度較新時才採用雲端那份
    const merged = local?.sg_chart ? { ...local } : { ...cloud };
    if (siSavedAt(cloud) > siSavedAt(merged)) merged.sg_idle = cloud.sg_idle;
    return merged;
  } catch {
    return null;
  }
}

// 上傳整份狀態;now = 立即送出(切頁、結算時),否則 1 秒內合併
export function siCloudSave(sg, now = false) {
  if (!siCanSync(sg)) return Promise.resolve();
  clearTimeout(si_sync_timer);
  if (now) return siApi("save", { state: sg }, true).catch(() => {});
  si_sync_timer = setTimeout(() => siApi("save", { state: sg }).catch(() => {}), 1000);
  return Promise.resolve();
}
