// 十神修行錄 — 內容資料
// 能量序:0 群(自我) 1 創(表達) 2 得(資源) 3 律(控制) 4 安(確定);生 = (e+1)%5,剋 = (e+2)%5

export const SG_ENERGIES = [
  { sg_name: "群", sg_full: "群之力", sg_desc: "自我價值與同類連結" },
  { sg_name: "創", sg_full: "創之力", sg_desc: "才華表達與作品" },
  { sg_name: "得", sg_full: "得之力", sg_desc: "資源累積與機會" },
  { sg_name: "律", sg_full: "律之力", sg_desc: "規則與掌控" },
  { sg_name: "安", sg_full: "安之力", sg_desc: "確定感與護城河" },
];

// sg_inner: true = 內(調節自己);false = 外(作用環境)
export const SG_GODS = {
  bi_jian: {
    sg_name: "同好", sg_trad: "比肩", sg_energy: 0, sg_inner: true,
    sg_desc: "找到與你想法一致的人,從認同中長出自我價值。",
    sg_high: "容易只跟想法相同的人在一起,為了「合群」把資源分出去。",
    sg_low: "缺少能理解你的同類,做事容易孤軍奮戰。",
  },
  jie_cai: {
    sg_name: "同盟", sg_trad: "劫財", sg_energy: 0, sg_inner: false,
    sg_desc: "與條件相近、想法不同的人結成人脈,也彼此競爭。",
    sg_high: "容易在比較與競爭中衝動投入,資源被人情與面子帶走。",
    sg_low: "同儕人脈薄弱,少了能互相拉一把的人。",
  },
  shi_shen: {
    sg_name: "匠心", sg_trad: "食神", sg_energy: 1, sg_inner: true,
    sg_desc: "為了自己滿意而創作,享受過程本身。",
    sg_high: "沉浸在自己的世界,作品很美卻沒有被看見。",
    sg_low: "很少為了自己而做一件事,缺乏享受與沉浸。",
  },
  shang_guan: {
    sg_name: "鋒芒", sg_trad: "傷官", sg_energy: 1, sg_inner: false,
    sg_desc: "讓才華被看見,用表達贏得他人的注意。",
    sg_high: "表達太快太利,容易挑戰規則、得罪人,想法發散難收。",
    sg_low: "有想法卻不說,才華沒有出口。",
  },
  zheng_cai: {
    sg_name: "積累", sg_trad: "正財", sg_energy: 2, sg_inner: true,
    sg_desc: "管好自己的資源,一步一步穩定累積。",
    sg_high: "過度追求穩定與數字,壓縮了學習與探索的空間。",
    sg_low: "資源來了也留不住,缺少記帳與預算。",
  },
  pian_cai: {
    sg_name: "獵機", sg_trad: "偏財", sg_energy: 2, sg_inner: false,
    sg_desc: "觀察環境、整合資源,抓住別人沒看到的機會。",
    sg_high: "機會太多、押注太大,容易一次過度自信。",
    sg_low: "對機會不敏感,看不到身邊可整合的資源。",
  },
  zheng_guan: {
    sg_name: "自律", sg_trad: "正官", sg_energy: 3, sg_inner: true,
    sg_desc: "要求自己守規、按步調前進。",
    sg_high: "規則太緊,壓抑了自己和同伴的自由。",
    sg_low: "缺少穩定的節奏,答應的事容易做不到。",
  },
  qi_sha: {
    sg_name: "掌局", sg_trad: "七殺", sg_energy: 3, sg_inner: false,
    sg_desc: "掌握局面,讓身邊的人事物朝目標前進。",
    sg_high: "控制欲強、壓力大,容易把人逼太緊。",
    sg_low: "遇到需要拍板的場合會退縮。",
  },
  zheng_yin: {
    sg_name: "學識", sg_trad: "正印", sg_energy: 4, sg_inner: true,
    sg_desc: "用知識與理論理解世界,獲得確定感。",
    sg_high: "想得太多、做得太少,用研究逃避出手。",
    sg_low: "缺乏系統化的知識當後盾,遇事容易慌。",
  },
  pian_yin: {
    sg_name: "閱歷", sg_trad: "偏印", sg_energy: 4, sg_inner: false,
    sg_desc: "用經驗與直覺(也包括玄學)理解環境。",
    sg_high: "太相信既有經驗,容易固著,也會否定新點子。",
    sg_low: "缺少能依靠的經驗與直覺,面對未知沒有安全感。",
  },
};

// 戒律:針對過高的那格。sg_restrain = 用剋它的能量(群剋得、得剋安、安剋創、創剋律、律剋群);sg_drain = 用它所生的能量引流
export const SG_PRECEPTS = {
  bi_jian: { sg_restrain: "今天任何「大家都這樣做」的決定,先寫下一條自己的規則再答應。", sg_drain: "把今天與同好聊到的一個想法,做成一則貼文或一張圖。" },
  jie_cai: { sg_restrain: "今天不為面子花錢:任何請客、跟團、加購,先等 24 小時。", sg_drain: "把比較心轉成作品:做一件能讓同儕看見你實力的小東西。" },
  shi_shen: { sg_restrain: "動手前先寫下三條完成標準,達標就停手,不再多磨。", sg_drain: "把今天的作品標一個價格或寫一段介紹,讓它能被交換。" },
  shang_guan: { sg_restrain: "今天每次公開發言前,先寫三點架構,最多講三分鐘。", sg_drain: "把今天想吐槽的一件事,改寫成一個可以收費的解法。" },
  zheng_cai: { sg_restrain: "今天請一位朋友喝杯咖啡,或分享一份資源,不計回報。", sg_drain: "把省下來的一筆錢,轉成一次可以累積信用的承諾(例如準時交件)。" },
  pian_cai: { sg_restrain: "今天任何新機會先找一位同好聊過再決定,不當場答應。", sg_drain: "今天找到的一個機會,寫成一頁有期限、有負責人的計畫。" },
  zheng_guan: { sg_restrain: "今天刻意打破一條自己的小規矩(換一條路、換一種做法)。", sg_drain: "把一條你很在意的規則寫成說明,讓別人也能學會。" },
  qi_sha: { sg_restrain: "今天交辦事情時只講目標、不講做法,讓對方自己決定怎麼做。", sg_drain: "把今天的壓力寫成一頁「我學到什麼」的筆記。" },
  zheng_yin: { sg_restrain: "今天學到的東西,24 小時內一定要用一次,沒用到就不再讀新的。", sg_drain: "今天讀到的一個觀點,分享給一個人並聽他的看法。" },
  pian_yin: { sg_restrain: "今天憑經驗做的決定,先找一個數字或資料驗證。", sg_drain: "把一段你的經驗寫成一則故事,說給一位新朋友聽。" },
};

// 約束(7 天):針對過低的那格,從「生它」的能量出發
export const SG_BONDS = {
  bi_jian: "7 天內,每天讀或聽一則和你想法相近的內容,並留言一次(安生群)。",
  jie_cai: "7 天內,主動聯絡 3 位同領域、但想法不同的人,各聊 10 分鐘(安生群)。",
  shi_shen: "7 天內,每天花 15 分鐘只為自己做一件喜歡的事,不給別人看(群生創)。",
  shang_guan: "7 天內,在社群公開分享 3 次你的觀點,不刪文(群生創)。",
  zheng_cai: "7 天內,每天記帳,並把一項技能的成果記下來(創生得)。",
  pian_cai: "7 天內,每天記下一個身邊沒被滿足的需求,第 7 天挑一個試著提案(創生得)。",
  zheng_guan: "7 天內,每天固定時間做同一件小事,打卡不中斷(得生律)。",
  qi_sha: "7 天內,為一件事當一次主導者:訂目標、分工、追進度(得生律)。",
  zheng_yin: "7 天內,選一本書或一門課,每天 20 分鐘並寫三行筆記(律生安)。",
  pian_yin: "7 天內,每天寫一則「今天發生什麼、我學到什麼」的經驗日記(律生安)。",
};

export const SG_OATH_EXAMPLES = [
  "30 天內完成我的作品集網站並上線",
  "30 天內存下第一筆 3 萬元",
  "30 天內每週發 3 篇內容,累積 300 位追蹤",
  "30 天內讀完 2 本專業書並寫成講義",
];

// 自評:每格 1 題(MVP),1–5 分
export const SG_ASSESS = [
  ["bi_jian", "我身邊有一群和我想法相近、能互相理解的人。"],
  ["jie_cai", "我和同領域、條件相近的人保持往來,即使想法不同。"],
  ["shi_shen", "我常為了自己滿意而做一件事,沉浸其中。"],
  ["shang_guan", "我會主動公開表達想法,希望被看見。"],
  ["zheng_cai", "我有固定記帳、預算或儲蓄的習慣。"],
  ["pian_cai", "我常察覺別人沒注意到的機會,並且採取行動。"],
  ["zheng_guan", "我能照著自己訂的規則與節奏做事。"],
  ["qi_sha", "需要時,我能掌握局面、推動別人完成目標。"],
  ["zheng_yin", "遇到問題時,我會先找知識或理論來理解它。"],
  ["pian_yin", "我的經驗與直覺,讓我對未來有安全感。"],
];

export const SG_REALMS = [
  { sg_min: 0, sg_name: "初心" }, { sg_min: 3, sg_name: "入門" }, { sg_min: 10, sg_name: "精進" },
  { sg_min: 21, sg_name: "通達" }, { sg_min: 45, sg_name: "大成" },
];

export const SG_INK_WORDS = [
  "墨要磨,心要定。", "一筆不成,再落一筆。", "留白,也是一種力量。",
  "能量不是越多越好,是流得過去才好。", "今日守住一條戒,明日多一分自由。",
  "誓言寫下的那刻,你已經不是昨天的你。", "剋,不是壓制,是讓力量有形狀。",
  "生,是把今天的你,交給明天的你。", "慢慢來,比較快。", "筆鋒藏得住,才放得出。",
];
