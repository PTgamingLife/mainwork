/* ========== 題目與 IP 原型資料 ==========
 * weights: 每個選項對 8 種 IP 原型的加分
 * tags:    記錄使用者屬性，用於個人化結果文案
 */

const QUESTIONS = [
  {
    id: "q1",
    title: "朋友平常最常找你問什麼？",
    subtitle: "別人主動來問你的事，往往就是你的價值所在。",
    options: [
      { emo: "🧠", label: "專業或技術問題", desc: "工作技能、工具怎麼用、怎麼解決問題", weights: { edu: 3, make: 2, curate: 1 } },
      { emo: "🍜", label: "吃喝玩樂與品味", desc: "去哪吃、去哪玩、怎麼買、怎麼搭", weights: { life: 3, fun: 1, story: 1 } },
      { emo: "💬", label: "心事與人生選擇", desc: "感情、職涯、迷惘的時候會想找你聊", weights: { heal: 3, story: 2 } },
      { emo: "📰", label: "最新話題與資訊", desc: "新聞、趨勢、八卦，你消息總是很靈通", weights: { voice: 2, curate: 2, fun: 1 } },
    ],
  },
  {
    id: "q2",
    title: "哪個領域你可以聊 30 分鐘都不無聊？",
    subtitle: "不用是專家，「有熱情聊不停」就夠了。",
    options: [
      { emo: "💼", label: "職場與專業技能", weights: { edu: 1 }, tags: { domain: "職場技能" } },
      { emo: "💰", label: "理財與投資", weights: { edu: 1, curate: 1 }, tags: { domain: "理財" } },
      { emo: "💪", label: "健康與運動", weights: { make: 1 }, tags: { domain: "健身" } },
      { emo: "🌏", label: "美食・旅遊・生活風格", weights: { life: 2 }, tags: { domain: "生活風格" } },
      { emo: "📱", label: "科技・3C・AI 工具", weights: { curate: 1, edu: 1 }, tags: { domain: "科技工具" } },
      { emo: "🧘", label: "心理與自我成長", weights: { heal: 2 }, tags: { domain: "自我成長" } },
      { emo: "🎨", label: "藝術與創作", weights: { make: 1, fun: 1 }, tags: { domain: "創作" } },
      { emo: "✏️", label: "其他（自己輸入）", custom: true, weights: {} },
    ],
  },
  {
    id: "q3",
    title: "哪種表達方式讓你最自在？",
    subtitle: "選「做起來不痛苦」的，才能撐得久。",
    options: [
      { emo: "🎥", label: "對著鏡頭說話", desc: "口條還行，講話比打字快", weights: { fun: 2, story: 1, voice: 1 }, tags: { format: "video" } },
      { emo: "✍️", label: "用文字書寫", desc: "喜歡慢慢想、慢慢寫", weights: { voice: 2, story: 2 }, tags: { format: "text" } },
      { emo: "📊", label: "做圖卡或簡報整理", desc: "擅長把資訊排得清楚好懂", weights: { curate: 3, edu: 1 }, tags: { format: "carousel" } },
      { emo: "🙌", label: "動手做，拍過程", desc: "用作品和過程說話，不太想講話", weights: { make: 3 }, tags: { format: "process" } },
    ],
  },
  {
    id: "q4",
    title: "朋友眼中的你，比較接近哪一種？",
    subtitle: "你的性格，就是 IP 最難被模仿的部分。",
    options: [
      { emo: "😆", label: "幽默有梗", desc: "聚會的開心果，講話很好笑", weights: { fun: 3 } },
      { emo: "🤝", label: "可靠專業", desc: "講話有條理，大家覺得你懂很多", weights: { edu: 2, curate: 1 } },
      { emo: "🫂", label: "溫暖會傾聽", desc: "情緒穩定，讓人想跟你說心事", weights: { heal: 3 } },
      { emo: "🔥", label: "有想法敢說", desc: "有自己的立場，不怕跟人不一樣", weights: { voice: 3 } },
    ],
  },
  {
    id: "q5",
    title: "你希望看你內容的人，得到什麼？",
    subtitle: "這決定了你內容的核心價值。",
    options: [
      { emo: "📚", label: "學到實用的東西", desc: "看完覺得「賺到了」", weights: { edu: 2, make: 2, curate: 1 } },
      { emo: "☁️", label: "被療癒、被放鬆", desc: "看完覺得「被接住了」", weights: { heal: 2, life: 2 } },
      { emo: "🤣", label: "開心大笑", desc: "看完覺得「太好笑了要分享」", weights: { fun: 3 } },
      { emo: "💡", label: "被啟發、換個角度想", desc: "看完覺得「原來可以這樣想」", weights: { voice: 2, story: 2 } },
    ],
  },
  {
    id: "q6",
    title: "你每週能投入多少時間做內容？",
    subtitle: "誠實評估，定位建議會依此調整節奏。",
    options: [
      { emo: "🌙", label: "3 小時以內", desc: "下班後擠一點時間", weights: {}, tags: { time: "lt3" } },
      { emo: "⏰", label: "3～5 小時", desc: "週末可以排半天", weights: {}, tags: { time: "3to5" } },
      { emo: "📅", label: "5～10 小時", desc: "認真當副業在做", weights: {}, tags: { time: "5to10" } },
      { emo: "🚀", label: "10 小時以上", desc: "打算全力衝刺", weights: {}, tags: { time: "gt10" } },
    ],
  },
  {
    id: "q7",
    title: "你最想吸引什麼樣的人追蹤你？",
    subtitle: "想清楚「說給誰聽」，內容才有方向。",
    options: [
      { emo: "🌱", label: "想入門的新手", desc: "把你會的教給剛起步的人", weights: { edu: 2 }, tags: { audience: "新手" } },
      { emo: "⚔️", label: "同領域的同好", desc: "跟懂的人交流切磋", weights: { make: 1, voice: 1 }, tags: { audience: "同好" } },
      { emo: "🫶", label: "有類似煩惱的人", desc: "陪伴跟你走過一樣路的人", weights: { heal: 2, story: 1 }, tags: { audience: "同路人" } },
      { emo: "🌊", label: "越多人越好", desc: "想做大眾都看得懂的內容", weights: { fun: 1, curate: 1 }, tags: { audience: "大眾" } },
    ],
  },
  {
    id: "q8",
    title: "經營個人 IP，你最想達成什麼？",
    subtitle: "沒有標準答案，誠實選就好。",
    options: [
      { emo: "💵", label: "多一份副業收入", desc: "接案、賣課、業配", weights: { edu: 1, make: 1 }, tags: { goal: "副業收入" } },
      { emo: "📈", label: "累積個人品牌", desc: "讓履歷更亮眼、職涯更有籌碼", weights: { edu: 1, voice: 1 }, tags: { goal: "個人品牌" } },
      { emo: "🌟", label: "發揮影響力", desc: "幫助別人、被更多人認識", weights: { heal: 1, story: 1 }, tags: { goal: "影響力" } },
      { emo: "🎪", label: "好玩、交朋友", desc: "享受創作和連結的過程", weights: { fun: 1, life: 1 }, tags: { goal: "興趣交流" } },
    ],
  },
  {
    id: "q9",
    title: "下面哪件事你做起來最順手？",
    subtitle: "回想一下學生時代或工作中的經驗。",
    options: [
      { emo: "🧩", label: "把複雜的事講簡單", desc: "同學考前都找你劃重點", weights: { edu: 3 } },
      { emo: "🎬", label: "說故事讓人有共鳴", desc: "描述一件事大家都聽得入迷", weights: { story: 3 } },
      { emo: "🔍", label: "蒐集比較資訊", desc: "買東西前會做超完整功課", weights: { curate: 3 } },
      { emo: "🎯", label: "犀利點出問題", desc: "一眼看出盲點，講話一針見血", weights: { voice: 2 } },
    ],
  },
  {
    id: "q10",
    title: "最後一題：你能接受露臉嗎？",
    subtitle: "不露臉也能經營 IP，這題影響平台與形式建議。",
    options: [
      { emo: "😎", label: "完全 OK", desc: "露臉拍片沒問題", weights: { fun: 1, story: 1 }, tags: { face: "yes" } },
      { emo: "🎙", label: "聲音 OK，不想露臉", desc: "可以配音、錄 Podcast", weights: { heal: 1 }, tags: { face: "voice" } },
      { emo: "🕶", label: "臉和聲音都不想出現", desc: "想完全用文字或畫面經營", weights: { curate: 1 }, tags: { face: "no" } },
    ],
  },
];

const ARCHETYPES = {
  edu: {
    emoji: "🎓", name: "知識教學型", en: "The Educator",
    tagline: "「把複雜的事，講到誰都聽得懂」",
    desc: "你適合把自己會的東西，拆解成一步一步的教學內容。這種定位信任感最高，變現路徑也最清楚（課程、諮詢、接案）。",
    topics: (d) => [`${d}新手最常犯的 3 個錯`, `如果重新開始學${d}，我會這樣安排`, `用 3 分鐘搞懂一個${d}核心觀念`],
    firstStep: "列出 10 個「別人常問你」的問題，每個問題做成一則內容，就是你的前 10 篇。",
  },
  story: {
    emoji: "📖", name: "經驗故事型", en: "The Storyteller",
    tagline: "「你的親身經歷，就是別人想看的內容」",
    desc: "你不用當專家，只要真實記錄你正在做的事、走過的路。共鳴感是這個定位最大的武器，「真實」比「厲害」更重要。",
    topics: (d) => [`我開始接觸${d}的第一個月，發生了什麼`, `那件讓我決定改變的事`, `在${d}這條路上，我踩過最痛的坑`],
    firstStep: "寫下你人生的 3 個轉折點，挑最有感覺的一個，做成你的第一篇自我介紹內容。",
  },
  voice: {
    emoji: "🎯", name: "觀點評論型", en: "The Commentator",
    tagline: "「敢說別人不敢說的，立場就是記憶點」",
    desc: "你有想法、敢表達，適合針對熱門話題或行業現象發表觀點。這是漲粉最快的定位之一，但需要能承受不同意見的心臟。",
    topics: (d) => [`關於${d}，一個我不認同的主流做法`, `大家都在吹的東西，我實際看到的真相`, `本週${d}圈大事，我的 3 個看法`],
    firstStep: "找出 3 個你所在領域「大家都這樣說，但你不同意」的觀點，各寫成一篇短文。",
  },
  life: {
    emoji: "✨", name: "生活風格型", en: "The Lifestyle Curator",
    tagline: "「把日常過得有質感，本身就是一種內容」",
    desc: "分享你的生活選物、習慣與品味，讓人想成為你這樣的人。適合有美感、擅長營造氛圍的你，業配合作機會最多元。",
    topics: (d) => [`我的${d}日常 routine`, `最近讓生活變好的 5 個小物或習慣`, `跟我過一天（真實版）`],
    firstStep: "連續 7 天，每天拍一張你覺得「有你風格」的照片，從中找出你的視覺調性。",
  },
  heal: {
    emoji: "🌱", name: "療癒陪伴型", en: "The Companion",
    tagline: "「讓人覺得：有你在，我就不孤單」",
    desc: "你溫暖、會傾聽，適合做情感支持與心靈成長類內容。這是黏著度最高、鐵粉最多的定位，粉絲會真心把你當朋友。",
    topics: (d) => [`寫給正在${d}路上撐著的你`, `今天也辛苦了——一句想對你說的話`, `我如何走過那段低潮`],
    firstStep: "每天寫一句「想對過去的自己說的話」，累積 10 句，就是你的前 10 則內容。",
  },
  fun: {
    emoji: "🎭", name: "娛樂創作型", en: "The Entertainer",
    tagline: "「讓人笑著看完，還想轉發給朋友」",
    desc: "你有梗、有表現慾，適合做娛樂性內容。這是擴散力最強、漲粉最快的定位，演算法最愛的就是你這種人。",
    topics: (d) => [`只有${d}人才懂的 5 個瞬間`, `如果${d}是一個人，他會是什麼樣子`, `挑戰：一週只靠 XX 過活`],
    firstStep: "蒐集 10 支讓你笑出來的同類型影片，分析它們哏的結構，然後模仿拍出第一支。",
  },
  make: {
    emoji: "🛠️", name: "實作示範型", en: "The Maker",
    tagline: "「不用多說，做給你看」",
    desc: "你擅長動手，適合記錄製作過程、實測開箱、Before/After。畫面本身就有說服力，不需要好口才也能經營。",
    topics: (d) => [`從 0 開始完成一件${d}作品的全過程`, `${d}實測：網路上的教學是真的嗎？`, `Before / After：30 天的改變`],
    firstStep: "挑一件你本來就要做的事，把過程完整拍下來，剪成 60 秒的縮時內容。",
  },
  curate: {
    emoji: "🗂️", name: "資訊整理型", en: "The Curator",
    tagline: "「幫大家省時間，就是你的價值」",
    desc: "你擅長蒐集、比較、整理資訊，適合做懶人包、清單與評測。這種內容收藏率超高，而且完全不露臉也能經營。",
    topics: (d) => [`${d}新手必收的 10 個資源`, `A vs B 完整比較，一篇幫你選好`, `本週${d}重點，3 分鐘看完`],
    firstStep: "把你自己入門時收藏過的資源，整理成一篇「新手包」——這是最容易起飛的第一篇。",
  },
};

/* 依表達形式 + 露臉意願 → 平台建議 */
function platformAdvice(format, face) {
  if (format === "text") return "Threads、Facebook 為主，累積長文後可經營部落格或電子報";
  if (format === "carousel") return "Instagram 圖文輪播為主，同步發 Threads 引流";
  if (face === "yes") return "IG Reels、TikTok、YouTube Shorts 短影音為主，擇一深耕";
  if (face === "voice") return "Podcast 或 YouTube 不露臉頻道（螢幕畫面＋旁白）";
  return "不露臉短影音（手部／畫面特寫）或 IG 圖文輪播";
}

/* 依可投入時間 → 節奏建議 */
const TIME_ADVICE = {
  lt3: "每週 1 則精心製作的內容就好，穩定發比爆量更重要",
  "3to5": "每週 2～3 則，重點是養成固定的產出節奏",
  "5to10": "每週 3～4 則內容，加上每天 10 分鐘回覆留言互動",
  gt10: "可以挑戰日更，或雙平台同步經營、互相導流",
};
