// 生命之旅 — 前端設定(只放公開值,前端不持有任何金鑰)
//
// LIFF:沿用 OA 底下原本那個「全頁」的 LIFF App(2011511140-5AixRgyd)。
// 上線前要在 LINE Developers 把它的 Endpoint URL 改成:
//   https://ptgaminglife.github.io/mainwork/life-journey/
// 網址加 ?mock=1 可以離線試玩(假後端,資料存在瀏覽器)。
window.LJ_CONFIG = {
  LIFF_ID: '2011511140-5AixRgyd',
  API_URL: 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/lj-api',
  // 分享卡片的按鈕:OA 的加好友連結(公開值)
  OA_ADD_FRIEND_URL: 'https://line.me/R/ti/p/@206pvmlu',
  MOCK: new URLSearchParams(location.search).has('mock'),
};
