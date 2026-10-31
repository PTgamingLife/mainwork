// 十神試煉場 — ?mock=1 測試用:假的十神修行錄狀態(不碰真正的 sg_state_v2)
import { siAddDays } from "./si-store.js";

export const SI_MOCK_SG_KEY = "si_mock_sg_state";
export const SI_MOCK_STATE_KEY = "si_mock_state_v1";
export const SI_MOCK_OFFSET_KEY = "si_mock_offset_ms";

export function siMockSg(today) {
  const checkins = {};
  for (let i = 1; i <= 11; i++) {
    const d = siAddDays(today, -i);
    checkins[d] = { sg_precept_ok: i % 3 !== 0, sg_bond_ok: true, sg_oath_ok: i % 2 === 0 };
  }
  return {
    sg_chart: {
      sg_day_master: 0, // 甲木
      sg_scores: {
        bi_jian: 1.4, jie_cai: 0.9, shi_shen: 0.7, shang_guan: 1.1, zheng_cai: 2.3,
        pian_cai: 1.2, zheng_guan: 0.6, qi_sha: 1.5, zheng_yin: 0.5, pian_yin: 0.8,
      },
    },
    sg_evolved: [0.2, 0.3, 0.1, 0, 0.4],
    sg_week: {
      sg_precept: { sg_text: "(測試)戒律", sg_energy: 4, sg_transform: "木剋土" },
      sg_bond: { sg_text: "(測試)約束", sg_energy: 4, sg_transform: "水生木" },
      sg_oath: { sg_text: "(測試)誓言", sg_energy: 0, sg_transform: "木生火" },
    },
    sg_checkins: checkins,
  };
}

export function siMockCheckin(sg, today, flag) {
  const c = (sg.sg_checkins[today] ||= { sg_precept_ok: false, sg_bond_ok: false, sg_oath_ok: false });
  if (flag === "all") { c.sg_precept_ok = c.sg_bond_ok = c.sg_oath_ok = true; } else c[flag] = true;
}
