// 安麗蛋白素 7 天挑戰 — 前端設定
//
// 這裡只放公開值。前端不持有任何 Supabase 金鑰:所有讀寫都帶 LINE ID token
// 打 amp-api,由 Edge Function 用 service role 存取資料庫。
//
// LIFF_ID_* 建好 LIFF App 後填入;在網址加 ?mock=1 可離線試玩(資料存在瀏覽器)。
//
// 兩個 LIFF App 的 Endpoint URL 都指到同一個網址:
//   https://ptgaminglife.github.io/mainwork/amway-protein/
// 全頁那個要加 ?full=1 —— app.js 靠這個參數決定用 LIFF_ID_FULL 而不是 COMPACT。
window.AMP_CONFIG = {
  LIFF_ID_COMPACT: '',
  LIFF_ID_FULL: '',
  API_URL: 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/amp-api',
  ROUND_DAYS: 7,
  MOCK: new URLSearchParams(location.search).has('mock'),
};
