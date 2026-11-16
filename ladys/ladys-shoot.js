// LadyS LIFF — 🎬 拍片頁:拍片行程(主題 / 內文 / 需準備事項)。在 ladys.js 之前載入,只定義函式
// 沒排日期的 = 「拍片主題」指令存的待拍主題;內文空白時,每日拍片提醒前由 AI 寫一套(標示「AI 草稿」)
function shootItem(x) {
  const when = x.ladys_date ? `${dayLabel(x.ladys_date)}${x.ladys_time ? " " + x.ladys_time : ""}` : "未排日期";
  const sub = x.ladys_content ? (x.ladys_content_ai ? "🤖 AI 草稿 · " : "📝 ") + esc(x.ladys_content.replace(/\s+/g, " ").slice(0, 28)) + (x.ladys_content.length > 28 ? "…" : "")
    : "內文空白(提醒前 AI 會幫忙寫)";
  return `<div class="ladys-item" data-edit="shoot" data-id="${x.id}"><i class="ladys-bar ladys-o-${x.ladys_owner}"></i>
    <div class="t"><div>🎬 ${esc(x.ladys_topic)}</div><div class="s">${when} · ${LADYS_OWNER[x.ladys_owner]}</div><div class="s">${sub}</div>
    ${x.ladys_prep ? `<div class="s">🧰 ${esc(x.ladys_prep.slice(0, 30))}${x.ladys_prep.length > 30 ? "…" : ""}</div>` : ""}</div></div>`;
}

function viewShoot() {
  const all = ladysS.data.shoots || [], today = ladysS.data.today;
  const backlog = all.filter((x) => !x.ladys_date);
  const coming = all.filter((x) => x.ladys_date && x.ladys_date >= today);
  const past = all.filter((x) => x.ladys_date && x.ladys_date < today).reverse().slice(0, 10);
  const s = ladysS.data.settings;
  return `<div class="ladys-card"><div class="s" style="font-size:13px;color:var(--ladys-muted)">👨 方向:${esc(s.ladys_shoot_dir_husband || "LINE 個人 AI 秘書設定與教學")}<br>👩 方向:${esc(s.ladys_shoot_dir_wife || "銅鑼浴")}<br>群組輸入「拍片主題 xxx」可快速加主題</div></div>
    <div class="ladys-sec">即將拍攝</div><div class="ladys-card">${coming.length ? coming.map(shootItem).join("") : '<div class="ladys-empty">還沒排拍片 🎥</div>'}</div>
    ${backlog.length ? `<div class="ladys-sec">待拍主題(未排日期)</div><div class="ladys-card">${backlog.map(shootItem).join("")}</div>` : ""}
    ${past.length ? `<div class="ladys-sec">已拍過</div><div class="ladys-card">${past.map(shootItem).join("")}</div>` : ""}`;
}

function shootSheet(row, isNew) {
  return `<h3>${isNew ? "新增" : "編輯"}拍片</h3>
    <div class="ladys-field"><label>主題</label><input id="fTopic" maxlength="40" value="${esc(row?.ladys_topic)}"></div>
    <div class="ladys-row2"><div class="ladys-field"><label>日期(空白 = 未排)</label><input type="date" id="fDate" value="${row?.ladys_date || ""}"></div>
    <div class="ladys-field"><label>時間</label><input type="time" id="fTime" value="${row?.ladys_time || ""}"></div></div>
    <div class="ladys-field"><label>誰拍</label>${seg("owner", OWNER_OPTS, row?.ladys_owner || "both")}</div>
    <div class="ladys-field"><label>內文 / 腳本${row?.ladys_content_ai ? "(目前是 AI 草稿)" : ""}</label><textarea id="fContent" rows="7" maxlength="1000" placeholder="空白的話,拍片提醒前 AI 會依主題幫忙寫一套">${esc(row?.ladys_content)}</textarea></div>
    <div class="ladys-field"><label>需準備事項</label><textarea id="fPrep" rows="2" maxlength="300" placeholder="例如:腳架、補光燈、銅鑼、手機架">${esc(row?.ladys_prep)}</textarea></div>
    <input type="hidden" id="fOrigContent" value="${esc(row?.ladys_content)}">`;
}

function shootSettingsHtml(s, sw) {
  return `<div class="ladys-sec">🎬 拍片提醒</div><div class="ladys-card">
    ${sw("shoot_enabled", "每天推拍片提醒")}
    <div class="ladys-field" style="margin-top:10px"><label>提醒時間</label><input type="time" id="ladysShootTime" value="${s.ladys_shoot_time || "09:00"}"></div>
    <div class="ladys-field"><label>👨 老公的拍片方向</label><input id="ladysShootDirH" maxlength="60" value="${esc(s.ladys_shoot_dir_husband || "LINE 個人 AI 秘書設定與教學")}"></div>
    <div class="ladys-field"><label>👩 老婆的拍片方向</label><input id="ladysShootDirW" maxlength="60" value="${esc(s.ladys_shoot_dir_wife || "銅鑼浴")}"></div>
    <div class="s" style="color:var(--ladys-muted);font-size:12px">7 天內有排拍片 → 推主題、內文、需準備事項;沒有排 → 推待拍主題或依方向給靈感。內文空白時由 AI 幫忙寫。</div></div>`;
}
