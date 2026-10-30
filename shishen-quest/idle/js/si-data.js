// 十神試煉場 — 常數與對照表
// 五能量:0 創造力 1 生產力 2 制約力 3 解析力 4 群眾力(與十神修行錄 sg_ 相同)

// 十神:si_inner = 站五芒星點內側(正/陰),否則外側(偏)
export const SI_GODS = [
  { si_key: "bi_jian", si_name: "比肩", si_energy: 4, si_inner: true },
  { si_key: "jie_cai", si_name: "劫財", si_energy: 4, si_inner: false },
  { si_key: "shi_shen", si_name: "食神", si_energy: 0, si_inner: true },
  { si_key: "shang_guan", si_name: "傷官", si_energy: 0, si_inner: false },
  { si_key: "zheng_cai", si_name: "正財", si_energy: 1, si_inner: true },
  { si_key: "pian_cai", si_name: "偏財", si_energy: 1, si_inner: false },
  { si_key: "zheng_guan", si_name: "正官", si_energy: 2, si_inner: true },
  { si_key: "qi_sha", si_name: "七殺", si_energy: 2, si_inner: false },
  { si_key: "zheng_yin", si_name: "正印", si_energy: 3, si_inner: true },
  { si_key: "pian_yin", si_name: "偏印", si_energy: 3, si_inner: false },
];
export const SI_GOD_BY_KEY = Object.fromEntries(SI_GODS.map((g) => [g.si_key, g]));

export const SI_POINT_NAMES = ["比劫", "食傷", "財", "官殺", "印"];
// 五芒星五點(順時針、相生序),頂點為日主:群眾→創造→生產→制約→解析
export const SI_POINT_ENERGIES = [4, 0, 1, 2, 3];

export const SI_ELEMENTS = ["木", "火", "土", "金", "水"];
export const SI_ELEM_COLORS = ["#4E7A68", "#D2553F", "#C9A21E", "#8E918B", "#2F4A6B"];

// 日主天干(0 甲 … 9 癸)的五行
export const siDayElem = (dm) => Math.floor(dm / 2);
// 五行 el 位於第幾個點
export const siPointOfElem = (dm, el) => (el - siDayElem(dm) + 5) % 5;
// 第 i 點的五行
export const siElemOfPoint = (dm, i) => (siDayElem(dm) + i) % 5;
export const siPointOfEnergy = (e) => SI_POINT_ENERGIES.indexOf(e);

// 心魔:反卡巴拉之樹十種負面特質;si_drop = 擊倒後掉落的十神靈氣
export const SI_DEMONS = [
  { si_trait: "對立", si_boss: "撒密爾", si_drop: "jie_cai" },
  { si_trait: "愚鈍", si_boss: "加基爾", si_drop: "zheng_yin" },
  { si_trait: "拒絕", si_boss: "撒他利爾", si_drop: "pian_cai" },
  { si_trait: "無感", si_boss: "加姆奇可斯", si_drop: "shang_guan" },
  { si_trait: "殘酷", si_boss: "高拉布", si_drop: "zheng_guan" },
  { si_trait: "醜陋", si_boss: "塔吉利昂", si_drop: "shi_shen" },
  { si_trait: "色慾", si_boss: "阿拉布扎拉克", si_drop: "qi_sha" },
  { si_trait: "貪婪", si_boss: "薩麥爾", si_drop: "zheng_cai" },
  { si_trait: "不安", si_boss: "迦瑪列", si_drop: "pian_yin" },
  { si_trait: "物慾", si_boss: "莉莉絲", si_drop: "bi_jian" },
];

// 技能:等級 = 該項累計打卡次數達到的門檻數
export const SI_SKILL_STEPS = [1, 7, 21, 49, 100];
export const SI_SKILLS = [
  { si_key: "si_oath", si_name: "誓言", si_flag: "sg_oath_ok" },
  { si_key: "si_precept", si_name: "戒律", si_flag: "sg_precept_ok" },
  { si_key: "si_bond", si_name: "約束", si_flag: "sg_bond_ok" },
];
export const SI_OATH_CUT_MIN = [0, 1, 2, 4, 6, 8];         // 誓言:試煉縮短分鐘
export const SI_THIEF_CHANCE = [0.6, 0.5, 0.4, 0.3, 0.2, 0.1]; // 戒律:小偷出現機率
export const SI_THIEF_RATIO = [0.3, 0.25, 0.2, 0.15, 0.1, 0.05]; // 戒律:偷走比例
export const SI_BOND_MULT = [1, 1.1, 1.2, 1.3, 1.4, 1.5];  // 約束:靈氣倍率

// 試煉與離線
export const SI_RUN_MIN = 20;
export const SI_PENALTY_MIN = 5;
export const SI_PENALTY_CAP_MIN = 15;
export const SI_OFFLINE_DAYS = 5;        // 上次完成試煉後,只有 5 天有離線收益
export const SI_OFFLINE_PER_HOUR = 0.25; // 每位十神每小時離線靈氣(有打卡的日子)
export const SI_OFFLINE_MISS_RATE = 0.2; // 沒打卡的日子 1/5
export const SI_KILL_DROP = 0.25;        // 每擊倒一隻心魔掉落的靈氣(× 場數)
export const SI_BOSS_DROP = 10;          // 頭目掉落(× 場數)
export const SI_WEEK_BONUS = 1.2;        // 本週轉化加成

// 十神形象:每 10 級換一階
export const SI_TIERS = ["初心", "執器", "披光", "化形", "法相"];
export const siTierOf = (lvl) => Math.min(SI_TIERS.length - 1, Math.floor((lvl - 1) / 10));
export const siUpgradeCost = (lvl, mult = 1) => Math.ceil(10 * Math.pow(1.12, lvl - 1) * mult);

// 命盤補弱:升級成本 × (該十神命盤分數 ÷ 十神平均分數),限制在 0.4–2.0
export const SI_COST_MULT_MIN = 0.4, SI_COST_MULT_MAX = 2.0;

// 五行相剋:攻擊方剋怪物 +15%,怪物剋攻擊方 −15%(相生、同五行不變)
export const SI_COUNTER_BONUS = 0.15;
export const siGodElem = (dm, key) => siElemOfPoint(dm, siPointOfEnergy(SI_GOD_BY_KEY[key].si_energy));
export function siCounterMult(dm, atkKey, defKey) {
  const a = siGodElem(dm, atkKey), b = siGodElem(dm, defKey);
  if ((b - a + 5) % 5 === 2) return 1 + SI_COUNTER_BONUS;
  if ((a - b + 5) % 5 === 2) return 1 - SI_COUNTER_BONUS;
  return 1;
}
