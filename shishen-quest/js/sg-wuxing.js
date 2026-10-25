// 十神修行錄 — 五行轉化型態(5 相生 + 5 相剋 = 10 種行動型態)
// 五能量依日主換成五行:群眾力=日主、創造力=日主所生、生產力=日主所剋、制約力=剋日主、解析力=生日主
export const SG_ELEMENTS = ["木", "火", "土", "金", "水"]; // 依相生順序:木生火生土生金生水生木

export const SG_TRANSFORMS = {
  "木剋土": { sg_name: "掌握吸收", sg_dir: "用目標、規則、計畫,收束並消化過度膨脹的部分" },
  "土剋水": { sg_name: "築堤設限", sg_dir: "用制度、界線、承諾,把四散的能量圍起來" },
  "水剋火": { sg_name: "降溫沉澱", sg_dir: "用冷靜、反思、暫停,澆熄衝動" },
  "火剋金": { sg_name: "熔鑄重塑", sg_dir: "用更高的熱情與表現,改變舊的行為模式" },
  "金剋木": { sg_name: "修剪刪減", sg_dir: "用更嚴的規則、紀律,修整、刪去多餘" },
  "木生火": { sg_name: "點燃引火", sg_dir: "用新的開始、新的學習,點燃行動熱度" },
  "火生土": { sg_name: "沉澱成形", sg_dir: "把熱情化為穩定、可累積的成果" },
  "土生金": { sg_name: "淬鍊萃取", sg_dir: "從穩定的基礎裡,提煉出規則與精華" },
  "金生水": { sg_name: "化剛為柔", sg_dir: "從規則與決斷中,生出智慧與彈性" },
  "水生木": { sg_name: "滋養生長", sg_dir: "用知識和資源,持續灌溉新的嘗試" },
};
export const SG_TRANSFORM_KEYS = Object.keys(SG_TRANSFORMS);

// 能量 e(0 創造力 … 4 群眾力)在此日主下的五行索引
export function sgElemOf(dayMaster, e) {
  return (Math.floor(dayMaster / 2) + e + 1) % 5;
}

export const sgController = (e) => (e + 3) % 5; // 剋 e 的能量
export const sgMotherOf = (e) => (e + 4) % 5;   // 生 e 的能量

// from 對 to 的轉化型態鍵(from 生 to 或 from 剋 to)
export function sgTransformKey(dayMaster, from, to) {
  const a = sgElemOf(dayMaster, from), b = sgElemOf(dayMaster, to);
  const rel = (b - a + 5) % 5 === 1 ? "生" : "剋";
  return `${SG_ELEMENTS[a]}${rel}${SG_ELEMENTS[b]}`;
}

// 戒律:剋最強者;約束:生第二弱者;誓言:預設「生誓言能量」(AI 可依內容改選)
export function sgVowPlan(dayMaster, s, w2) {
  const c = sgController(s), m = sgMotherOf(w2);
  return {
    c, m,
    precept_key: sgTransformKey(dayMaster, c, s),
    bond_key: sgTransformKey(dayMaster, m, w2),
  };
}

export function sgOathDefaultKey(dayMaster, e) {
  return sgTransformKey(dayMaster, sgMotherOf(e), e);
}
