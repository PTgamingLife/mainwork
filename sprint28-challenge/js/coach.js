// ===== 第5頁：小老師對話（寶哥語氣，真 AI 回覆） =====
App._coachHistory = []; // {role, content}

App.renderCoach = function () {
  const wrap = $('#page-coach');
  if (wrap.dataset.ready) { scrollFeed(); return; }
  wrap.dataset.ready = '1';
  wrap.innerHTML = `
    <div class="coach-wrap">
      <div class="coach-head">
        <span class="ava">🧑‍🏫</span>
        <div><b>小老師（寶哥）</b><small>領導教練・有任何事業問題都可以問我</small></div>
      </div>
      <div class="coach-feed" id="coachFeed"></div>
      <div class="coach-input">
        <input id="coachInput" placeholder="輸入你的問題…" maxlength="500" />
        <button class="btn btn-primary btn-sm" id="coachSend"><span>送出</span></button>
      </div>
    </div>
    <div class="quick-q" id="quickQ"></div>`;

  const quick = [
    '被拒絕了好幾次，有點想放棄怎麼辦？',
    '怎麼開口邀約朋友比較不尷尬？',
    '名單快用完了，去哪裡找新名單？',
    '今天沒成交，心情很低落…',
    '怎麼跟新人溝通事業價值？',
  ];
  $('#quickQ').innerHTML = quick.map((q, i) => `<button data-i="${i}">${App.esc(q)}</button>`).join('');
  $$('#quickQ button').forEach((b) => b.onclick = () => { $('#coachInput').value = quick[+b.dataset.i]; sendCoach(); });

  $('#coachSend').onclick = sendCoach;
  $('#coachInput').onkeydown = (e) => { if (e.key === 'Enter') sendCoach(); };

  if (!App._coachHistory.length) {
    pushMsg('bot', `${App.me.name}，很高興你來找我！🔥\n\n我是小老師。這 28 天的挑戰路上，無論是心態、邀約、跟進還是被拒絕，任何卡關都可以問我。我們一起把這 20 位顧客拿下！\n\n你今天遇到什麼狀況呢？`);
  } else {
    App._coachHistory.forEach((m) => pushMsg(m.role === 'user' ? 'user' : 'bot', m.content, true));
  }
};

function mdLite(t) {
  return App.esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>');
}
function scrollFeed() { const f = $('#coachFeed'); if (f) f.scrollTop = f.scrollHeight; }

function pushMsg(who, text, noStore) {
  const f = $('#coachFeed');
  const div = document.createElement('div');
  div.className = 'msg ' + (who === 'user' ? 'user' : 'bot');
  div.innerHTML = who === 'user' ? App.esc(text) : mdLite(text);
  f.appendChild(div);
  scrollFeed();
  if (!noStore) App._coachHistory.push({ role: who === 'user' ? 'user' : 'assistant', content: text });
}

async function sendCoach() {
  const input = $('#coachInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  pushMsg('user', text);

  const f = $('#coachFeed');
  const typing = document.createElement('div');
  typing.className = 'msg bot';
  typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  f.appendChild(typing); scrollFeed();

  try {
    const resp = await fetch(CONFIG.COACH_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: App._coachHistory.slice(-12) }),
    });
    const data = await resp.json();
    typing.remove();
    if (data.reply) pushMsg('bot', data.reply);
    else pushMsg('bot', '抱歉，我這邊暫時收不到訊號…請稍後再問我一次！🙏');
  } catch (e) {
    typing.remove();
    pushMsg('bot', '連線好像不太穩，深呼吸一下，等等再試一次。我一直都在！💪');
    console.error(e);
  }
}
