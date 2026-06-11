const MAPS_URL = 'https://www.google.com/maps/place/Joyful%E6%8F%AA%E7%A6%8F/@25.0433352,121.5048155,17z/data=!3m1!4b1!4m6!3m5!1s0x3442a900369849f5:0x7aeae59b84ca81fb!8m2!3d25.0433304!4d121.5073904!16s%2Fg%2F11wmt6l4r5';

const T = {
  zh: {
    nav: { menu:'菜單', reserve:'訂位', transport:'交通', wall:'留言', seating:'座位圖' },
    home: { t1:'揪福', t2:'漢堡', sub:'JOYFUL BURGER · TAIWAN', choose:'請選擇語言' },
    langs: ['中文','English','日本語','한국어'],
    menu: {
      h:'精選菜單', p:'每顆漢堡都是揪福對美食的熱情與堅持。',
      fq:'揪福漢堡有哪些招牌菜？',
      fa:'招牌菜：揪福雙層牛肉堡 NT$180、辣雞腿堡 NT$160、培根起司堡 NT$170、蘑菇瑞士起司堡 NT$175、黃金薯條 NT$60。'
    },
    reserve: {
      h:'線上訂位', p:'如何在揪福漢堡線上訂位？填寫表單，24小時內確認。',
      name:'姓名', phone:'聯絡電話', date:'用餐日期', time:'用餐時段', guests:'人數', notes:'特殊需求',
      btn:'送出訂位申請',
      faqH:'訂位常見問題',
      faqs:[
        ['揪福漢堡可以當天訂位嗎？','可以，但建議提前3天預約以確保座位。'],
        ['訂位需要訂金嗎？','一般訂位無需訂金；8人以上大桌請先來電確認。'],
        ['如何取消訂位？','請於用餐2小時前來電，我們將協助更改或取消。']
      ],
      ok:'訂位申請已送出！我們將於24小時內以電話或簡訊確認。'
    },
    transport: {
      h:'交通資訊', p:'如何前往揪福漢堡？多種交通方式，輕鬆抵達。',
      addr:'地址', addrT:'台北市（詳見 Google Maps）',
      mrt:'捷運', mrtT:'搭乘捷運至最近站點，依 Google Maps 步行指引前往。',
      bus:'公車', busT:'搭乘附近公車路線，至揪福漢堡站牌下車。',
      car:'開車', carT:'建議停附近停車場，導航搜尋「Joyful揪福」即可抵達。',
      hours:'營業時間', wd:'週一至週五', we:'週六至週日', wdT:'11:30 – 21:30', weT:'11:00 – 22:00',
      map:'點擊開啟 Google Maps'
    },
    wall: {
      h:'留言照片區', p:'分享你的揪福時光！留言就送薯條 QR Code 一份。',
      nameLbl:'你的名字', msgLbl:'留言內容', photoLbl:'上傳照片（選填）',
      btn:'送出留言，領薯條！',
      qrTitle:'🍟 免費薯條兌換券', qrSub:'出示此 QR Code 給店員，兌換黃金薯條一份',
      qrClose:'關閉', placeholder:'寫下你對揪福的感想...',
      empty:'還沒有留言，快來第一個分享！',
      formTitle:'留下你的足跡', wallTitle:'揪福留言牆'
    },
    seating:{ h:'座位平面圖', p:'選擇喜歡的座位，一鍵訂位。', table:'桌號', seats:'人座', book:'訂位', hint:'點選地圖上的桌子選擇座位', available:'● 可選', selected:'● 已選' }
  },
  en: {
    nav: { menu:'Menu', reserve:'Reserve', transport:'Access', wall:'Wall', seating:'Seats' },
    home: { t1:'Joyful', t2:'Burger', sub:'揪福漢堡 · TAIPEI, TAIWAN', choose:'Select Language' },
    langs: ['中文','English','日本語','한국어'],
    menu: {
      h:'Our Menu', p:'Every burger at Joyful is crafted with passion and the finest ingredients.',
      fq:'What are the signature dishes at Joyful Burger?',
      fa:'Signature items: Double Beef Burger NT$180, Spicy Chicken Burger NT$160, Bacon Cheeseburger NT$170, Mushroom Swiss Burger NT$175, Golden Fries NT$60.'
    },
    reserve: {
      h:'Reservation', p:'How to book a table at Joyful Burger? Fill in the form — confirmed within 24 hours.',
      name:'Name', phone:'Phone', date:'Date', time:'Time', guests:'Guests', notes:'Special Requests',
      btn:'SUBMIT RESERVATION',
      faqH:'Reservation FAQ',
      faqs:[
        ['Can I make a same-day reservation?','Yes, but we recommend booking 3 days ahead to guarantee your seat.'],
        ['Is a deposit required?','No deposit for regular bookings. Groups of 8+ please call us first.'],
        ['How do I cancel my reservation?','Please call at least 2 hours before your reservation time.']
      ],
      ok:'Reservation submitted! We will confirm within 24 hours via phone or SMS.'
    },
    transport: {
      h:'Getting Here', p:'How to get to Joyful Burger? Multiple convenient routes available.',
      addr:'Address', addrT:'Taipei City (see Google Maps for exact location)',
      mrt:'MRT', mrtT:'Take the MRT to the nearest station and follow Google Maps walking directions.',
      bus:'Bus', busT:'Take nearby bus lines and alight at the Joyful Burger stop.',
      car:'By Car', carT:'Use nearby public parking lots. Navigate to "Joyful揪福 Burger."',
      hours:'Opening Hours', wd:'Mon – Fri', we:'Sat – Sun', wdT:'11:30 – 21:30', weT:'11:00 – 22:00',
      map:'Open Google Maps'
    },
    wall: {
      h:'Photo Wall', p:'Share your Joyful moment! Leave a comment and get a FREE fries QR Code.',
      nameLbl:'Your Name', msgLbl:'Your Message', photoLbl:'Upload Photo (optional)',
      btn:'Comment & Get Free Fries!',
      qrTitle:'🍟 Free Fries Coupon', qrSub:'Show this QR Code to our staff to redeem one serving of golden fries',
      qrClose:'Close', placeholder:'Share your Joyful experience...',
      empty:'No comments yet — be the first to share!',
      formTitle:'Leave Your Mark', wallTitle:'Joyful Wall'
    },
    seating:{ h:'Seating Map', p:'Pick your table and reserve instantly.', table:'Table', seats:'seats', book:'Book Now', hint:'Click a table on the map to select it', available:'● Available', selected:'● Selected' }
  },
  ja: {
    nav: { menu:'メニュー', reserve:'予約', transport:'アクセス', wall:'コメント', seating:'席図' },
    home: { t1:'ジョイフル', t2:'バーガー', sub:'揪福漢堡 · 台北, 台湾', choose:'言語を選択' },
    langs: ['中文','English','日本語','한국어'],
    menu: {
      h:'メニュー', p:'情熱とこだわりで作り上げた本格バーガーをお楽しみください。',
      fq:'ジョイフルバーガーの看板メニューは何ですか？',
      fa:'看板メニュー：ダブルビーフバーガー NT$180、スパイシーチキンバーガー NT$160、ベーコンチーズバーガー NT$170、マッシュルームスイスバーガー NT$175、ゴールデンフライ NT$60。'
    },
    reserve: {
      h:'ご予約', p:'ジョイフルバーガーの予約方法は？フォームを送信後、24時間以内にご確認します。',
      name:'お名前', phone:'電話番号', date:'日付', time:'時間', guests:'人数', notes:'ご要望',
      btn:'予約を送信する',
      faqH:'よくある質問',
      faqs:[
        ['当日予約はできますか？','可能ですが、3日前のご予約をお勧めします。'],
        ['予約に保証金は必要ですか？','通常の予約は不要です。8名以上はお電話ください。'],
        ['予約をキャンセルするには？','来店時刻の2時間前までにお電話ください。']
      ],
      ok:'ご予約を受け付けました。24時間以内にお電話またはSMSでご確認いたします。'
    },
    transport: {
      h:'アクセス', p:'ジョイフルバーガーへのアクセス方法は？',
      addr:'住所', addrT:'台北市（Google Maps で詳細確認）',
      mrt:'MRT', mrtT:'最寄り駅からGoogle Mapsの徒歩案内に従ってお越しください。',
      bus:'バス', busT:'近くのバス路線でジョイフルバーガー停留所まで。',
      car:'自動車', carT:'近隣の駐車場をご利用ください。カーナビで「Joyful揪福」と検索。',
      hours:'営業時間', wd:'月〜金', we:'土・日', wdT:'11:30 – 21:30', weT:'11:00 – 22:00',
      map:'Google Maps を開く'
    },
    wall: {
      h:'フォトウォール', p:'ジョイフルの思い出をシェアしよう！コメントを書いてフライドポテト QR コードをゲット！',
      nameLbl:'お名前', msgLbl:'コメント', photoLbl:'写真をアップロード（任意）',
      btn:'コメントして無料ポテトをゲット！',
      qrTitle:'🍟 無料フライドポテト引換券', qrSub:'このQRコードをスタッフに提示してフライドポテット1つと交換',
      qrClose:'閉じる', placeholder:'ジョイフルの感想を書いてください...',
      empty:'まだコメントがありません。最初にシェアしてみましょう！',
      formTitle:'足跡を残そう', wallTitle:'ジョイフル・ウォール'
    },
    seating:{ h:'席レイアウト', p:'テーブルを選んでご予約ください。', table:'テーブル', seats:'席', book:'予約する', hint:'マップのテーブルをクリックして選択', available:'● 空席', selected:'● 選択中' }
  },
  ko: {
    nav: { menu:'메뉴', reserve:'예약', transport:'오시는 길', wall:'후기', seating:'좌석도' },
    home: { t1:'조이풀', t2:'버거', sub:'揪福漢堡 · 타이베이, 대만', choose:'언어를 선택하세요' },
    langs: ['中文','English','日本語','한국어'],
    menu: {
      h:'메뉴', p:'열정과 정성으로 만든 조이풀 버거를 즐겨보세요.',
      fq:'조이풀 버거의 시그니처 메뉴는 무엇인가요?',
      fa:'시그니처 메뉴: 더블 비프 버거 NT$180, 스파이시 치킨 버거 NT$160, 베이컨 치즈버거 NT$170, 머쉬룸 스위스 버거 NT$175, 황금 감자튀김 NT$60.'
    },
    reserve: {
      h:'예약', p:'조이풀 버거 예약 방법은? 양식을 제출하면 24시간 내 확인해 드립니다.',
      name:'이름', phone:'전화번호', date:'날짜', time:'시간', guests:'인원', notes:'요청 사항',
      btn:'예약 제출하기',
      faqH:'자주 묻는 질문',
      faqs:[
        ['당일 예약이 가능한가요?','가능합니다. 하지만 3일 전 예약을 권장합니다.'],
        ['예약금이 필요한가요?','일반 예약은 불필요합니다. 8인 이상은 전화로 문의해 주세요.'],
        ['예약 취소는 어떻게 하나요?','방문 2시간 전까지 전화로 알려주세요.']
      ],
      ok:'예약이 접수되었습니다. 24시간 내에 전화 또는 문자로 확인해 드립니다.'
    },
    transport: {
      h:'오시는 길', p:'조이풀 버거에 오시는 방법은?',
      addr:'주소', addrT:'타이베이시（Google Maps에서 정확한 위치 확인）',
      mrt:'지하철', mrtT:'가장 가까운 역에서 Google Maps 도보 안내를 따라 오세요.',
      bus:'버스', busT:'인근 버스 노선으로 조이풀 버거 정류장에서 하차.',
      car:'자가용', carT:'인근 주차장 이용 가능. 내비게이션에서 "Joyful揪福" 검색.',
      hours:'영업 시간', wd:'월 – 금', we:'토 – 일', wdT:'11:30 – 21:30', weT:'11:00 – 22:00',
      map:'Google Maps 열기'
    },
    wall: {
      h:'후기 & 사진', p:'조이풀의 순간을 공유하세요! 댓글을 남기면 무료 감자튀김 QR 코드를 드립니다.',
      nameLbl:'이름', msgLbl:'메시지', photoLbl:'사진 업로드 (선택)',
      btn:'댓글 작성하고 무료 감자튀김 받기!',
      qrTitle:'🍟 무료 감자튀김 쿠폰', qrSub:'이 QR 코드를 직원에게 보여주시면 황금 감자튀김 1개와 교환해 드립니다',
      qrClose:'닫기', placeholder:'조이풀에 대한 감상을 남겨주세요...',
      empty:'아직 댓글이 없습니다. 첫 번째로 공유해보세요!',
      formTitle:'발자취를 남겨보세요', wallTitle:'조이풀 월'
    },
    seating:{ h:'좌석 배치도', p:'테이블을 선택하고 바로 예약하세요.', table:'테이블', seats:'인석', book:'예약하기', hint:'지도에서 테이블을 클릭하여 선택하세요', available:'● 예약가능', selected:'● 선택됨' }
  }
};

const MENU = [
  { cat:{zh:'招牌',en:'Signature',ja:'看板',ko:'시그니처'}, name:{zh:'揪福雙層牛肉堡',en:'Double Beef Burger',ja:'ダブルビーフバーガー',ko:'더블 비프 버거'}, desc:{zh:'雙層嫩煎牛肉排、特製醬汁、新鮮生菜',en:'Double smash patty, house sauce, fresh lettuce',ja:'ダブルスマッシュパティ、特製ソース',ko:'더블 스매시 패티, 하우스 소스'}, price:'NT$180' },
  { cat:{zh:'雞肉',en:'Chicken',ja:'チキン',ko:'치킨'}, name:{zh:'辣雞腿堡',en:'Spicy Chicken Burger',ja:'スパイシーチキンバーガー',ko:'스파이시 치킨 버거'}, desc:{zh:'炸嫩雞腿、辣醬、脆高麗菜絲',en:'Crispy chicken thigh, spicy sauce, slaw',ja:'クリスピーチキン、スパイシーソース',ko:'크리스피 치킨 허벅지, 매운 소스'}, price:'NT$160' },
  { cat:{zh:'招牌',en:'Signature',ja:'看板',ko:'시그니처'}, name:{zh:'培根起司堡',en:'Bacon Cheeseburger',ja:'ベーコンチーズバーガー',ko:'베이컨 치즈버거'}, desc:{zh:'厚切培根、雙層起司、番茄、洋蔥',en:'Thick-cut bacon, double cheese, tomato',ja:'厚切りベーコン、ダブルチーズ',ko:'두툼한 베이컨, 더블 치즈'}, price:'NT$170' },
  { cat:{zh:'招牌',en:'Signature',ja:'看板',ko:'시그니처'}, name:{zh:'蘑菇瑞士起司堡',en:'Mushroom Swiss Burger',ja:'マッシュルームスイスバーガー',ko:'머쉬룸 스위스 버거'}, desc:{zh:'炒蘑菇、瑞士起司、芥末醬',en:'Sautéed mushrooms, Swiss cheese, mustard',ja:'ソテーマッシュルーム、スイスチーズ',ko:'버섯 볶음, 스위스 치즈'}, price:'NT$175' },
  { cat:{zh:'素食',en:'Veggie',ja:'ベジ',ko:'채식'}, name:{zh:'蔬食酪梨堡',en:'Avocado Veggie Burger',ja:'アボカドベジバーガー',ko:'아보카도 채식 버거'}, desc:{zh:'植物肉排、新鮮酪梨、芝麻葉',en:'Plant patty, fresh avocado, arugula',ja:'植物性パティ、フレッシュアボカド',ko:'식물성 패티, 신선한 아보카도'}, price:'NT$165' },
  { cat:{zh:'配餐',en:'Sides',ja:'サイド',ko:'사이드'}, name:{zh:'黃金薯條',en:'Golden Fries',ja:'ゴールデンフライ',ko:'황금 감자튀김'}, desc:{zh:'酥脆黃金薯條，附招牌沾醬',en:'Crispy golden fries with house dipping sauce',ja:'カリカリゴールデンフライ',ko:'바삭한 황금 감자튀김'}, price:'NT$60' },
  { cat:{zh:'配餐',en:'Sides',ja:'サイド',ko:'사이드'}, name:{zh:'洋蔥圈',en:'Onion Rings',ja:'オニオンリング',ko:'어니언 링'}, desc:{zh:'酥炸洋蔥圈，香脆不油膩',en:'Beer-battered crispy onion rings',ja:'ビール衣のオニオンリング',ko:'맥주 반죽 바삭한 어니언 링'}, price:'NT$70' },
  { cat:{zh:'飲品',en:'Drinks',ja:'ドリンク',ko:'음료'}, name:{zh:'招牌奶昔',en:'Signature Milkshake',ja:'シグネチャーミルクシェイク',ko:'시그니처 밀크쉐이크'}, desc:{zh:'濃郁香草、草莓、巧克力三種口味',en:'Thick vanilla, strawberry or chocolate shake',ja:'バニラ、ストロベリー、チョコの3種類',ko:'바닐라, 딸기, 초콜릿 3가지 맛'}, price:'NT$120' }
];

let lang = 'zh', page = 'home', selectedTable = 0;
const LANGS = ['zh','en','ja','ko'];
let comments = [];

function m(obj) { return obj[lang] || obj.zh; }
function geo() {
  return `<div class="geo geo-sq1"></div><div class="geo geo-sq2"></div>
          <div class="geo geo-bar"></div><div class="geo geo-dot"></div>`;
}
function navbar() {
  const n = T[lang].nav;
  const logo = {zh:'揪福',en:'Joyful',ja:'ジョイフル',ko:'조이풀'}[lang];
  return `<nav>
    <div class="nav-logo"><em>●</em> ${logo}</div>
    <div class="nav-links">
      <a class="${page==='menu'?'active':''}" onclick="go('menu')">${n.menu}</a>
      <a class="${page==='reserve'?'active':''}" onclick="go('reserve')">${n.reserve}</a>
      <a class="${page==='transport'?'active':''}" onclick="go('transport')">${n.transport}</a>
      <a class="${page==='wall'?'active':''}" onclick="go('wall')">${n.wall}</a>
      <a class="${page==='seating'?'active':''}" onclick="go('seating')">${n.seating}</a>
      <span class="nav-globe" onclick="go('home')" title="Language">🌐</span>
    </div>
  </nav>`;
}

function renderHome() {
  const h = T[lang].home;
  return `${geo()}<div class="home">
    <div class="home-stripe"></div>
    <h1 class="home-title"><span class="hl">${h.t1}</span><br>${h.t2}</h1>
    <p class="home-sub">${h.sub}</p>
    <p class="home-choose">${h.choose}</p>
    <div class="lang-grid">
      ${LANGS.map((l,i)=>`<button class="lang-btn" onclick="pick('${l}')">
        <span class="fill"></span><span>${T[lang].langs[i]}</span>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderMenu() {
  const d = T[lang].menu;
  return `${navbar()}${geo()}<div class="page-body">
    <div class="sec-head"><h2>${d.h}</h2><p>${d.p}</p></div>
    <div class="sec-faq"><div class="fq">${d.fq}</div><div class="fa">${d.fa}</div></div>
    <div class="menu-grid">
      ${MENU.map(item=>`<div class="menu-card">
        <div class="mc-cat">${m(item.cat)}</div>
        <div class="mc-name">${m(item.name)}</div>
        <div class="mc-desc">${m(item.desc)}</div>
        <div class="mc-price">${item.price}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderReserve() {
  const r = T[lang].reserve;
  const times = ['11:30','12:00','12:30','13:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30'];
  return `${navbar()}${geo()}<div class="page-body">
    <div class="sec-head"><h2>${r.h}</h2><p>${r.p}</p></div>
    <div class="reserve-wrap">
      <form onsubmit="submitForm(event)">
        <div class="fg-row">
          <div class="fg"><label>${r.name}</label><input type="text" required></div>
          <div class="fg"><label>${r.phone}</label><input type="tel" required></div>
        </div>
        <div class="fg-row">
          <div class="fg"><label>${r.date}</label><input type="date" required></div>
          <div class="fg"><label>${r.time}</label>
            <select required>${times.map(t=>`<option>${t}</option>`).join('')}</select>
          </div>
        </div>
        <div class="fg"><label>${r.guests}</label>
          <select required>${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}">${n}</option>`).join('')}</select>
        </div>
        <div class="fg"><label>${r.notes}</label><textarea rows="3"></textarea></div>
        <button type="submit" class="submit-btn">${r.btn}</button>
      </form>
      <div class="faq-box"><h3>${r.faqH}</h3>
        ${r.faqs.map(([q,a])=>`<div class="faq-item">
          <div class="faq-q">Q: ${q}</div><div class="faq-a">${a}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderTransport() {
  const tr = T[lang].transport;
  return `${navbar()}${geo()}<div class="page-body">
    <div class="sec-head"><h2>${tr.h}</h2><p>${tr.p}</p></div>
    <div class="transport-wrap">
      <div class="tc"><span class="tc-icon">📍</span><h3>${tr.addr}</h3>
        <p>${tr.addrT}</p>
        <div class="map-ph" onclick="window.open('${MAPS_URL}','_blank')">🗺 ${tr.map}</div>
      </div>
      <div class="tc"><span class="tc-icon">🚇</span><h3>${tr.mrt}</h3><p>${tr.mrtT}</p></div>
      <div class="tc"><span class="tc-icon">🚌</span><h3>${tr.bus}</h3><p>${tr.busT}</p></div>
      <div class="tc"><span class="tc-icon">🚗</span><h3>${tr.car}</h3><p>${tr.carT}</p></div>
      <div class="tc"><span class="tc-icon">🕐</span><h3>${tr.hours}</h3>
        <div class="hours">
          <span class="hd">${tr.wd}</span><span class="ht">${tr.wdT}</span>
          <span class="hd">${tr.we}</span><span class="ht">${tr.weT}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function renderWall() {
  const w = T[lang].wall;
  const photoCards = comments.filter(c=>c.photo).length
    ? comments.filter(c=>c.photo).map(c=>`<div class="wall-photo-card">
        <img src="${c.photo}" alt="${c.name}">
        <div class="wpc-overlay"><strong>${c.name}</strong><span>${c.msg.slice(0,30)}${c.msg.length>30?'…':''}</span></div>
      </div>`).reverse().join('')
    : '';
  const textCards = comments.map(c=>`<div class="wall-card">
      <div class="wall-meta"><strong>${c.name}</strong><span>${c.time}</span></div>
      ${c.photo?`<img class="wall-card-img" src="${c.photo}" alt="photo">`:''}
      <p class="wall-msg">${c.msg}</p>
    </div>`).reverse().join('');
  const rightContent = comments.length
    ? `${photoCards?`<div class="wall-mosaic">${photoCards}</div>`:''}
       <div class="wall-list">${textCards}</div>`
    : `<div class="wall-empty-box"><div class="wall-empty-icon">📸</div><p>${w.empty}</p></div>`;
  return `${navbar()}${geo()}<div class="page-body">
    <div class="sec-head"><h2>${w.h}</h2><p>${w.p}</p></div>
    <div class="wall-split">
      <div class="wall-left">
        <div class="wall-left-label">${w.formTitle||'✍️'}</div>
        <form class="wall-form" onsubmit="submitComment(event)">
          <div class="fg"><label>${w.nameLbl}</label><input type="text" id="wName" required></div>
          <div class="fg"><label>${w.photoLbl}</label>
            <input type="file" id="wPhoto" accept="image/*" onchange="previewPhoto(this)">
          </div>
          <div id="photoPreview" class="photo-preview-wrap" style="display:none">
            <img id="photoPreviewImg" alt="preview">
            <button type="button" class="photo-remove" onclick="removePhoto()">✕</button>
          </div>
          <div class="fg"><label>${w.msgLbl}</label>
            <textarea id="wMsg" rows="4" placeholder="${w.placeholder}" required></textarea>
          </div>
          <button type="submit" class="submit-btn wall-submit-btn">${w.btn}</button>
        </form>
      </div>
      <div class="wall-right">
        <div class="wall-right-label">${w.wallTitle||'🧱'}</div>
        <div class="wall-right-content">${rightContent}</div>
      </div>
    </div>
  </div>
  <div id="qrModal" class="qr-modal" style="display:none" onclick="closeQR(event)">
    <div class="qr-box">
      <div class="qr-title" id="qrTitle"></div>
      <img id="qrImg" src="" alt="QR Code" class="qr-img">
      <div class="qr-code-text" id="qrCodeText"></div>
      <p class="qr-sub" id="qrSub"></p>
      <button class="qr-close-btn" onclick="closeQR()">${w.qrClose}</button>
    </div>
  </div>`;
}

function previewPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('photoPreviewImg').src = e.target.result;
    document.getElementById('photoPreview').style.display = 'flex';
  };
  reader.readAsDataURL(input.files[0]);
}
function removePhoto() {
  document.getElementById('wPhoto').value = '';
  document.getElementById('photoPreview').style.display = 'none';
}

function submitComment(e) {
  e.preventDefault();
  const name = document.getElementById('wName').value.trim();
  const msg = document.getElementById('wMsg').value.trim();
  const photoInput = document.getElementById('wPhoto');
  const code = 'JOYFUL-' + Date.now().toString(36).toUpperCase();
  const coupon = `Joyful揪福 免費薯條 Free Fries ${code}`;

  const saveThenShow = (photoDataUrl) => {
    const now = new Date();
    const time = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    comments.push({ name, msg, photo: photoDataUrl || null, time });
    e.target.reset();
    render();
    showQR(coupon, code);
  };

  if (photoInput.files && photoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = ev => saveThenShow(ev.target.result);
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    saveThenShow(null);
  }
}

function showQR(couponText, code) {
  const w = T[lang].wall;
  const modal = document.getElementById('qrModal');
  document.getElementById('qrTitle').textContent = w.qrTitle;
  document.getElementById('qrSub').textContent = w.qrSub;
  document.getElementById('qrCodeText').textContent = code;
  modal.style.display = 'flex';
  QRCode.toDataURL(couponText, { width: 220, color: { dark: '#FF006E', light: '#ffffff' } })
    .then(url => { document.getElementById('qrImg').src = url; })
    .catch(() => {});
}
function closeQR(e) {
  if (!e || e.target === document.getElementById('qrModal') || !e.target.closest) {
    document.getElementById('qrModal').style.display = 'none';
  }
}

function renderSeating() {
  const s=T[lang].seating;
  const CW=120,CH=60,OX=360,OY=140,TH=20,WH=60;
  const iso=(c,r)=>[OX+(c-r)*CW/2,OY+(c+r)*CH/2];
  const box=(c,r,w,d,h,tc,lc,fc,id,lb)=>{
    const[ax,ay]=iso(c,r),[bx,by]=iso(c+w,r),[cx,cy]=iso(c+w,r+d),[dx,dy]=iso(c,r+d);
    const ev=id?`onclick="selectTable(${id})" style="cursor:pointer"`:'';
    return `<g ${ev}>`+
      `<polygon points="${ax},${ay} ${dx},${dy} ${dx},${dy+h} ${ax},${ay+h}" fill="${lc}" stroke="white" stroke-width="0.8"/>`+
      `<polygon points="${dx},${dy} ${cx},${cy} ${cx},${cy+h} ${dx},${dy+h}" fill="${fc}" stroke="white" stroke-width="0.8"/>`+
      `<polygon points="${ax},${ay} ${bx},${by} ${cx},${cy} ${dx},${dy}" fill="${tc}" stroke="white" stroke-width="1.5"/>`+
      (lb?`<text x="${(ax+bx+cx+dx)/4}" y="${(ay+by+cy+dy)/4+5}" text-anchor="middle" font-size="11" fill="#444" font-weight="bold" pointer-events="none">${lb}</text>`:'')
      +'</g>';
  };
  const ch=(pc,pr)=>{const[x,y]=iso(pc,pr);return`<ellipse cx="${x}" cy="${y}" rx="9" ry="5" fill="#BF7040" stroke="white" stroke-width="1"/>`;};
  const ch4=(c,r)=>ch(c+.5,r-.2)+ch(c+.5,r+1.2)+ch(c-.2,r+.5)+ch(c+1.2,r+.5);
  const TBLS=[[1,0,0],[2,1,0],[3,2,0],[4,3,0],[5,0,1],[6,2,1],[7,3,1],[8,0,2],[9,2,2],[10,3,2]];
  const sel=selectedTable;
  const[f0x,f0y]=iso(0,0),[f1x,f1y]=iso(4,0),[f2x,f2y]=iso(4,3),[f3x,f3y]=iso(0,3);
  const[w0x,w0y]=iso(0,0),[w1x,w1y]=iso(4,0);
  const bwall=`<polygon points="${w0x},${w0y} ${w1x},${w1y} ${w1x},${w1y-WH} ${w0x},${w0y-WH}" fill="#EAF8FA" stroke="#00F0FF" stroke-width="2"/>`;
  const ww=(w1x-w0x)/3;
  const wins=[0,1,2].map(i=>`<rect x="${w0x+i*ww+5}" y="${w0y-WH+10}" width="${ww-10}" height="${WH-20}" fill="#A8E8F8" stroke="#00F0FF" stroke-width="1.5" rx="3"/>`).join('');
  const floor=`<polygon points="${f0x},${f0y} ${f1x},${f1y} ${f2x},${f2y} ${f3x},${f3y}" fill="#F2F2EE" stroke="#ddd"/>`;
  const ctr=box(1,1,1,2,TH+14,'#D4AA7A','#B88A4E','#C99555',0,'');
  const objs=[...TBLS.map(([id,c,r])=>({id,c,r,z:c+r})),{id:0,c:1,r:1,z:3,isCtr:true}];
  objs.sort((a,b)=>a.z-b.z||(b.c-a.c));
  const tSVG=objs.map(o=>o.isCtr?ctr:(ch4(o.c,o.r)+box(o.c,o.r,1,1,TH,sel===o.id?'#00F0FF':'#fff',sel===o.id?'#00BFD8':'#FFB3D1',sel===o.id?'#009AB0':'#FF80B0',o.id,`${o.id}`))).join('');
  const[drx,dry]=iso(4,2.8);
  const[crx,cry]=iso(1.5,2.2);
  const info=sel
    ?`<div class="seat-info"><span class="seat-num">${s.table} ${sel}</span><span class="seat-seats">· 4 ${s.seats}</span><button class="submit-btn seat-book" onclick="go('reserve')">${s.book}</button></div>`
    :`<p class="seat-hint">${s.hint}</p>`;
  return `${navbar()}${geo()}<div class="page-body">
    <div class="sec-head"><h2>${s.h}</h2><p>${s.p}</p></div>
    ${info}
    <div class="seat-wrap"><svg viewBox="0 0 720 420" class="seat-svg">
      ${bwall}${wins}${floor}${tSVG}
      <text x="${drx}" y="${dry+8}" font-size="10" fill="#bbb" font-family="sans-serif" text-anchor="middle">▼ DOOR</text>
      <text x="${crx}" y="${cry}" font-size="9" fill="#a07040" font-family="sans-serif" text-anchor="middle" font-weight="bold">COUNTER</text>
    </svg>
    <div class="seat-legend"><span class="sl-avail">${s.available}</span><span class="sl-sel">${s.selected}</span></div>
    </div></div>`;
}
function selectTable(id){selectedTable=id;render();}

function render() {
  const app = document.getElementById('app');
  const pages = { home:renderHome, menu:renderMenu, reserve:renderReserve, transport:renderTransport, wall:renderWall, seating:renderSeating };
  app.innerHTML = pages[page]();
  window.scrollTo(0, 0);
}
function pick(l) { lang = l; go('menu'); }
function go(p) { page = p; render(); }
function submitForm(e) {
  e.preventDefault();
  const toast = document.createElement('div');
  toast.className = 'toast'; toast.textContent = T[lang].reserve.ok;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
  e.target.reset();
}

render();
