// 澤米芋 804 偽 3D 俯瞰房間 + Q 版動物人偶（依小樹屋照片配置）
// 座標單位：公寸（dm）。x：西→東 0~45，y：北→南 0~37，z：高度。
(function () {
  const AISEC_U = 10, AISEC_W = 45, AISEC_D = 37, AISEC_H = 26;
  const AISEC_OX = AISEC_D * 0.866 * AISEC_U + 20, AISEC_OY = AISEC_H * AISEC_U + 24;

  function aisecIso(x, y, z) {
    return [(x - y) * 0.866 * AISEC_U + AISEC_OX, (x + y) * 0.5 * AISEC_U - (z || 0) * AISEC_U + AISEC_OY];
  }
  function aisecPoly(pts, fill, extra) {
    const d = pts.map(p => aisecIso(p[0], p[1], p[2]).map(n => n.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${d}" fill="${fill}" ${extra || ''}/>`;
  }
  function aisecBox(x0, y0, x1, y1, z0, z1, top, side, front) {
    return aisecPoly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top) +
      aisecPoly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], front) +
      aisecPoly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], side);
  }
  function aisecDisk(cx, cy, r, z, fill, stroke) {
    const [sx, sy] = aisecIso(cx, cy, z);
    return `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="${(r * AISEC_U * 1.2247).toFixed(1)}" ry="${(r * AISEC_U * 0.7071).toFixed(1)}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="2"` : ''}/>`;
  }
  function aisecTable(cx, cy, r) {
    let s = '';
    [[-0.55, 0.55], [0.55, -0.55], [0.6, 0.6], [-0.6, -0.6]].forEach(([dx, dy]) => {
      const a = aisecIso(cx + dx * r, cy + dy * r, 0), b = aisecIso(cx + dx * r * 0.85, cy + dy * r * 0.85, 4.2);
      s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#C99A62" stroke-width="5" stroke-linecap="round"/>`;
    });
    return s + aisecDisk(cx, cy, r, 4.0, '#C99A62') + aisecDisk(cx, cy, r, 4.6, '#E9C793', '#D9AE73');
  }

  const SOFA = { top: '#7A818C', side: '#5C626C', front: '#4D535C' };
  const BACK = { top: '#6E7580', side: '#555B65', front: '#4A5059' };

  // 座位中心（坐墊上方），依照片：三人沙發 2 位、L 型北段 2 位、東段 2 位、南側單椅 1 位
  const AISEC_SEATS = [
    { no: 1, x: 7, y: 5, z: 4.5, label: '窗邊沙發・靠白板' },
    { no: 2, x: 14.5, y: 5, z: 4.5, label: '窗邊沙發' },
    { no: 3, x: 27.5, y: 5, z: 4.5, label: 'L 型沙發・窗邊' },
    { no: 4, x: 33.5, y: 5, z: 4.5, label: 'L 型沙發・轉角' },
    { no: 5, x: 39, y: 13, z: 4.5, label: 'L 型沙發・東側' },
    { no: 6, x: 39, y: 22, z: 4.5, label: 'L 型沙發・貴妃椅' },
    { no: 7, x: 13.5, y: 30, z: 4.8, label: '單椅・面對圓桌' }
  ];

  function aisecRoomStatic() {
    let s = '';
    // 地板（木紋）
    s += aisecPoly([[0, 0, 0], [AISEC_W, 0, 0], [AISEC_W, AISEC_D, 0], [0, AISEC_D, 0]], '#E4C59A');
    for (let i = 4; i < AISEC_W; i += 4) {
      const a = aisecIso(i, 0, 0), b = aisecIso(i, AISEC_D, 0);
      s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#D6B385" stroke-width="1"/>`;
    }
    // 西牆（白板、門）與北牆（窗）
    s += aisecPoly([[0, 0, 0], [0, AISEC_D, 0], [0, AISEC_D, AISEC_H], [0, 0, AISEC_H]], '#B9BCBC');
    s += aisecPoly([[0, 0, 0], [AISEC_W, 0, 0], [AISEC_W, 0, AISEC_H], [0, 0, AISEC_H]], '#F1EEE7');
    s += aisecPoly([[0, 10, 9], [0, 26, 9], [0, 26, 20], [0, 10, 20]], '#FDFDFB', 'stroke="#9AA0A3" stroke-width="2"');
    s += aisecPoly([[0, 29, 0], [0, 35.5, 0], [0, 35.5, 20.5], [0, 29, 20.5]], '#7E2B2B');
    s += aisecPoly([[0, 30.5, 11], [0, 31.5, 11], [0, 31.5, 18], [0, 30.5, 18]], '#7FD1B9');
    s += aisecPoly([[1.5, 0, 9], [44, 0, 9], [44, 0, 24], [1.5, 0, 24]], '#CFE3EE', 'stroke="#B07A45" stroke-width="3"');
    [12, 22, 32].forEach(x => {
      const a = aisecIso(x, 0, 9), b = aisecIso(x, 0, 24);
      s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#3E4650" stroke-width="3"/>`;
    });
    s += aisecBox(1.5, 0, 44, 1.6, 8.6, 9.2, '#C99A62', '#A97B45', '#B5864F');
    // 窗台小盆栽
    s += aisecBox(20.6, 0.2, 22, 1.4, 9.2, 10.6, '#EDE6DA', '#CFC6B8', '#DCD3C5');
    const p = aisecIso(21.3, 0.8, 11.5);
    s += `<circle cx="${p[0]}" cy="${p[1] - 4}" r="9" fill="#5FA05A"/><circle cx="${p[0] + 7}" cy="${p[1] - 9}" r="6" fill="#77B86E"/>`;
    // 三人沙發（窗邊）
    s += aisecBox(2, 0, 20, 2.2, 0, 8.5, BACK.top, BACK.side, BACK.front);
    s += aisecBox(2, 0, 3.6, 9, 0, 6.5, SOFA.top, SOFA.side, SOFA.front);
    s += aisecBox(3.6, 2.2, 18.4, 9, 0, 4.5, SOFA.top, SOFA.side, SOFA.front);
    s += aisecBox(18.4, 0, 20, 9, 0, 6.5, SOFA.top, SOFA.side, SOFA.front);
    // L 型沙發
    s += aisecBox(23, 0, 44, 2.2, 0, 8.5, BACK.top, BACK.side, BACK.front);
    s += aisecBox(42, 2.2, 44, 30, 0, 8.5, BACK.top, BACK.side, BACK.front);
    s += aisecBox(23, 0, 24.6, 9, 0, 6.5, SOFA.top, SOFA.side, SOFA.front);
    s += aisecBox(24.6, 2.2, 42, 9, 0, 4.5, SOFA.top, SOFA.side, SOFA.front);
    s += aisecBox(34, 9, 42, 30, 0, 4.5, SOFA.top, SOFA.side, SOFA.front);
    // 抱枕
    s += aisecBox(3.8, 1.8, 6.2, 3, 4.5, 8, '#8FA9C4', '#7590AD', '#6F88A3');
    s += aisecBox(40.4, 2.4, 41.8, 5, 4.5, 8.2, '#E2B33C', '#C79A2A', '#BE9226');
    // 圓桌兩張
    s += aisecTable(17, 18, 6) + aisecTable(26.5, 20.5, 5);
    // 單椅（南側）
    s += aisecBox(11, 27.5, 16, 32, 0, 4.8, '#D9B27C', '#B88D57', '#C49A63');
    s += aisecBox(11, 31.2, 16, 32.4, 4.8, 10, '#D9B27C', '#B88D57', '#C49A63');
    // 講師位置
    const t = aisecIso(5, 18, 0);
    s += `<g transform="translate(${t[0]},${t[1]})"><ellipse rx="26" ry="11" fill="#8B5E3C" opacity=".22"/>` +
      `<text y="5" text-anchor="middle" font-size="15" font-weight="700" fill="#6B4528">講師</text></g>`;
    const w = aisecIso(0, 18, 21.5);
    s += `<text x="${w[0] + 4}" y="${w[1] - 4}" font-size="13" font-weight="700" fill="#5B4636">白板・投影</text>`;
    return s;
  }

  // ===== Q 版動物（100×110 畫框，底部中央為站立點） =====
  const EYES = '<circle cx="39" cy="56" r="4" fill="#2A211B"/><circle cx="61" cy="56" r="4" fill="#2A211B"/>' +
    '<circle cx="40.4" cy="54.6" r="1.4" fill="#fff"/><circle cx="62.4" cy="54.6" r="1.4" fill="#fff"/>';
  const CHEEK = '<ellipse cx="31" cy="66" rx="5.5" ry="3.2" fill="#FF8FA3" opacity=".55"/><ellipse cx="69" cy="66" rx="5.5" ry="3.2" fill="#FF8FA3" opacity=".55"/>';
  const MOUTH = '<path d="M45 66 Q50 71 55 66" stroke="#2A211B" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  const body = c => `<ellipse cx="50" cy="96" rx="21" ry="13" fill="${c}"/>`;
  const head = c => `<circle cx="50" cy="56" r="29" fill="${c}"/>`;

  const AISEC_ANIMALS = {
    cat: { name: '貓咪', svg: body('#F2A65A') +
      '<path d="M24 42 L27 15 L45 30Z" fill="#F2A65A"/><path d="M76 42 L73 15 L55 30Z" fill="#F2A65A"/>' +
      '<path d="M29 36 L30 22 L40 31Z" fill="#FFC2C7"/><path d="M71 36 L70 22 L60 31Z" fill="#FFC2C7"/>' +
      head('#F2A65A') + '<path d="M44 30 L46 38 M50 28 L50 37 M56 30 L54 38" stroke="#D9843A" stroke-width="3" stroke-linecap="round"/>' +
      EYES + CHEEK + '<path d="M47.5 62 L52.5 62 L50 65Z" fill="#E36A7A"/>' + MOUTH +
      '<path d="M22 62 L33 64 M22 68 L33 67 M78 62 L67 64 M78 68 L67 67" stroke="#8A5A33" stroke-width="1.4"/>' },
    dog: { name: '狗狗', svg: body('#D9A066') + head('#D9A066') +
      '<ellipse cx="23" cy="52" rx="9" ry="19" fill="#8B5E3C" transform="rotate(18 23 52)"/>' +
      '<ellipse cx="77" cy="52" rx="9" ry="19" fill="#8B5E3C" transform="rotate(-18 77 52)"/>' +
      '<ellipse cx="50" cy="68" rx="14" ry="10" fill="#FFF3E2"/>' + EYES + CHEEK +
      '<ellipse cx="50" cy="63" rx="4.5" ry="3.2" fill="#2A211B"/>' + MOUTH },
    rabbit: { name: '兔兔', svg: body('#FFFFFF') +
      '<rect x="32" y="-4" width="13" height="40" rx="6.5" fill="#FFFFFF" stroke="#E7DCCB" stroke-width="2"/>' +
      '<rect x="55" y="-4" width="13" height="40" rx="6.5" fill="#FFFFFF" stroke="#E7DCCB" stroke-width="2"/>' +
      '<rect x="36" y="2" width="5" height="28" rx="2.5" fill="#FFC2C7"/><rect x="59" y="2" width="5" height="28" rx="2.5" fill="#FFC2C7"/>' +
      '<circle cx="50" cy="56" r="29" fill="#FFFFFF" stroke="#E7DCCB" stroke-width="2"/>' + EYES + CHEEK +
      '<path d="M47.5 62 L52.5 62 L50 65Z" fill="#E36A7A"/>' + MOUTH },
    bear: { name: '熊熊', svg: body('#A47148') +
      '<circle cx="26" cy="32" r="11" fill="#A47148"/><circle cx="74" cy="32" r="11" fill="#A47148"/>' +
      '<circle cx="26" cy="32" r="5.5" fill="#E8C9A0"/><circle cx="74" cy="32" r="5.5" fill="#E8C9A0"/>' +
      head('#A47148') + '<ellipse cx="50" cy="67" rx="13" ry="9.5" fill="#E8C9A0"/>' + EYES + CHEEK +
      '<ellipse cx="50" cy="63" rx="4.5" ry="3.2" fill="#2A211B"/>' + MOUTH },
    panda: { name: '貓熊', svg: body('#2A2A2A') +
      '<circle cx="26" cy="32" r="11" fill="#2A2A2A"/><circle cx="74" cy="32" r="11" fill="#2A2A2A"/>' +
      '<circle cx="50" cy="56" r="29" fill="#FFFFFF" stroke="#E2E2E2" stroke-width="2"/>' +
      '<ellipse cx="38" cy="56" rx="7.5" ry="9.5" fill="#2A2A2A" transform="rotate(25 38 56)"/>' +
      '<ellipse cx="62" cy="56" rx="7.5" ry="9.5" fill="#2A2A2A" transform="rotate(-25 62 56)"/>' +
      '<circle cx="39" cy="56" r="3" fill="#fff"/><circle cx="61" cy="56" r="3" fill="#fff"/>' + CHEEK +
      '<ellipse cx="50" cy="64" rx="4.5" ry="3.2" fill="#2A211B"/>' + MOUTH },
    penguin: { name: '企鵝', svg: '<ellipse cx="50" cy="96" rx="21" ry="13" fill="#2F3E5C"/><ellipse cx="50" cy="98" rx="13" ry="9" fill="#FFFFFF"/>' +
      head('#2F3E5C') + '<path d="M50 40 C30 36 24 70 50 80 C76 70 70 36 50 40Z" fill="#FFFFFF"/>' + EYES + CHEEK +
      '<path d="M44 63 L56 63 L50 70Z" fill="#F4A23B"/>' },
    fox: { name: '狐狸', svg: body('#E8743B') +
      '<path d="M22 46 L24 12 L46 30Z" fill="#E8743B"/><path d="M78 46 L76 12 L54 30Z" fill="#E8743B"/>' +
      '<path d="M27 38 L28 21 L39 30Z" fill="#3B2A1E"/><path d="M73 38 L72 21 L61 30Z" fill="#3B2A1E"/>' +
      head('#E8743B') + '<path d="M21 58 C30 60 40 66 50 80 C60 66 70 60 79 58 C76 76 62 85 50 85 C38 85 24 76 21 58Z" fill="#FFF3E2"/>' +
      EYES + CHEEK + '<ellipse cx="50" cy="66" rx="4" ry="3" fill="#2A211B"/>' },
    owl: { name: '貓頭鷹', svg: body('#9C7A5B') +
      '<path d="M26 40 L22 18 L40 30Z" fill="#9C7A5B"/><path d="M74 40 L78 18 L60 30Z" fill="#9C7A5B"/>' +
      head('#9C7A5B') + '<circle cx="38" cy="54" r="11" fill="#FFF3E2"/><circle cx="62" cy="54" r="11" fill="#FFF3E2"/>' +
      '<circle cx="38" cy="54" r="11" fill="none" stroke="#F2C14E" stroke-width="3"/><circle cx="62" cy="54" r="11" fill="none" stroke="#F2C14E" stroke-width="3"/>' +
      '<circle cx="38" cy="55" r="5" fill="#2A211B"/><circle cx="62" cy="55" r="5" fill="#2A211B"/>' +
      '<circle cx="39.5" cy="53" r="1.6" fill="#fff"/><circle cx="63.5" cy="53" r="1.6" fill="#fff"/>' +
      '<path d="M46 64 L54 64 L50 71Z" fill="#F4A23B"/>' +
      '<path d="M40 78 Q44 82 48 78 M52 78 Q56 82 60 78" stroke="#7A5C42" stroke-width="2" fill="none"/>' }
  };

  function aisecAnimalSvg(kind, size) {
    const a = AISEC_ANIMALS[kind];
    return `<svg viewBox="0 -8 100 120" width="${size}" height="${size * 1.2}" aria-hidden="true">${a ? a.svg : ''}</svg>`;
  }

  window.AISEC_ROOM = { AISEC_SEATS, AISEC_ANIMALS, aisecIso, aisecRoomStatic, aisecAnimalSvg,
    viewBox: `0 0 ${Math.round((AISEC_W + AISEC_D) * 0.866 * AISEC_U + 40)} ${Math.round((AISEC_W + AISEC_D) * 0.5 * AISEC_U + AISEC_H * AISEC_U + 48)}` };
})();
