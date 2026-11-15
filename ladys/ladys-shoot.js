// LadyS LIFF — 🎬 拍片頁:拍片行程(主題 / 內文 / 需準備事項)。在 ladys.js 之前載入,只定義函式
// 行銷 / 剪片 / LadyS 共用的拍片進度表;內容由剪片 agent 與使用者討論定案,這裡可編輯狀態與下一步
const LADYS_SHOOT_STATUS = ["構想", "待寫腳本", "腳本完成", "待拍攝", "已拍攝", "剪輯中", "剪完待審", "已上片", "暫停"];
const shootDone = (x) => x.ladys_status === "已上片";

function shootItem(x) {
  const when = x.ladys_date ? `${dayLabel(x.ladys_date)}${x.ladys_time ? " " + x.ladys_time : ""}` : "未排日期";
  const sub = x.ladys_content ? "📝 " + esc(x.ladys_content.replace(/\s+/g, " ").slice(0, 28)) + (x.ladys_content.length > 28 ? "…" : "") : "內容待與剪片 agent 討論";
  return `<div class="ladys-item" data-edit="shoot" data-id="${x.id}"><i class="ladys-bar ladys-o-${x.ladys_owner}"></i>
    <div class="t"><div>🎬 ${esc(x.ladys_topic)}</div><div class="s">${when} · ${LADYS_OWNER[x.ladys_owner]} · 📍${esc(x.ladys_status || "構想")}</div><div class="s">${sub}</div>
    ${x.ladys_next_step ? `<div class="s">👉 ${esc(x.ladys_next_step.slice(0, 30))}</div>` : ""}
    ${x.ladys_prep ? `<div class="s">🧰 ${esc(x.ladys_prep.slice(0, 30))}${x.ladys_prep.length > 30 ? "…" : ""}</div>` : ""}</div></div>`;
}

function viewShoot() {
  const all = ladysS.data.shoots || [], today = ladysS.data.today;
  const live = all.filter((x) => !shootDone(x));
  const backlog = live.filter((x) => !x.ladys_date);
  const coming = live.filter((x) => x.ladys_date && x.ladys_date >= today);
  const past = all.filter((x) => shootDone(x) || (x.ladys_date && x.ladys_date < today)).reverse().slice(0, 10);
  const s = ladysS.data.settings;
  return `<div class="ladys-card"><div class="s" style="font-size:13px;color:var(--ladys-muted)">👨 方向:${esc(s.ladys_shoot_dir_husband || "LINE 個人 AI 秘書設定與教學")}<br>👩 方向:${esc(s.ladys_shoot_dir_wife || "銅鑼浴")}<br>群組輸入「拍片主題 xxx」可快速加主題;內容與剪片 agent 討論定案</div></div>
    <div class="ladys-sec">即將拍攝</div><div class="ladys-card">${coming.length ? coming.map(shootItem).join("") : '<div class="ladys-empty">還沒排拍片 🎥</div>'}</div>
    ${backlog.length ? `<div class="ladys-sec">待拍主題(未排日期)</div><div class="ladys-card">${backlog.map(shootItem).join("")}</div>` : ""}
    ${past.length ? `<div class="ladys-sec">已拍過 / 已上片</div><div class="ladys-card">${past.map(shootItem).join("")}</div>` : ""}`;
}

function shootSheet(row, isNew) {
  const st = row?.ladys_status || "構想";
  const link = (u, t) => /^https?:\/\//.test(u || "") ? `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>` : u ? esc(u) : "";
  const info = [row?.ladys_brief && `📣 行銷重點:${esc(row.ladys_brief.slice(0, 120))}`, row?.ladys_script && `✂️ 腳本:${link(row.ladys_script, "開啟") || ""}${/^https?:/.test(row.ladys_script) ? "" : esc(row.ladys_script.slice(0, 120))}`,
    row?.ladys_assets_url && `📁 素材:${link(row.ladys_assets_url, "開啟")}`, row?.ladys_final_url && `🎞️ 成片:${link(row.ladys_final_url, "開啟")}`,
    row?.ladys_blocker && `⛔ 卡關:${esc(row.ladys_blocker)}`].filter(Boolean);
  return `<h3>${isNew ? "新增" : "編輯"}拍片</h3>
    <div class="ladys-field"><label>主題</label><input id="fTopic" maxlength="40" value="${esc(row?.ladys_topic)}"></div>
    <div class="ladys-row2"><div class="ladys-field"><label>日期(空白 = 未排)</label><input type="date" id="fDate" value="${row?.ladys_date || ""}"></div>
    <div class="ladys-field"><label>時間</label><input type="time" id="fTime" value="${row?.ladys_time || ""}"></div></div>
    <div class="ladys-field"><label>誰拍</label>${seg("owner", OWNER_OPTS, row?.ladys_owner || "both")}</div>
    <div class="ladys-field"><label>狀態</label><select id="fStatus">${LADYS_SHOOT_STATUS.map((x) => `<option${x === st ? " selected" : ""}>${x}</option>`).join("")}</select></div>
    <div class="ladys-field"><label>下一步</label><input id="fNext" maxlength="100" value="${esc(row?.ladys_next_step)}" placeholder="例如:跟剪片 agent 確認腳本"></div>
    <div class="ladys-field"><label>內文 / 腳本</label><textarea id="fContent" rows="7" maxlength="1000" placeholder="內容與剪片 agent 討論定案後填入">${esc(row?.ladys_content)}</textarea></div>
    <div class="ladys-field"><label>需準備事項</label><textarea id="fPrep" rows="2" maxlength="300" placeholder="例如:腳架、補光燈、銅鑼、手機架">${esc(row?.ladys_prep)}</textarea></div>
    ${info.length ? `<div class="s" style="font-size:12px;color:var(--ladys-muted);line-height:1.6">${info.join("<br>")}</div>` : ""}`;
}

function shootSettingsHtml(s, sw) {
  return `<div class="ladys-sec">🎬 拍片提醒</div><div class="ladys-card">
    ${sw("shoot_enabled", "每天推拍片提醒")}
    <div class="ladys-field" style="margin-top:10px"><label>提醒時間</label><input type="time" id="ladysShootTime" value="${s.ladys_shoot_time || "09:00"}"></div>
    <div class="ladys-field"><label>👨 老公的拍片方向</label><input id="ladysShootDirH" maxlength="60" value="${esc(s.ladys_shoot_dir_husband || "LINE 個人 AI 秘書設定與教學")}"></div>
    <div class="ladys-field"><label>👩 老婆的拍片方向</label><input id="ladysShootDirW" maxlength="60" value="${esc(s.ladys_shoot_dir_wife || "銅鑼浴")}"></div>
    <div class="s" style="color:var(--ladys-muted);font-size:12px">7 天內有排拍片 → 推主題、內文、需準備事項;沒有排 → 推待拍主題或依方向給靈感。內文空白時顯示「內容待與剪片 agent 討論」。已上片 / 暫停的不提醒。</div></div>`;
}
