// AI 個人秘書工作坊：選位 + 選動物（Supabase RPC，先選先贏）
(function () {
  const AISEC_API = 'https://hhcubvixldieuwdeqnwc.supabase.co/rest/v1/rpc/';
  const AISEC_KEY = 'sb_publishable_S-fBRRvMYbhAq_FmxgTDbQ_qGeQKmwA';
  const R = window.AISEC_ROOM;
  const $ = id => document.getElementById(id);

  const aisecState = { seats: [], loaded: false, seat: null, animal: null, busy: false };

  const AISEC_MSG = {
    seat_taken: '這個位置剛剛被選走了，請換一個位置。',
    animal_taken: '這隻動物剛剛被選走了，請換一隻。',
    phone_used: '這支手機號碼已經選過位置了。每個人只能選一個位置。',
    taken: '位置或動物剛剛被選走了，請重新選擇。',
    bad_seat: '請先在房間圖上點一個空位。',
    bad_animal: '請選一隻動物。',
    bad_name: '請填寫姓名（20 字以內）。',
    bad_phone: '手機號碼格式是 09 開頭的 10 碼數字。',
    bad_pin: '密碼請設定 4 位數字。',
    wrong_pin: '密碼不對，請再試一次。',
    locked: '密碼錯太多次，這個座位已鎖定。請直接聯絡柏廷老師處理。',
    empty: '這個位置目前沒有人。'
  };

  async function aisecRpc(fn, body) {
    const res = await fetch(AISEC_API + fn, {
      method: 'POST',
      headers: { apikey: AISEC_KEY, Authorization: 'Bearer ' + AISEC_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error('http_' + res.status);
    return res.json();
  }

  async function aisecLoad() {
    try {
      aisecState.seats = await aisecRpc('aisec_get_seats');
      aisecState.loaded = true;
      $('aisec_load_err').hidden = true;
    } catch (e) {
      if (!aisecState.loaded) $('aisec_load_err').hidden = false;
    }
    const taken = aisecState.seats.find(s => s.seat_no === aisecState.seat);
    if (taken) aisecState.seat = null;
    const animalTaken = aisecState.seats.find(s => s.animal === aisecState.animal);
    if (animalTaken) aisecState.animal = null;
    aisecRender();
  }

  const aisecTakenBySeat = no => aisecState.seats.find(s => s.seat_no === no);
  const aisecEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function aisecRenderRoom() {
    let s = '';
    const svgW = $('aisec_room_svg').clientWidth || 800;
    const k = svgW < 520 ? 1.55 : 1; // 手機上人偶與號碼放大，方便點選
    R.AISEC_SEATS.forEach(seat => {
      const [x, y] = R.aisecIso(seat.x, seat.y, seat.z);
      s += `<g transform="translate(${x},${y}) scale(${k}) translate(${-x},${-y})">`;
      const t = aisecTakenBySeat(seat.no);
      if (t) {
        const a = R.AISEC_ANIMALS[t.animal];
        const nm = aisecEsc(t.name);
        const w = Math.max(44, [...t.name].length * 15 + 18);
        s += `<g class="aisec-seat aisec-seat--taken" data-seat="${seat.no}" tabindex="0" role="button" aria-label="座位 ${seat.no}：${nm}（${a ? a.name : ''}），點擊可取消">` +
          `<ellipse cx="${x}" cy="${y + 2}" rx="24" ry="10" fill="#3B2A1E" opacity=".18"/>` +
          `<g transform="translate(${x - 30},${y - 70}) scale(0.6)">${a ? a.svg : ''}</g>` +
          `<rect x="${x - w / 2}" y="${y - 96}" width="${w}" height="24" rx="12" fill="#FFF8EC" stroke="#8B5E3C" stroke-width="1.5"/>` +
          `<text x="${x}" y="${y - 79}" text-anchor="middle" font-size="14" font-weight="700" fill="#3B2A1E">${nm}</text></g>`;
      } else {
        const sel = aisecState.seat === seat.no;
        s += `<g class="aisec-seat aisec-seat--free${sel ? ' is-sel' : ''}" data-seat="${seat.no}" tabindex="0" role="button" aria-label="座位 ${seat.no}（${seat.label}），空位">` +
          `<ellipse class="aisec-ring" cx="${x}" cy="${y}" rx="26" ry="13"/>` +
          (sel && aisecState.animal ? `<g transform="translate(${x - 30},${y - 70}) scale(0.6)" opacity=".85">${R.AISEC_ANIMALS[aisecState.animal].svg}</g>` :
            `<circle cx="${x}" cy="${y - 22}" r="15" class="aisec-pin"/><text x="${x}" y="${y - 16.5}" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">${seat.no}</text>`) +
          `</g>`;
      }
      s += '</g>';
    });
    $('aisec_seats_layer').innerHTML = s;
  }

  function aisecRenderAnimals() {
    const used = new Set(aisecState.seats.map(s => s.animal));
    $('aisec_animals').innerHTML = Object.keys(R.AISEC_ANIMALS).map(k => {
      const a = R.AISEC_ANIMALS[k], off = used.has(k), on = aisecState.animal === k;
      return `<button type="button" class="aisec-animal${on ? ' is-on' : ''}" data-animal="${k}" ${off ? 'disabled' : ''} aria-pressed="${on}">` +
        `${R.aisecAnimalSvg(k, 54)}<span>${a.name}</span>${off ? '<em>已被選</em>' : ''}</button>`;
    }).join('');
  }

  function aisecRender() {
    aisecRenderRoom();
    aisecRenderAnimals();
    const left = R.AISEC_SEATS.length - aisecState.seats.length;
    document.querySelectorAll('.aisec-left').forEach(el => { el.textContent = aisecState.loaded ? left : '–'; });
    const seat = R.AISEC_SEATS.find(s => s.no === aisecState.seat);
    $('aisec_pick_seat').textContent = seat ? `座位 ${seat.no}・${seat.label}` : '還沒選，請點上方房間的空位';
    $('aisec_pick_seat').classList.toggle('is-empty', !seat);
    $('aisec_full').hidden = !(aisecState.loaded && left === 0);
    $('aisec_submit').disabled = aisecState.busy;
  }

  function aisecOpenCancel(no) {
    const t = aisecTakenBySeat(no);
    if (!t) return;
    $('aisec_cancel_who').innerHTML = `${R.aisecAnimalSvg(t.animal, 48)}<div><b>座位 ${no}</b><span>${aisecEsc(t.name)}</span></div>`;
    $('aisec_cancel_pin').value = '';
    $('aisec_cancel_msg').textContent = '';
    $('aisec_cancel').dataset.seat = no;
    $('aisec_cancel').hidden = false;
    $('aisec_cancel_pin').focus();
  }

  function aisecSeatClick(e) {
    const g = e.target.closest('.aisec-seat');
    if (!g) return;
    const no = Number(g.dataset.seat);
    if (aisecTakenBySeat(no)) return aisecOpenCancel(no);
    aisecState.seat = no;
    $('aisec_msg').textContent = '';
    aisecRender();
  }

  async function aisecSubmit(e) {
    e.preventDefault();
    if (aisecState.busy) return;
    const name = $('aisec_name').value.trim(), phone = $('aisec_phone').value.replace(/[\s-]/g, ''), pin = $('aisec_pin').value.trim();
    const local = !aisecState.seat ? 'bad_seat' : !aisecState.animal ? 'bad_animal' : !name || name.length > 20 ? 'bad_name' :
      !/^09\d{8}$/.test(phone) ? 'bad_phone' : !/^\d{4}$/.test(pin) ? 'bad_pin' : null;
    if (local) { $('aisec_msg').textContent = AISEC_MSG[local]; return; }
    aisecState.busy = true; aisecRender();
    $('aisec_msg').textContent = '送出中…';
    try {
      const r = await aisecRpc('aisec_book', { p_seat: aisecState.seat, p_animal: aisecState.animal, p_name: name, p_phone: phone, p_pin: pin });
      if (r === 'ok') {
        const seat = R.AISEC_SEATS.find(s => s.no === aisecState.seat);
        $('aisec_done_card').innerHTML = `${R.aisecAnimalSvg(aisecState.animal, 84)}<div><p class="aisec-done-name">${aisecEsc(name)}</p>` +
          `<p>座位 ${seat.no}・${seat.label}</p><p>11/29（日）13:30 澤米芋 804</p></div>`;
        $('aisec_form').hidden = true; $('aisec_done').hidden = false;
        aisecState.seat = null; aisecState.animal = null;
        $('aisec_form').reset();
        $('aisec_msg').textContent = '';
        $('aisec_done').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        $('aisec_msg').textContent = AISEC_MSG[r] || '送出失敗，請再試一次。';
      }
    } catch (err) {
      $('aisec_msg').textContent = '網路連線失敗，請確認網路後再按一次送出。';
    }
    aisecState.busy = false;
    await aisecLoad();
  }

  async function aisecCancel() {
    const no = Number($('aisec_cancel').dataset.seat), pin = $('aisec_cancel_pin').value.trim();
    if (!/^\d{4}$/.test(pin)) { $('aisec_cancel_msg').textContent = '請輸入選位時設定的 4 位數密碼。'; return; }
    $('aisec_cancel_msg').textContent = '處理中…';
    try {
      const r = await aisecRpc('aisec_cancel', { p_seat: no, p_pin: pin });
      if (r === 'ok') {
        $('aisec_cancel_msg').textContent = '';
        $('aisec_cancel').hidden = true;
        $('aisec_msg').textContent = `座位 ${no} 已取消，現在可以重新選位。`;
      } else {
        $('aisec_cancel_msg').textContent = AISEC_MSG[r] || '取消失敗，請再試一次。';
      }
    } catch (err) {
      $('aisec_cancel_msg').textContent = '網路連線失敗，請稍後再試。';
    }
    await aisecLoad();
  }

  function aisecInit() {
    $('aisec_room_svg').setAttribute('viewBox', R.viewBox);
    $('aisec_room_static').innerHTML = R.aisecRoomStatic();
    $('aisec_seats_layer').addEventListener('click', aisecSeatClick);
    $('aisec_seats_layer').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aisecSeatClick(e); } });
    $('aisec_animals').addEventListener('click', e => {
      const b = e.target.closest('.aisec-animal');
      if (!b || b.disabled) return;
      aisecState.animal = b.dataset.animal;
      aisecRender();
    });
    $('aisec_form').addEventListener('submit', aisecSubmit);
    $('aisec_cancel_go').addEventListener('click', aisecCancel);
    $('aisec_cancel_close').addEventListener('click', () => { $('aisec_cancel').hidden = true; });
    $('aisec_again').addEventListener('click', () => { $('aisec_done').hidden = true; $('aisec_form').hidden = false; });
    aisecRender();
    aisecLoad();
    let aisecRz; window.addEventListener('resize', () => { clearTimeout(aisecRz); aisecRz = setTimeout(aisecRenderRoom, 150); });
    setInterval(() => { if (!document.hidden && !aisecState.busy) aisecLoad(); }, 20000);
  }

  window.AISEC_APP = { aisecState, aisecRender };
  aisecInit();
})();
