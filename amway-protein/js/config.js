// 安麗蛋白素 7 天挑戰 — 前端設定
//
// 這裡只放公開值。前端不持有任何 Supabase 金鑰:所有讀寫都帶 LINE ID token
// 打 amp-api,由 Edge Function 用 service role 存取資料庫。
//
// LIFF_ID_* 建好 LIFF App 後填入;在網址加 ?mock=1 可離線試玩(資料存在瀏覽器)。
//
// LIFF App 的 Endpoint URL:
//   https://ptgaminglife.github.io/mainwork/amway-protein/
// 四個分頁(首頁/加分/排行/問答)都在 LIFF_ID_COMPACT 這一個半頁 App 裡切換,
// 該 LIFF 在 LINE Developers 的 size 要設 Tall(約 3/4 螢幕),Compact 太矮會截到內容。
// LIFF_ID_FULL 目前沒有用到,保留給日後想開全頁時用。
window.AMP_CONFIG = {
  LIFF_ID_COMPACT: '2011511140-iU64mwtd',
  LIFF_ID_FULL: '2011511140-5AixRgyd',
  API_URL: 'https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/amp-api',
  ROUND_DAYS: 7,

  // 分享用:OA 的加好友連結(公開值)。對方要先加好友才計得了分、上得了排行榜。
  // basic ID 若有換,改這一行即可。
  OA_ADD_FRIEND_URL: 'https://line.me/R/ti/p/@206pvmlu',
  SHARE_TITLE: '快來挑戰！快樂挑戰！',
  SHARE_SUBTITLE: '一起創造513的輝煌！',
  MOCK: new URLSearchParams(location.search).has('mock'),
};
