// 十神修行錄 — 今日卜卦(三錢法):搖龜殼 6 次,由初爻到上爻成卦;一天一卦
// 爻值:三枚錢,正面 3、反面 2,合計 6 老陰(變)、7 少陽、8 少陰、9 老陽(變)
import { sgDateStr } from "./sg-store.js?v=20261031a";

export const SG_YAO_NAMES = { 6: "老陰", 7: "少陽", 8: "少陰", 9: "老陽" };
const SG_POS = ["初", "二", "三", "四", "五", "上"];
const SG_KEEP_DAYS = 30; // 只保留最近 30 天的卦(控制雲端狀態大小)

// 文王卦序:下卦(列)× 上卦(欄),順序 乾 震 坎 艮 坤 巽 離 兌;卦象由下而上 1=陽
const SG_TRI_BITS = ["111", "100", "010", "001", "000", "011", "101", "110"];
const SG_KW = [
  [1, 34, 5, 26, 11, 9, 14, 43], [25, 51, 3, 27, 24, 42, 21, 17], [6, 40, 29, 4, 7, 59, 64, 47], [33, 62, 39, 52, 15, 53, 56, 31],
  [12, 16, 8, 23, 2, 20, 35, 45], [44, 32, 48, 18, 46, 57, 50, 28], [13, 55, 63, 22, 36, 37, 30, 49], [10, 54, 60, 41, 19, 61, 38, 58],
];
const SG_HEX_NAMES = ("乾 坤 屯 蒙 需 訟 師 比 小畜 履 泰 否 同人 大有 謙 豫 隨 蠱 臨 觀 噬嗑 賁 剝 復 无妄 大畜 頤 大過 坎 離 咸 恒 "
  + "遯 大壯 晉 明夷 家人 睽 蹇 解 損 益 夬 姤 萃 升 困 井 革 鼎 震 艮 漸 歸妹 豐 旅 巽 兌 渙 節 中孚 小過 既濟 未濟").split(" ");

export function sgHexNo(bits) {
  return SG_KW[SG_TRI_BITS.indexOf(bits.slice(0, 3))][SG_TRI_BITS.indexOf(bits.slice(3))];
}
export const sgHexName = (bits) => SG_HEX_NAMES[sgHexNo(bits) - 1];

export function sgCastYao(rand = Math.random) {
  const coins = [0, 1, 2].map(() => (rand() < 0.5 ? 2 : 3));
  return { value: coins.reduce((a, b) => a + b, 0), coins };
}

export const sgYaoBit = (v) => (v === 7 || v === 9 ? "1" : "0");
export function sgLinesToBits(lines) { return lines.map(sgYaoBit).join(""); }
export function sgChangedBits(lines) {
  if (!lines.some((v) => v === 6 || v === 9)) return "";
  return lines.map((v) => (v === 6 ? "1" : v === 9 ? "0" : sgYaoBit(v))).join("");
}
export const sgYaoLabel = (i, v) => {
  const n = sgYaoBit(v) === "1" ? "九" : "六";
  return i === 0 || i === 5 ? `${SG_POS[i]}${n}` : `${n}${SG_POS[i]}`;
};

export function sgTodayDivine(state, today = sgDateStr()) {
  return state.sg_divines?.[today] || null;
}

// 搖一次 → 加一爻;滿 6 爻回傳 true
export function sgAddYao(state, yao, today = sgDateStr()) {
  state.sg_divines = state.sg_divines || {};
  const d = state.sg_divines[today] || (state.sg_divines[today] = { sg_lines: [], sg_coins: [] });
  if (d.sg_lines.length >= 6) return true;
  d.sg_lines.push(yao.value);
  d.sg_coins.push(yao.coins);
  if (d.sg_lines.length === 6) {
    d.sg_bits = sgLinesToBits(d.sg_lines);
    d.sg_changed = sgChangedBits(d.sg_lines);
    d.sg_at = new Date().toISOString();
    Object.keys(state.sg_divines).sort().slice(0, -SG_KEEP_DAYS).forEach((k) => delete state.sg_divines[k]);
    return true;
  }
  return false;
}

// 伺服器回傳的卦辭存進當天紀錄(之後不必再查)
export function sgSetDivineText(state, res, today = sgDateStr()) {
  const d = state.sg_divines?.[today];
  if (d && res?.main) d.sg_text = { main: res.main, changed: res.changed || null };
}
