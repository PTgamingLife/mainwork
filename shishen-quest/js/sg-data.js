// 十神修行錄 — 內容資料(介面不顯示八字十神術語,只用遊戲名)
// 能量序:0 創造力 1 生產力 2 制約力 3 解析力 4 群眾力
// 生 = (e+1)%5:創造→生產→制約→解析→群眾→創造
// 剋 = (e+2)%5:創造剋制約、生產剋解析、制約剋群眾、解析剋創造、群眾剋生產

export const SG_ENERGIES = [
  {
    sg_name: "創造力", sg_short: "創", sg_desc: "把想法變成作品、讓才華被看見",
    sg_best: "作品與觀點被看見,用新解法打開局面", sg_worst: "想法四散、說話太利,為了標新立異而挑戰規則",
    sg_high: { sg_text: "越覺得自己有創意又稀有,越容易產生特權感、繞過規則。", sg_cite: "Vincent & Kouchaki (2016), Academy of Management Journal, 59(4), 1451–1473" },
    sg_high2: { sg_text: "原創思考傾向與「替自己找理由違規」有關(作者另有撤稿論文,僅供參考)。", sg_cite: "Gino & Ariely (2012), JPSP, 102(3), 445–459" },
    sg_low: { sg_text: "不相信自己能有創意(創意自我效能低),創意表現也跟著下降。", sg_cite: "Tierney & Farmer (2002), Academy of Management Journal, 45(6), 1137–1148" },
    sg_low2: { sg_text: "自我價值感低的人在社群自我揭露偏負面,得到的回饋也較差,更不敢表達。", sg_cite: "Forest & Wood (2012), Psychological Science, 23(3), 295–302" },
  },
  {
    sg_name: "生產力", sg_short: "產", sg_desc: "把才華轉成資源,穩定累積與抓住機會",
    sg_best: "有計畫地把能力變現,資源穩定成長", sg_worst: "只看數字與 KPI,壓縮學習與探索,變得短視",
    sg_high: { sg_text: "績效條件式的外在獎勵,會削弱做事的內在動機。", sg_cite: "Deci, Koestner & Ryan (1999), Psychological Bulletin, 125(6), 627–668" },
    sg_high2: { sg_text: "目標訂得太死,會窄化注意力、抑制學習、提高冒險與不道德行為。", sg_cite: "Ordóñez et al. (2009), Academy of Management Perspectives, 23(1), 6–16" },
    sg_low: { sg_text: "資源匱乏會造成「隧道視野」,只顧眼前、做出更差的長期決定。", sg_cite: "Shah, Mullainathan & Shafir (2012), Science, 338, 682–685" },
    sg_low2: { sg_text: "財務擔憂會佔用認知資源,讓判斷力明顯下降。", sg_cite: "Mani et al. (2013), Science, 341, 976–980" },
  },
  {
    sg_name: "制約力", sg_short: "制", sg_desc: "訂規則、守節奏、掌握局面",
    sg_best: "自律又能掌局,讓人與事照計畫前進", sg_worst: "控制欲過強,把人逼太緊,高估自己能掌握的範圍",
    sg_high: { sg_text: "權力感會帶來「控制錯覺」:以為能掌握其實控制不了的結果,過度樂觀。", sg_cite: "Fast et al. (2009), Psychological Science" },
    sg_high2: { sg_text: "規範越緊的文化,越少產出跨界的創意成果。", sg_cite: "Chua, Roth & Lemoine (2015), Administrative Science Quarterly, 60(2), 189–227" },
    sg_low: { sg_text: "掌控感低的人,健康、生活滿意度都較差,受限感較高。", sg_cite: "Lachman & Weaver (1998), JPSP, 74, 763–773" },
    sg_low2: { sg_text: "個人掌控感不足時,人會轉而依賴外部權威或信念來補償。", sg_cite: "Kay et al. (2008), JPSP, 95(1), 18–35" },
  },
  {
    sg_name: "解析力", sg_short: "析", sg_desc: "用知識與經驗理解世界,建立確定感",
    sg_best: "看懂底層原理,讓判斷穩、方向清楚", sg_worst: "想太多做太少,急著找答案後就凍結,排斥新點子",
    sg_high: { sg_text: "「想要確定答案」的需求太強,會抓住第一個答案後就凍結,不再考慮其他可能。", sg_cite: "Kruglanski & Webster (1996), Psychological Review, 103(2), 263–283" },
    sg_high2: { sg_text: "人在追求確定性時,會下意識排斥有創意的點子。", sg_cite: "Mueller, Melwani & Goncalo (2012), Psychological Science" },
    sg_low: { sg_text: "自我不確定感高時,人更傾向認同封閉、緊密的群體。", sg_cite: "Hogg et al. (2007), Journal of Experimental Social Psychology, 43(1), 135–142" },
    sg_low2: { sg_text: "缺乏安全基地,人較不願意探索新的環境、知識與人際。", sg_cite: "Green & Campbell (2000), Personality and Social Psychology Bulletin, 26(4)" },
  },
  {
    sg_name: "群眾力", sg_short: "群", sg_desc: "從同類與人脈中長出自我價值",
    sg_best: "身邊有同好與同盟,一起把事情做大", sg_worst: "為了合群而分出資源、跟著共識走,失去自己的判斷",
    sg_high: { sg_text: "面對親友分享壓力,人甚至願意付出成本隱藏收入 —— 群體會分走個人資源。", sg_cite: "Jakiela & Ozier (2016), Review of Economic Studies, 83(1), 231–268" },
    sg_high2: { sg_text: "團體只重視共識時,決策品質變差;有批判規範的團體才能避免團體迷思。", sg_cite: "Postmes, Spears & Cihangir (2001), JPSP, 80(6), 918–930" },
    sg_low: { sg_text: "歸屬需求是基本需求;長期缺乏歸屬會損害情緒、認知與健康。", sg_cite: "Baumeister & Leary (1995), Psychological Bulletin, 117(3), 497–529" },
    sg_low2: { sg_text: "自尊是「被群體接納程度」的量表:被接納感低,自我價值就跟著低。", sg_cite: "Leary & Baumeister (2000), Advances in Experimental Social Psychology, 32, 1–62" },
  },
];

// 十格(遊戲名;sg_energy 對應上面的五能量)
export const SG_GODS = {
  shi_shen: { sg_name: "匠心", sg_energy: 0, sg_desc: "為自己滿意而創作" },
  shang_guan: { sg_name: "鋒芒", sg_energy: 0, sg_desc: "讓才華被看見" },
  zheng_cai: { sg_name: "積累", sg_energy: 1, sg_desc: "穩定累積資源" },
  pian_cai: { sg_name: "獵機", sg_energy: 1, sg_desc: "整合環境、捕捉機會" },
  zheng_guan: { sg_name: "自律", sg_energy: 2, sg_desc: "要求自己守規" },
  qi_sha: { sg_name: "掌局", sg_energy: 2, sg_desc: "掌控局面與他人" },
  zheng_yin: { sg_name: "學識", sg_energy: 3, sg_desc: "知識與理論的確定感" },
  pian_yin: { sg_name: "閱歷", sg_energy: 3, sg_desc: "經驗與直覺的確定感" },
  bi_jian: { sg_name: "同好", sg_energy: 4, sg_desc: "理念相同的同類" },
  jie_cai: { sg_name: "同盟", sg_energy: 4, sg_desc: "條件相近的人脈" },
};

// 戒律 = 「最旺的能量用過頭的情境」+「最弱能量的做法」(由弱制旺),自動組出三個選項
export const SG_OVERUSE_SCENE = [
  "每次想到新點子、急著發表之前",
  "看到賺錢機會、想立刻投入之前",
  "想要求別人照你的方式做之前",
  "開始查資料、想再研究久一點之前",
  "答應邀約、或想把資源分給別人之前",
];
export const SG_WEAK_METHODS = [
  ["先做出一個 10 分鐘的小作品再決定", "換一個完全不同的做法試一次", "把它畫成一張圖或寫成一段故事"],
  ["先算出這件事的時間與金錢成本", "訂一個可以量化的成果再開始", "問自己:這能換到什麼具體資源?"],
  ["先訂好截止時間與停損點", "寫下三條你今天不會打破的規則", "照表操課,不臨時加碼"],
  ["先寫下三個理由與一個反例", "花 15 分鐘查證一個關鍵事實", "把想法整理成一張架構圖"],
  ["先找一位信任的人聊 5 分鐘", "問一個想法不同的人怎麼看", "邀一個人一起做,而不是自己扛"],
];

// 約束(7 天):補最弱的能量,從「生它」的能量出發
export const SG_BONDS = [
  "7 天內,每天花 15 分鐘只為自己做一件喜歡的創作,不給別人看。",
  "7 天內,每天記帳,並記下一個身邊沒被滿足的需求。",
  "7 天內,每天固定時間做同一件小事,打卡不中斷。",
  "7 天內,選一本書或一門課,每天 20 分鐘並寫三行筆記。",
  "7 天內,主動聯絡 3 位同領域的人,各聊 10 分鐘。",
];

// 誓言目標類型 → 目標能量
export const SG_OATH_TYPES = [
  { sg_energy: 0, sg_label: "創作", sg_example: "30 天內完成並發表我的作品集" },
  { sg_energy: 1, sg_label: "賺錢", sg_example: "30 天內存下 3 萬元 / 成交第一位客戶" },
  { sg_energy: 2, sg_label: "紀律", sg_example: "30 天每天 6 點起床、運動 20 分鐘" },
  { sg_energy: 3, sg_label: "學習", sg_example: "30 天內讀完 2 本專業書並寫成講義" },
  { sg_energy: 4, sg_label: "人脈", sg_example: "30 天內認識 10 位同領域的人" },
];

// 守護天使:依「天使最強的能量」決定原型
export const SG_ANGELS = [
  { sg_name: "墨蝶", sg_trait: "靈動、愛玩、鼓勵你換個方式試試", sg_lines: ["今天換個玩法吧,我陪你!", "做到一半也很美,再一筆就完成。", "你看,做出來就是你的了。"] },
  { sg_name: "金蟾", sg_trait: "務實、精打細算、幫你看清投入與回報", sg_lines: ["先算一下,今天最划算的一步是什麼?", "完成一半,已經回本一半了。", "收穫入帳!這筆是你自己賺的。"] },
  { sg_name: "玄鶴", sg_trait: "沉穩、守時、提醒你守住自己訂的規則", sg_lines: ["時辰到了,照約定開始吧。", "還差一步,守住節奏。", "言出必行,今日圓滿。"] },
  { sg_name: "青鸞", sg_trait: "安靜、睿智、帶你看清事情的脈絡", sg_lines: ["先想清楚為什麼,再動手。", "你已經看懂一半了,再往下拆一層。", "你今天更懂自己一點了。"] },
  { sg_name: "梅鹿", sg_trait: "溫暖、陪伴、讓你知道你不是一個人", sg_lines: ["我在這裡,我們一起開始。", "累了就歇一下,我等你。", "你做到了,我替你開心!"] },
];

// 每週問卷(1–5 分)
export const SG_WEEKLY_QUESTIONS = [
  "這週我有把「創造力」用在對的地方",
  "這週我有把「生產力」用在對的地方",
  "這週我有把「制約力」用在對的地方",
  "這週我有把「解析力」用在對的地方",
  "這週我有把「群眾力」用在對的地方",
  "我有守住戒律",
  "我有完成約束",
  "我的誓言有明顯推進",
  "守護天使的提醒對我有幫助",
  "整體而言,我對這週的自己滿意",
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
