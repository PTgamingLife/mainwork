// 旅程頁:讀 lj-api 的 journey,把開場、每一段、結尾畫成路邊的卡片,再交給 LJ_ROAD 畫路。
// ?code=XXXX 是看別人的旅程(唯讀,結尾換成「送一段回憶給他」)。
(function () {
  const $ = (id) => document.getElementById(id);
  const CFG = window.LJ_CONFIG;
  const esc = (s) => LJ.esc(s);
  const code = (LJ.param('code') || '').toUpperCase();
  let data = null;

  function textCard(side, label, html, cls) {
    return `<section class="stop ${side}"><div class="card text ${cls || ''}">
      <span class="num">${label}</span>${html}</div></section>`;
  }

  function render(d) {
    data = d;
    const name = d.member.name || '這位旅人';
    const p = d.profile;
    $('tagline').textContent = p ? p.tagline : `${name} 的旅程`;
    document.title = d.isMine ? '我的生命之旅' : `${name} 的生命之旅`;

    const cards = [];
    let side = 'L';
    const flip = () => (side = side === 'L' ? 'R' : 'L');

    // 開場:歡迎來到 ○○ 的旅程 + 自我介紹
    if (p) {
      cards.push(textCard(side, `歡迎來到 <b class="who">${esc(name)}</b> 的旅程`, `<p>${esc(p.story)}</p>`));
      flip();
    }

    // 每一段:照片卡,從路邊跳出來
    d.stops.forEach((s, i) => {
      cards.push(`<section class="stop ${side}"><div class="card">
        <div class="photo">${s.photo ? `<img src="${esc(s.photo)}" alt="" loading="lazy">` : ''}
          ${s.when ? `<div class="when">${esc(s.when)}</div>` : ''}</div>
        <span class="num">第 ${i + 1} 段</span>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.story)}</p></div></section>`);
      flip();
    });

    // 結尾:期待的生活、給自己的話
    if (p && p.future) { cards.push(textCard(side, '我期待的生活', `<p>${esc(p.future)}</p>`)); flip(); }
    if (p && p.note) { cards.push(textCard(side, '給自己的話', `<p>「${esc(p.note)}」</p>`, 'quote')); flip(); }
    $('stops').innerHTML = cards.join('');

    // 路的盡頭
    let end = '';
    if (d.isMine) {
      if (!d.stops.length) end += '<p class="empty">這條路才剛開始。<br>放上第一張照片，寫下第一段旅程吧。</p>';
      end += '<button class="btn btn-main" id="btnAdd">＋ 增加我的生命之旅</button>';
      end += '<button class="btn btn-ghost" id="btnShare">分享給朋友</button>';
      $('code').textContent = `我的編號 · ${d.member.code}`;
    } else {
      if (!p) end += `<p class="empty">${esc(name)} 還沒開始他的旅程。</p>`;
      end += `<button class="btn btn-main" id="btnGift">送一段回憶給 ${esc(name)}</button>`;
      $('code').textContent = `${name} 的編號 · ${d.member.code}`;
    }
    $('endBtns').innerHTML = end;
    bindEnd();

    // 頂部按鈕
    $('topbar').classList.remove('hidden');
    $('goBack').classList.toggle('hidden', d.isMine);
    $('goFind').classList.toggle('hidden', !d.isMine);
    $('goInbox').classList.toggle('hidden', !d.isMine);
    $('dot').classList.toggle('hidden', !(d.pendingGifts > 0));

    $('boot').classList.add('hidden');
    // 照片載入會改變卡片高度,路要跟著重算(多張一起載完只算一次)
    let t;
    const rebuild = () => { clearTimeout(t); t = setTimeout(window.LJ_ROAD.build, 120); };
    document.querySelectorAll('.photo img').forEach((img) => img.addEventListener('load', rebuild));
    requestAnimationFrame(window.LJ_ROAD.build);
  }

  function bindEnd() {
    const add = $('btnAdd'), share = $('btnShare'), gift = $('btnGift');
    if (add) add.onclick = () => LJ.go('add.html');
    if (share) share.onclick = shareJourney;
    if (gift) gift.onclick = () => LJ.go('gift.html', { to: data.member.code });
  }

  // 分享:用 LINE 的「傳送給…」把卡片送給好友。卡片上不放照片 ——
  // 照片網址一小時就失效,過幾天打開會是破圖。
  async function shareJourney() {
    const d = data;
    const name = d.member.name || '我';
    const viewUrl = `https://liff.line.me/${CFG.LIFF_ID}/journey.html?code=${d.member.code}`;
    const flex = {
      type: 'flex',
      altText: `${name} 邀請你看他的生命之旅`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '22px', backgroundColor: '#F4F1DE',
          contents: [
            { type: 'text', text: `${name} 的生命之旅`, size: 'xs', color: '#E07A5F' },
            { type: 'text', text: (d.profile && d.profile.tagline) || '一段正在往前走的旅程', wrap: true, size: 'lg', color: '#1D2B3A' },
            { type: 'text', text: '先認識自己，再紀錄自己。你也來走一段吧。', wrap: true, size: 'sm', color: '#475A70' },
          ],
        },
        footer: {
          type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
          contents: [
            { type: 'button', style: 'primary', color: '#2E4057', height: 'sm',
              action: { type: 'uri', label: `看 ${name.slice(0, 8)} 的旅程`, uri: viewUrl } },
            { type: 'button', style: 'secondary', height: 'sm',
              action: { type: 'uri', label: '我也要開始', uri: CFG.OA_ADD_FRIEND_URL } },
          ],
        },
      },
    };
    const ok = !CFG.MOCK && window.liff && liff.isApiAvailable && liff.isApiAvailable('shareTargetPicker');
    if (!ok) {
      // 不能叫出 LINE 的選人畫面時(電腦、或 LIFF 沒開權限),改成複製連結
      try { await navigator.clipboard.writeText(`${name} 的生命之旅\n${viewUrl}\n加入:${CFG.OA_ADD_FRIEND_URL}`); } catch (e) { /* 忽略 */ }
      return LJ.toast('這裡不能直接傳送，已幫你複製連結');
    }
    try {
      const r = await liff.shareTargetPicker([flex]);
      if (r) LJ.toast('已經傳送出去了');
    } catch (e) {
      LJ.toast('傳送失敗，請再試一次');
    }
  }

  // 頂部按鈕往下滑時收起、往上滑時再出現,免得一直蓋在卡片上
  let lastY = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    $('topbar').classList.toggle('away', y > 120 && y > lastY);
    lastY = y;
  }, { passive: true });

  $('goBack').onclick = () => LJ.go('journey.html');
  $('goFind').onclick = () => LJ.go('find.html');
  $('goInbox').onclick = () => LJ.go('gift.html', { tab: 'inbox' });

  LJ.boot(async (me) => {
    // 自己還沒做問答 → 先去認識自己
    if (!code && !(me.profile && me.profile.status === 'final')) return LJ.go('quiz.html');
    const r = await LJ.api('journey', code ? { code } : {});
    if (!r.ok) return LJ.fail(LJ.say(r.error));
    render(r);
  });
})();
