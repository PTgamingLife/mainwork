// IG Planner — 預設內容:Day 1 完整腳本 + 30 天主題草稿
// igp_ 開頭的欄位名跟 Supabase igp_episodes 表一致

const IGP_START_DATE = '2026-10-25';

// 從 IG 內容工廠借來的 6 種寫法公式
const IGP_STYLES = [
  { id: 'story', name: '故事型', formula: '我曾經{痛點},直到我改了一件事' },
  { id: 'action', name: '行動指南', formula: 'N 個步驟讓你達到{成果}' },
  { id: 'contrarian', name: '反向思考', formula: '停止做{常見建議},它正在害你' },
  { id: 'data', name: '數據分析', formula: '90% 的人不知道的{指標}' },
  { id: 'list', name: '清單收藏', formula: '每個{族群}必備的 N 個{資源}' },
  { id: 'motivation', name: '動機激勵', formula: '你不缺{資源},你缺的是{觀念}' },
];

const IGP_TYPES = {
  story: { name: '複盤故事', emoji: '📼' },
  tool: { name: 'AI 工具展示', emoji: '🤖' },
  life: { name: 'AI 生活應用', emoji: '🏠' },
};

const IGP_STATUSES = {
  idea: '構想', script: '腳本完成', shot: '已拍', edited: '已剪', posted: '已發佈',
};

const IGP_SIGNALS = ['留言', '收藏', '分享', '追蹤', '完播'];

// 每集新建時的拍攝注意事項範本
const IGP_SHOOT_TEMPLATE = [
  '直式 9:16,臉在上方 1/3,下方留字幕安全區',
  '收音:領夾麥,關冷氣/風扇',
  '燈光:面光充足,背景比臉暗一階',
  '開場 3 秒內講完 Hook,不要先打招呼',
  '同一套開場姿勢與位置(建立系列感)',
  '結尾留 1 秒停頓,方便剪輯與循環播放',
];

const IGP_DAY1_SCRIPT = `你有沒有想過，40 歲左右的你會是什麼樣子？

是野原廣志、兩津勘吉、彭于晏,孔劉，還是安海瑟薇、宋慧喬、野原美冴、花媽？
我覺得我可能是，有安海瑟薇的慣老闆、花媽的煩惱、兩津勘吉的存款、孔劉的社交圈，最後加上野原廣志的身體？ life\`s a struggle!感覺依舊是不斷掙扎的人生

但還好還有美麗的老婆，加上兩個跟小新一樣皮的小孩增加了不少樂趣

我在 10 歲的時候看過一次人生跑馬燈。
那時候為了模仿動漫裡面的「翹孤輪」，結果摔到馬路上，差點被後面的車撞上。最後前輪停在我的左手上，大燈離我的後腦勺不到 10 公分，所以我手上現在都還有一個機車煞車的疤痕。

在當下就看到了一個超級短的十年人生跑馬燈。

在滿 40 歲的時候，認真思考一件事情
下一個人生跑馬燈會是什麼樣子？

正如阿德勒所說：「重新定義你的過去，就能改變你的未來。」
我想進行一個對自己的挑戰：接下來每一天重新覆盤過去的 40 年，重新定義自己的過去，看看接下來的一個月、三個月、一年，人生依舊充滿挑戰,但可以像遊戲一樣,同時充滿樂趣!!`;

const IGP_DAY1_SHORT = `40 歲的你，會是什麼樣子？
我大概是：安海瑟薇的慣老闆、花媽的煩惱、兩津的存款、孔劉的社交圈，加上野原廣志的身體。
Life's a struggle！
還好，有美麗的老婆，和兩個跟小新一樣皮的小孩。
10 歲那年，我學動漫翹孤輪，摔在馬路上。後車前輪停在我左手上，大燈離後腦勺不到 10 公分。
那一刻，我看到十年的人生跑馬燈。
40 歲了，我想知道：下一次跑馬燈，會播什麼？
阿德勒說：「重新定義過去，就能改變未來。」
從今天起，我每天複盤過去 40 年。人生還是很難，但可以像遊戲一樣好玩。`;

const IGP_DAY1 = {
  igp_title: '復盤40年的一個珍貴心得',
  igp_type: 'story',
  igp_style: 'story',
  igp_status: 'script',
  igp_signal: '留言',
  igp_hook: '你有沒有想過，40 歲左右的你會是什麼樣子？',
  igp_script: IGP_DAY1_SCRIPT,
  igp_script_short: IGP_DAY1_SHORT,
  igp_segments: [
    { label: 'Hook 0–4s', text: '40 歲的你，會是什麼樣子?(直視鏡頭,停半拍)' },
    { label: '自嘲共鳴 4–18s', text: '角色混搭:慣老闆、花媽的煩惱、兩津的存款、孔劉的社交圈、野原廣志的身體 → Life\'s a struggle' },
    { label: '溫度轉折 18–23s', text: '還好有老婆和兩個跟小新一樣皮的小孩' },
    { label: '故事 23–40s', text: '10 歲翹孤輪摔車,前輪壓在左手,大燈離後腦勺 10 公分 → 第一次人生跑馬燈(秀疤痕)' },
    { label: '金句 40–52s', text: '40 歲:下一次跑馬燈會播什麼?阿德勒:重新定義過去,就能改變未來' },
    { label: 'CTA 52–60s', text: '每天複盤 40 年,像遊戲一樣闖關 → 留言:40 歲的你像誰?' },
  ],
  igp_shoot: [
    { text: '第一集定調:固定開場位置、服裝、手勢,之後每集沿用', done: false },
    { text: '左手疤痕特寫:自然光、微距,停 2 秒', done: false },
    { text: '角色名唸慢、唸清楚,字幕同步打出角色名', done: false },
    { text: '不放動漫/明星原圖(版權),改用 AI 剪影或文字卡', done: false },
    { text: '「Life\'s a struggle」換語氣,做一個誇張表情當笑點', done: false },
    { text: '直式 9:16、領夾麥、臉在上方 1/3', done: false },
  ],
  igp_broll: [
    { text: 'AI 生成:40 歲大叔「角色拼貼」卡片快閃(剪影+名字,不用原圖)', done: false },
    { text: 'AI 動畫:10 歲小孩騎腳踏車翹孤輪、慢動作摔車', done: false },
    { text: '人生跑馬燈:老照片快速翻頁 + 底片雜訊特效', done: false },
    { text: '實拍:左手疤痕特寫', done: false },
    { text: '家庭溫度:老婆與小孩背影/手部(不露臉)', done: false },
    { text: '遊戲 HUD 字卡:「DAY 1 / 365 — 人生複盤模式 START」', done: false },
  ],
  igp_caption: `10 歲那年，我看過一次人生跑馬燈。
40 歲這年，我想知道下一次會播什麼。

從今天開始，每天複盤過去 40 年的一件事。
人生還是很難，但我想把它玩成一場遊戲。

👇 留言告訴我：40 歲的你，最像哪個角色？`,
  igp_hashtags: '#40歲 #大叔 #人生複盤 #阿德勒 #專注 #人生跑馬燈 #AI生活 #日更挑戰',
  igp_cta: ['留言:40 歲的你最像誰?', '追蹤,看我每天複盤 40 年', '分享給也快 40 的朋友'],
};

// Day 2–30 草稿:只有標題、Hook、類型、寫法,逐字稿留空
const IGP_DRAFTS = [
  ['story', 'story', '第一份工作教我的事', '我人生第一份工作，教會我一件到現在還在用的事。'],
  ['tool', 'action', '用 AI 幫自己畫人生年表', '40 年的人生，AI 幫我排成一張圖，我看到一個沒發現的規律。'],
  ['life', 'action', '大叔的 AI 早晨 routine', '我還沒刷牙，AI 已經幫我把今天排好了。'],
  ['story', 'story', '那次差點放棄的事', '有一件事，我差一點就放棄了。'],
  ['tool', 'data', 'LINE 自動回覆幫小店省時間', '小店老闆每天回最多的訊息，其實都是同一句。'],
  ['life', 'story', '跟小孩一起用 AI 說故事', '我家小孩問 AI：爸爸小時候是怎樣的人？'],
  ['story', 'list', '第一週複盤:我發現的 3 個模式', '複盤 7 天，我發現自己一直在重複同一件事。'],
  ['story', 'motivation', '20 歲的我最需要聽到的一句話', '如果能回到 20 歲，我只想跟自己說一句話。'],
  ['tool', 'action', '用 AI 把日記變成複盤報告', '寫日記沒用？是因為你從來沒有回頭看。'],
  ['life', 'data', '40 歲的身體:AI 幫我看健檢報告', '健檢報告上那些紅字，我終於看懂了。'],
  ['story', 'story', '我跟老婆的第一次吵架', '我們第一次吵架，是為了一件很小的事。'],
  ['tool', 'list', '微型創業者最常問我的 AI 問題', '教 AI 這幾年，老闆們最常問我的是這 3 個問題。'],
  ['life', 'action', '用 AI 規劃一家四口的週末', '帶兩個小新出門，行程我交給 AI 排。'],
  ['story', 'motivation', '第二週複盤:專注是什麼感覺', '連續 14 天做同一件事，我終於知道專注是什麼感覺。'],
  ['story', 'story', '小時候的夢想現在還在嗎', '10 歲的我，夢想是什麼？我差點忘了。'],
  ['tool', 'story', 'LINE 預約:一家小店的一天', '一家小店的老闆，一天要接幾通預約電話？'],
  ['life', 'contrarian', '雙 11 不亂買:AI 幫我記帳複盤', '雙 11 別急著買，先讓 AI 看看你去年買了什麼。'],
  ['story', 'story', '失敗最多的那一年', '那一年，我做什麼都失敗。'],
  ['tool', 'action', '我怎麼用 AI 做這支影片的 B-roll', '這支影片裡的畫面，一半是 AI 做的。'],
  ['life', 'contrarian', '大叔學新東西的方法', '40 歲學新東西，別再從頭學起。'],
  ['story', 'list', '第三週複盤:有趣的事藏在哪裡', '21 天複盤，我找到 3 件以前沒發現的有趣小事。'],
  ['story', 'story', '爸爸教我的一件事', '我爸從來沒說過，但他用行動教會我一件事。'],
  ['tool', 'contrarian', 'AI 客服不是取代人,是幫你記住客人', 'AI 客服最大的價值，不是省人力。'],
  ['life', 'story', '給 10 歲的自己一封信(AI 朗讀)', '我請 AI 用 10 歲的聲音，念我寫給自己的信。'],
  ['story', 'story', '人生的一次大轉彎', '那一次轉彎，改變了我後面十年。'],
  ['tool', 'list', '一個人經營小店,AI 能幫你的 5 件事', '一個人顧店，這 5 件事可以交給 AI。'],
  ['life', 'action', '專注 25 分鐘挑戰', '我挑戰手機放旁邊，專注 25 分鐘，結果……'],
  ['story', 'motivation', '第四週複盤:重新定義過去', '28 天後，我重新定義了一段過去。'],
  ['story', 'story', 'Day 30:下一個人生跑馬燈', '30 天前我問：下一次跑馬燈會播什麼？今天我有答案了。'],
];

function igpAddDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return igpIso(d);
}

function igpIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function igpDayNumber(iso) {
  const ms = new Date(iso + 'T00:00:00') - new Date(IGP_START_DATE + 'T00:00:00');
  const n = Math.round(ms / 86400000) + 1;
  return n >= 1 ? n : null;
}

function igpBlankEpisode(iso) {
  return {
    igp_date: iso,
    igp_day: igpDayNumber(iso),
    igp_title: '',
    igp_type: 'story',
    igp_style: 'story',
    igp_status: 'idea',
    igp_signal: '留言',
    igp_hook: '',
    igp_script: '',
    igp_script_short: '',
    igp_segments: [
      { label: 'Hook 0–3s', text: '' },
      { label: '內容 3–45s', text: '' },
      { label: '金句 45–55s', text: '' },
      { label: 'CTA 55–60s', text: '' },
    ],
    igp_shoot: IGP_SHOOT_TEMPLATE.map(text => ({ text, done: false })),
    igp_broll: [],
    igp_caption: '',
    igp_hashtags: '#40歲 #大叔 #人生複盤 #專注',
    igp_cta: [],
  };
}

function igpBuildSeed() {
  const day1 = { ...igpBlankEpisode(IGP_START_DATE), ...IGP_DAY1 };
  const rest = IGP_DRAFTS.map(([type, style, title, hook], i) => ({
    ...igpBlankEpisode(igpAddDays(IGP_START_DATE, i + 1)),
    igp_type: type, igp_style: style, igp_title: title, igp_hook: hook,
  }));
  return [day1, ...rest];
}
