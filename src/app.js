const MAPS_URL = 'https://www.google.com/maps/place/Joyful%E6%8F%AA%E7%A6%8F/@25.0433352,121.5048155,17z/data=!3m1!4b1!4m6!3m5!1s0x3442a900369849f5:0x7aeae59b84ca81fb!8m2!3d25.0433304!4d121.5073904!16s%2Fg%2F11wmt6l4r5';

const T = {
  zh: {
    nav: { menu:'菜單', reserve:'訂位', transport:'交通', wall:'留言', seating:'座位圖' },
    home: { t1:'揪福', t2:'漢堡', sub:'JOYFUL BURGER · TAIWAN', choose:'請選擇語言' },
    langs: ['中文','English','日本語','한국어'],
    menu: {
      h:'精選菜單', p:'義大利麵、漢堡、炸物、飲品，每道料理都是揪福對美食的熱情與堅持。',
      fq:'揪福的招牌菜有哪些？',
      fa:'招牌推薦：★ 粉紅鮮蝦干貝義大利麵 $350、★ 茄汁菌菇雞肉義大利麵 $240、★ 蛋汁奶油培根義大利麵 $240、★ 招牌花生牛肉起司堡 $280起、★ 焦糖炸雞堡 $260、★ 熔岩起司脆薯 $140。每人低消 $200，不收服務費。'
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
      h:'Our Menu', p:'Pasta, burgers, fried bites & drinks — crafted with passion at every table.',
      fq:"What are Joyful's signature dishes?",
      fa:'Recommended: ★ Pink Prawn & Scallop Pasta $350, ★ Tomato Mushroom Chicken Pasta $240, ★ Carbonara $240, ★ Joyful Peanut Beef Burger from $280, ★ Caramel Crispy Chicken Burger $260, ★ Molten Cheese Fries $140. Min. $200/person, no service charge.'
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
      h:'メニュー', p:'パスタ・バーガー・揚げ物・ドリンク、情熱を込めた一皿一皿。',
      fq:'ジョイフルの看板メニューは何ですか？',
      fa:'おすすめ：★ 海老ホタテのピンクソースパスタ $350、★ トマトきのこ鶏パスタ $240、★ カルボナーラ $240、★ 招牌ピーナッツビーフバーガー $280〜、★ キャラメルチキンバーガー $260、★ チーズフォンデュフライ $140。'
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
      h:'메뉴', p:'파스타, 버거, 튀김, 음료 — 열정으로 만든 모든 메뉴.',
      fq:'조이풀의 시그니처 메뉴는 무엇인가요?',
      fa:'추천 메뉴: ★ 핑크소스 새우 가리비 파스타 $350, ★ 토마토 버섯 치킨 파스타 $240, ★ 카르보나라 $240, ★ 땅콩 비프 치즈버거 $280~, ★ 캐러멜 치킨 버거 $260, ★ 녹은 치즈 감자튀김 $140. 1인 최소 $200, 서비스료 없음.'
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
  // Pasta — Pink Sauce
  {cat:{zh:'粉紅醬麵',en:'Pink Sauce Pasta'},name:{zh:'粉紅肉醬洋菇義大利麵',en:'Pink Meat & Mushroom Pasta'},desc:{zh:'肉醬、洋菇、粉紅醬',en:'Meat sauce, mushroom, pink cream'},price:'$240'},
  {cat:{zh:'粉紅醬麵',en:'Pink Sauce Pasta'},name:{zh:'粉紅菌菇雞肉義大利麵',en:'Pink Mushroom Chicken Pasta'},desc:{zh:'嫩雞、什菇、粉紅醬',en:'Chicken, mushrooms, pink sauce'},price:'$280'},
  {cat:{zh:'粉紅醬麵',en:'Pink Sauce Pasta'},name:{zh:'粉紅鮮蝦干貝義大利麵',en:'Pink Prawn & Scallop Pasta'},desc:{zh:'新鮮蝦仁、干貝、粉紅醬',en:'Fresh prawns, scallops, pink sauce'},price:'$350',tag:'★'},
  // Pasta — Tomato Sauce
  {cat:{zh:'紅醬麵',en:'Tomato Pasta'},name:{zh:'茄汁肉醬義大利麵',en:'Tomato Meat Sauce Pasta'},desc:{zh:'番茄肉醬',en:'Tomato meat sauce'},price:'$220'},
  {cat:{zh:'紅醬麵',en:'Tomato Pasta'},name:{zh:'茄汁菌菇雞肉義大利麵',en:'Tomato Mushroom Chicken Pasta'},desc:{zh:'嫩雞、什菇、番茄醬',en:'Chicken, mushrooms, tomato'},price:'$240',tag:'★'},
  {cat:{zh:'紅醬麵',en:'Tomato Pasta'},name:{zh:'番茄海鮮義大利麵',en:'Tomato Seafood Pasta'},desc:{zh:'什錦海鮮、番茄醬',en:'Mixed seafood, tomato sauce'},price:'$280'},
  // Pasta — Cream Sauce
  {cat:{zh:'白醬麵',en:'Cream Pasta'},name:{zh:'蛋汁奶油培根義大利麵',en:'Carbonara'},desc:{zh:'培根、蛋汁、奶油醬',en:'Bacon, egg, cream sauce'},price:'$240',tag:'★'},
  {cat:{zh:'白醬麵',en:'Cream Pasta'},name:{zh:'奶油菌菇雞肉義大利麵',en:'Creamy Mushroom Chicken Pasta'},desc:{zh:'嫩雞、什菇、奶油醬',en:'Chicken, mushrooms, cream'},price:'$260'},
  {cat:{zh:'白醬麵',en:'Cream Pasta'},name:{zh:'奶油海鮮義大利麵',en:'Creamy Seafood Pasta'},desc:{zh:'什錦海鮮、奶油醬',en:'Mixed seafood, cream'},price:'$280'},
  {cat:{zh:'白醬麵',en:'Cream Pasta'},name:{zh:'奶油鮮蔬義大利麵',en:'Creamy Veggie Pasta'},desc:{zh:'新鮮時蔬、奶油醬',en:'Fresh vegetables, cream'},price:'$220'},
  // Pasta — Spicy Cream
  {cat:{zh:'辣奶油麵',en:'Spicy Cream Pasta'},name:{zh:'辣奶油菌菇雞肉義大利麵',en:'Spicy Creamy Mushroom Chicken Pasta'},desc:{zh:'嫩雞、什菇、辣奶油醬',en:'Chicken, mushrooms, spicy cream'},price:'$260',tag:'🌶️'},
  {cat:{zh:'辣奶油麵',en:'Spicy Cream Pasta'},name:{zh:'辣奶油海鮮義大利麵',en:'Spicy Creamy Seafood Pasta'},desc:{zh:'什錦海鮮、辣奶油醬',en:'Mixed seafood, spicy cream'},price:'$280',tag:'🌶️'},
  // Pasta — Pesto
  {cat:{zh:'青醬麵',en:'Pesto Pasta'},name:{zh:'青醬培根義大利麵',en:'Pesto Bacon Pasta'},desc:{zh:'培根、青醬',en:'Bacon, pesto sauce'},price:'$240',tag:'★'},
  {cat:{zh:'青醬麵',en:'Pesto Pasta'},name:{zh:'青醬雞肉義大利麵',en:'Pesto Chicken Pasta'},desc:{zh:'嫩雞、青醬',en:'Chicken, pesto'},price:'$260'},
  {cat:{zh:'青醬麵',en:'Pesto Pasta'},name:{zh:'青醬海鮮義大利麵',en:'Pesto Seafood Pasta'},desc:{zh:'什錦海鮮、青醬',en:'Mixed seafood, pesto'},price:'$280'},
  // Pasta — Orzo
  {cat:{zh:'米型麵',en:'Orzo'},name:{zh:'粉紅菌菇雞肉米型麵',en:'Pink Mushroom Chicken Orzo'},desc:{zh:'嫩雞、什菇、粉紅醬',en:'Chicken, mushrooms, pink sauce'},price:'$260',tag:'★'},
  {cat:{zh:'米型麵',en:'Orzo'},name:{zh:'松露野菇米型麵',en:'Truffle Wild Mushroom Orzo'},desc:{zh:'松露油、野菇',en:'Truffle oil, wild mushrooms'},price:'$280'},
  {cat:{zh:'米型麵',en:'Orzo'},name:{zh:'青醬培根米型麵',en:'Pesto Bacon Orzo'},desc:{zh:'培根、青醬',en:'Bacon, pesto'},price:'$260'},
  {cat:{zh:'米型麵',en:'Orzo'},name:{zh:'義式巴薩米可雞柳米型麵',en:'Balsamic Chicken Orzo'},desc:{zh:'雞柳、巴薩米可醋',en:'Chicken strips, balsamic'},price:'$300'},
  // Pasta — Stir-Fried
  {cat:{zh:'清炒麵',en:'Stir-Fried Pasta'},name:{zh:'清炒鮮蔬義大利麵',en:'Stir-Fried Veggie Pasta'},desc:{zh:'新鮮時蔬',en:'Fresh seasonal vegetables'},price:'$220'},
  {cat:{zh:'清炒麵',en:'Stir-Fried Pasta'},name:{zh:'蒜頭小魚乾辣椒麵',en:'Garlic Anchovy Chili Pasta'},desc:{zh:'蒜香、小魚乾、辣椒',en:'Garlic, anchovies, chili'},price:'$260',tag:'🌶️'},
  {cat:{zh:'清炒麵',en:'Stir-Fried Pasta'},name:{zh:'蒜香梅花豬義大利麵',en:'Garlic Pork Pasta'},desc:{zh:'梅花豬、蒜香',en:'Pork collar, garlic'},price:'$260',tag:'🌶️'},
  {cat:{zh:'清炒麵',en:'Stir-Fried Pasta'},name:{zh:'白酒蛤蜊義大利麵',en:'White Wine Clam Pasta'},desc:{zh:'新鮮蛤蜊、白酒',en:'Fresh clams, white wine'},price:'$260',tag:'★'},
  // Burger
  {cat:{zh:'漢堡',en:'Burger'},name:{zh:'招牌Joyful花生牛肉起司堡（附脆薯）',en:'Joyful Peanut Beef Cheeseburger (w/ Fries)'},desc:{zh:'花生醬、牛肉排、起司 · 單層$280 / 雙層$320',en:'Peanut butter, beef patty, cheese · Single $280 / Double $320'},price:'$280 / $320',tag:'★'},
  {cat:{zh:'漢堡',en:'Burger'},name:{zh:'焦糖海鹽熔岩炸雞堡（附脆薯）',en:'Caramel Sea Salt Crispy Chicken Burger (w/ Fries)'},desc:{zh:'炸雞腿、焦糖海鹽、熔岩起司',en:'Crispy chicken, caramel sea salt, molten cheese'},price:'$260',tag:'★'},
  {cat:{zh:'漢堡',en:'Burger'},name:{zh:'經典肉醬牛肉起司堡（附脆薯）',en:'Classic Meat Sauce Beef Cheeseburger (w/ Fries)'},desc:{zh:'肉醬、牛肉排、起司',en:'Meat sauce, beef patty, cheese'},price:'$260'},
  {cat:{zh:'漢堡',en:'Burger'},name:{zh:'罪純粹牛肉起司堡（附脆薯）',en:'Pure Beef Cheeseburger (w/ Fries)'},desc:{zh:'純牛肉排、雙層起司',en:'Pure beef patty, double cheese'},price:'$260'},
  {cat:{zh:'漢堡',en:'Burger'},name:{zh:'傲椒薯餅青醬炒菇堡 素（附脆薯）',en:'Veggie Hashbrown Pesto Mushroom Burger (w/ Fries)'},desc:{zh:'素食 · 薯餅、青醬、炒菇',en:'Vegan · Hashbrown, pesto, mushrooms'},price:'$220'},
  {cat:{zh:'漢堡',en:'Burger'},name:{zh:'墨西哥辣椒蕈菇牛肉起司堡（附脆薯）',en:'Jalapeño Mushroom Beef Burger (w/ Fries)'},desc:{zh:'墨西哥辣椒、蕈菇、牛肉排',en:'Jalapeño, mushrooms, beef patty'},price:'$300',tag:'🌶️'},
  {cat:{zh:'漢堡',en:'Burger'},name:{zh:'塔塔巧滋蟹肉魚排堡（附脆薯）',en:'Tartar Crab Fish Burger (w/ Fries)'},desc:{zh:'魚排、蟹肉、塔塔醬',en:'Fish fillet, crab meat, tartar sauce'},price:'$240'},
  {cat:{zh:'漢堡加點',en:'Add-On'},name:{zh:'加美式炒蛋',en:'Add Scrambled Egg'},desc:{zh:'搭配任意漢堡加購',en:'Add to any burger'},price:'+$20'},
  // Combo
  {cat:{zh:'升級套餐',en:'Combo'},name:{zh:'A 套餐：濃湯 ＋ 飲品',en:'Combo A: Soup + Drink'},desc:{zh:'加購濃湯與飲品 ($80值)',en:'Add soup and drink ($80 value)'},price:'+$89'},
  {cat:{zh:'升級套餐',en:'Combo'},name:{zh:'B 套餐：炸物 ＋ 飲品',en:'Combo B: Fried Side + Drink'},desc:{zh:'脆薯/薯球/雞塊三選一 ＋ 飲品',en:'Fries / Potato balls / Nuggets + Drink'},price:'+$129'},
  {cat:{zh:'升級套餐',en:'Combo'},name:{zh:'C 套餐：洋蔥圈或雞柳 ＋ 湯 ＋ 飲品',en:'Combo C: Onion Rings or Chicken Strips + Soup + Drink'},desc:{zh:'洋蔥圈/雞柳條二選一 ＋ 濃湯 ＋ 飲品',en:'Onion rings / chicken strips + soup + drink'},price:'+$169'},
  // Fried & Soup
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'黃金脆薯',en:'Golden Fries'},desc:{zh:'酥脆黃金薯條',en:'Crispy golden fries'},price:'$120'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'美式炸薯球',en:'Potato Balls'},desc:{zh:'外酥內軟薯球',en:'Crispy outside, soft inside'},price:'$120'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'美式雞塊',en:'Chicken Nuggets'},desc:{zh:'外脆內嫩雞塊',en:'Crispy chicken nuggets'},price:'$120'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'熔岩起司脆薯',en:'Molten Cheese Fries'},desc:{zh:'起司熔岩淋醬脆薯',en:'Fries with molten cheese sauce'},price:'$140',tag:'★'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'松露薯條',en:'Truffle Fries'},desc:{zh:'松露油香薯條',en:'Truffle oil fries'},price:'$160'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'經典肉醬起司脆薯',en:'Meat Sauce Cheese Fries'},desc:{zh:'肉醬、起司、脆薯',en:'Meat sauce, cheese, fries'},price:'$180'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'經典洋蔥圈',en:'Classic Onion Rings'},desc:{zh:'酥脆洋蔥圈',en:'Crispy onion rings'},price:'$160',tag:'★'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'美式雞柳條',en:'Chicken Strips'},desc:{zh:'外酥雞柳條',en:'Crispy chicken strips'},price:'$160'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'揪福雞翅',en:'Joyful Chicken Wings'},desc:{zh:'2支$90 / 5支$200',en:'2 pcs $90 / 5 pcs $200'},price:'$90 / $200',tag:'★'},
  {cat:{zh:'炸物',en:'Fried'},name:{zh:'任性三拼盤',en:'Trio Platter'},desc:{zh:'肉醬薯條、洋蔥圈、雞塊',en:'Meat sauce fries, onion rings, nuggets'},price:'$280'},
  {cat:{zh:'湯品',en:'Soup'},name:{zh:'玉米濃湯',en:'Corn Chowder'},desc:{zh:'香濃玉米濃湯',en:'Creamy corn chowder'},price:'$70'},
  // Drinks
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'紅茶',en:'Black Tea (I/H)'},desc:{zh:'冰/熱',en:'Iced or Hot'},price:'$60'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'奶茶',en:'Milk Tea (I/H)'},desc:{zh:'冰/熱',en:'Iced or Hot'},price:'$60'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'無糖綠茶',en:'Unsweetened Green Tea (I)'},desc:{zh:'冰飲',en:'Iced'},price:'$60'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'可樂',en:'Cola'},desc:{zh:'罐裝',en:'Can'},price:'$80'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'雪碧',en:'Sprite'},desc:{zh:'罐裝',en:'Can'},price:'$80'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'蘋果汁',en:'Apple Juice'},desc:{zh:'',en:''},price:'$80'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'可爾必思',en:'Calpis'},desc:{zh:'',en:''},price:'$80'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'可可亞',en:'Cocoa (I/H)'},desc:{zh:'冰/熱',en:'Iced or Hot'},price:'$80'},
  {cat:{zh:'飲品',en:'Drinks'},name:{zh:'玉米鬚茶',en:'Corn Silk Tea (H)'},desc:{zh:'熱飲',en:'Hot'},price:'$80'},
  {cat:{zh:'咖啡',en:'Coffee'},name:{zh:'美式咖啡',en:'Americano (I/H)'},desc:{zh:'冰/熱',en:'Iced or Hot'},price:'$100',tag:'★'},
  {cat:{zh:'咖啡',en:'Coffee'},name:{zh:'拿鐵',en:'Latte (I/H)'},desc:{zh:'冰/熱',en:'Iced or Hot'},price:'$120'},
  {cat:{zh:'咖啡',en:'Coffee'},name:{zh:'卡布奇諾',en:'Cappuccino (H)'},desc:{zh:'熱',en:'Hot'},price:'$120'},
  {cat:{zh:'康普茶',en:'Kombucha'},name:{zh:'接骨木蘋果康普茶',en:'Elderflower Apple Kombucha'},desc:{zh:'有機釀造',en:'Organically brewed'},price:'$160',tag:'★'},
  {cat:{zh:'康普茶',en:'Kombucha'},name:{zh:'有機高山葡萄康普茶',en:'Organic Alpine Grape Kombucha'},desc:{zh:'有機釀造',en:'Organically brewed'},price:'$160'},
  {cat:{zh:'康普茶',en:'Kombucha'},name:{zh:'白毫茉莉康普茶',en:'White Tea Jasmine Kombucha'},desc:{zh:'有機釀造',en:'Organically brewed'},price:'$160',tag:'★'},
  {cat:{zh:'康普茶',en:'Kombucha'},name:{zh:'鐵觀音康普茶',en:'Tieguanyin Kombucha'},desc:{zh:'有機釀造',en:'Organically brewed'},price:'$160'},
  {cat:{zh:'精釀啤酒',en:'Craft Beer'},name:{zh:'吐司去邊大冰紅啤酒',en:'Red Ale'},desc:{zh:'手工精釀',en:'Craft brewed'},price:'$180'},
  {cat:{zh:'精釀啤酒',en:'Craft Beer'},name:{zh:'芭樂鹽小麥啤酒',en:'Guava Salt Wheat Beer'},desc:{zh:'手工精釀',en:'Craft brewed'},price:'$180'},
  {cat:{zh:'精釀啤酒',en:'Craft Beer'},name:{zh:'浪花朵朵啤酒',en:'Foam Waves Beer'},desc:{zh:'手工精釀',en:'Craft brewed'},price:'$180',tag:'★'},
  {cat:{zh:'精釀啤酒',en:'Craft Beer'},name:{zh:'極夏365啤酒',en:'Summer 365 Beer'},desc:{zh:'手工精釀',en:'Craft brewed'},price:'$180'},
  {cat:{zh:'精釀啤酒',en:'Craft Beer'},name:{zh:'撥雲見日萊姆仙島',en:'Lime Island Sour Beer'},desc:{zh:'萊姆酸啤',en:'Lime sour craft beer'},price:'$200',tag:'★'},
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
  const policy = {zh:'🐾 寵物友善 · 每人低消 $200 · 用餐90分鐘 · 自取餐具 · 不收服務費',en:'🐾 Pet-friendly · Min. $200/person · 90-min limit · Self-serve utensils · No service charge',ja:'🐾 ペット可 · 最低注文 $200/人 · 90分制 · セルフサービス · サービス料なし',ko:'🐾 반려동물 환영 · 1인 최소 $200 · 90분 제한 · 셀프서비스 · 서비스료 없음'}[lang];
  const SECS = [
    {label:{zh:'套餐',en:'Combo',ja:'セット',ko:'세트'}, cats:['升級套餐']},
    {label:{zh:'漢堡',en:'Burger',ja:'バーガー',ko:'버거'}, cats:['漢堡','漢堡加點']},
    {label:{zh:'義大利麵',en:'Pasta',ja:'パスタ',ko:'파스타'}, cats:['粉紅醬麵','紅醬麵','白醬麵','辣奶油麵','青醬麵','米型麵','清炒麵']},
    {label:{zh:'炸物 & 湯品',en:'Fried & Soup',ja:'揚げ物・スープ',ko:'튀김 & 수프'}, cats:['炸物','湯品']},
    {label:{zh:'飲料',en:'Drinks',ja:'ドリンク',ko:'음료'}, cats:['飲品','咖啡','康普茶','精釀啤酒']},
  ];
  const card = i => `<div class="menu-card${i.tag?.includes('★')?' mc-rec':''}">
    <div class="mc-top"><div class="mc-cat">${m(i.cat)}</div>${i.tag?`<div class="mc-badge">${i.tag}</div>`:''}</div>
    <div class="mc-name">${m(i.name)}</div>
    <div class="mc-desc">${m(i.desc)}</div>
    <div class="mc-price">${i.price}</div>
  </div>`;
  const sections = SECS.map(sec => {
    const items = MENU.filter(i => sec.cats.includes(i.cat.zh));
    if (!items.length) return '';
    return `<div class="menu-sec">
      <h3 class="menu-sec-h"><span>${m(sec.label)}</span></h3>
      <div class="menu-grid">${items.map(card).join('')}</div>
    </div>`;
  }).join('');
  return `${navbar()}${geo()}<div class="page-body">
    <div class="sec-head"><h2>${d.h}</h2><p>${d.p}</p></div>
    <div class="sec-faq"><div class="fq">${d.fq}</div><div class="fa">${d.fa}</div></div>
    ${sections}
    <div class="menu-policy">${policy}</div>
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
  const CW=148,CH=74,OX=375,OY=148,TH=24,WH=68;
  const iso=(c,r)=>[OX+(c-r)*CW/2,OY+(c+r)*CH/2];

  // Draw an isometric box; onclick on each polygon for reliable click
  const box=(c,r,w,d,h,tc,lc,fc,id)=>{
    const[ax,ay]=iso(c,r),[bx,by]=iso(c+w,r);
    const[px,py]=iso(c+w,r+d),[qx,qy]=iso(c,r+d);
    const ccx=(ax+bx+px+qx)/4, ccy=(ay+by+py+qy)/4;
    const oc=id?`onclick="selectTable(${id})" style="cursor:pointer"`:'';
    const sel=selectedTable===id&&id;
    const badgeFill=sel?'#006080':'#FF006E';
    return `<g>
      <polygon ${oc} points="${ax},${ay} ${qx},${qy} ${qx},${qy+h} ${ax},${ay+h}" fill="${lc}" stroke="white" stroke-width="0.8"/>
      <polygon ${oc} points="${qx},${qy} ${px},${py} ${px},${py+h} ${qx},${qy+h}" fill="${fc}" stroke="white" stroke-width="0.8"/>
      <polygon ${oc} points="${ax},${ay} ${bx},${by} ${px},${py} ${qx},${qy}" fill="${tc}" stroke="${sel?'#00F0FF':'#ddd'}" stroke-width="${sel?3:1.5}"/>
      ${id?`<ellipse cx="${ccx}" cy="${ccy}" rx="16" ry="10" fill="${badgeFill}" pointer-events="none"/>
      <text x="${ccx}" y="${ccy+4}" text-anchor="middle" font-size="13" fill="white" font-weight="900" font-family="sans-serif" pointer-events="none">${id}</text>`:''}
    </g>`;
  };

  // Chairs as small ellipses
  const ch=(pc,pr)=>{const[x,y]=iso(pc,pr);return`<ellipse cx="${x}" cy="${y}" rx="10" ry="6" fill="#BF7040" stroke="white" stroke-width="1.2"/>`;};
  const ch4=(c,r)=>ch(c+.5,r-.22)+ch(c+.5,r+1.22)+ch(c-.22,r+.5)+ch(c+1.22,r+.5);

  const TBLS=[[1,0,0],[2,1,0],[3,2,0],[4,3,0],[5,0,1],[6,2,1],[7,3,1],[8,0,2],[9,2,2],[10,3,2]];
  const sel=selectedTable;
  const[f0x,f0y]=iso(0,0),[f1x,f1y]=iso(4,0),[f2x,f2y]=iso(4,3),[f3x,f3y]=iso(0,3);
  const[w0x,w0y]=iso(0,0),[w1x,w1y]=iso(4,0);

  // Back wall with windows
  const bwall=`<polygon points="${w0x},${w0y} ${w1x},${w1y} ${w1x},${w1y-WH} ${w0x},${w0y-WH}" fill="#E6F7FA" stroke="#00F0FF" stroke-width="2.5"/>`;
  const ww=(w1x-w0x)/3;
  const wins=[0,1,2].map(i=>`<rect x="${w0x+i*ww+6}" y="${w0y-WH+10}" width="${ww-12}" height="${WH-20}" fill="#8DE8FF" stroke="#00F0FF" stroke-width="2" rx="4" opacity="0.85"/>`).join('');
  const winLbl=`<text x="${(w0x+w1x)/2}" y="${w0y-WH/2+4}" text-anchor="middle" font-size="11" fill="#0090AA" font-family="sans-serif" font-weight="bold" pointer-events="none">🪟 WINDOW</text>`;

  // Floor
  const floor=`<polygon points="${f0x},${f0y} ${f1x},${f1y} ${f2x},${f2y} ${f3x},${f3y}" fill="#F0EFEA" stroke="#ccc" stroke-width="1"/>`;

  // Counter (wooden box, non-clickable)
  const ctr=box(1,1,1,2,TH+16,'#D8B27C','#B8864A','#CA9A58',0);

  // Sort objects by z-order (painter's algorithm)
  const objs=[...TBLS.map(([id,c,r])=>({id,c,r,z:c+r})),{id:0,c:1,r:1,z:3.2,isCtr:true}];
  objs.sort((a,b)=>a.z-b.z);
  const tSVG=objs.map(o=>{
    if(o.isCtr)return ctr;
    const isSel=sel===o.id;
    return ch4(o.c,o.r)+box(o.c,o.r,1,1,TH,isSel?'#BDFAFF':'#FFFFFF',isSel?'#00BFD8':'#FFB3D1',isSel?'#009AB0':'#FF80B0',o.id);
  }).join('');

  // Labels
  const[drx,dry]=iso(4,2.85);
  const[crx,cry]=iso(1.5,2.0);
  const doorLbl=`<text x="${drx}" y="${dry+10}" font-size="11" fill="#999" font-family="sans-serif" text-anchor="middle" font-weight="bold">🚪 DOOR</text>`;
  const ctrLbl=`<text x="${crx}" y="${cry+4}" font-size="10" fill="#8B6030" font-family="sans-serif" text-anchor="middle" font-weight="bold">COUNTER</text>`;

  const info=sel
    ?`<div class="seat-info"><span class="seat-num">${s.table} ${sel}</span><span class="seat-seats">· 4 ${s.seats}</span><button class="submit-btn seat-book" onclick="go('reserve')">${s.book}</button></div>`
    :`<p class="seat-hint">👆 ${s.hint}</p>`;

  return `${navbar()}${geo()}<div class="page-body">
    <div class="sec-head"><h2>${s.h}</h2><p>${s.p}</p></div>
    ${info}
    <div class="seat-wrap"><svg viewBox="0 0 720 440" class="seat-svg">
      ${bwall}${wins}${winLbl}${floor}${tSVG}${doorLbl}${ctrLbl}
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
