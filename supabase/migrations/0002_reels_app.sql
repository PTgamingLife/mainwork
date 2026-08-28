-- Reels 教練 Web App:個人模型、案例、分析、腳本 + storage
-- 0002_reels_app.sql

-- ── 種子模型(所有新用戶的起點;更新種子時 update 此列即可)──
create table if not exists public.base_models (
  id int primary key check (id = 1),
  version text not null,
  content text not null,
  updated_at timestamptz not null default now()
);

insert into public.base_models (id, version, content)
values (1, 'v1.0', $seed$# IG Reels 短影音設計模型(個人版)

> 這是一個「活的模型」。每次你上傳 Reels 做成效分析,系統就會更新此文件。
> 生成腳本時系統會完整讀取本文件,並依照權重高的規則優先套用。
> 權重順序:「八、已驗證模式」(你自己的數據)最高 → 「七、客群輪廓」→ 通用規則(一~六章)。

**模型版本:v1.0**(通用種子模型;隨著你的分析次數增加,七、八章與公式信心度會長成你帳號專屬的樣子)

---

## 一、演算法核心機制(生成時的底層邏輯)

1. **2026 權重排序:完播率/觀看時間 ≈ 35% > 收藏 25% > DM 轉發 20% > 讚只剩 5%**。
   影片的目標不是「被讚」,是「被看完、被存、被傳」。
2. **第 3 秒是分水嶺**:大多數人滑過 3 秒還在看 → 演算法判定鉤子有效,往外推。
3. **重播 = 高價值訊號**:同一人看兩次,權重極高。短影片(7–15 秒)配循環設計最容易觸發。
4. **DM 轉發權重是讚的 3–5 倍**:「看到想傳給某個人」的內容天生贏。
5. **發布後 30–60 分鐘的互動速度**決定是否推給非粉絲(Explore / Reels tab)。
6. **興趣推薦取代粉絲導向**:帳號主題集中 1–2 個領域,演算法才找得到對的受眾;Reels 觸及約為照片 2.5 倍。

## 二、長度與流量機制對照(選題時先決定賭哪個)

| 賭的機制 | 適合長度 | 內容型態 | CTA 型 |
|----------|---------|---------|--------|
| 完播+重播 | 7–15 秒 | 單點反差、視覺梗、金句 | 循環設計(不用 CTA) |
| 轉發 | 15–30 秒 | 共鳴痛點、「傳給那個人」 | 「傳給你那個○○的朋友」 |
| 收藏 | 30–60 秒 | 教學、清單、步驟 SOP | 「先收藏,之後會用到」 |
| 留言 | 15–45 秒 | 爭議觀點、二選一 | 結尾拋問句 |

- 通用甜蜜點 7–45 秒;超過 60 秒需要每 20–30 秒補一次鉤子才撐得住。

## 三、腳本骨架(Hook → 主體 → 收尾)

**Hook(0–3 秒)— 三層同時進攻**(sound-off 也要成立):
- **口白層**:鉤子句(見第四章公式庫),第一句含目標關鍵字(IG SEO 吃)。
- **畫面層**:第一幀就有動作/結果/強烈畫面 —— 先秀成果再講過程,不要鋪陳。靜止開頭是死刑。
- **字卡層**:3–7 個大字壓縮承諾(不逐字重複口白),高對比、放安全區。

**主體(3 秒–80%)**:
- 前 3–5 秒先兌現 hook 的承諾,不要「先自我介紹」。
- 每 2–3 秒一個視覺變化(跳剪/zoom/角度換/字卡進場/B-roll),靜止畫面超過 4 秒 = 滑走高危區。
- 教學型每 1–2 秒補 B-roll;每 20–30 秒丟第二鉤子(「接下來這點才是關鍵」)。
- 字幕必上(85% 的人關聲音看),字幕時間軸對剪接點、不是對音軌。

**收尾(最後 3–5 秒)**:
- 依選題定位下 CTA(見第二章),一支影片只下一個 CTA。
- **循環設計**:最後 0.5 秒畫面接回第一幀,或最後一句話呼應開頭(「所以我說開頭那句…」),騙一次重播。

## 四、鉤子公式庫(依信心度排序,生成時優先取用)

> **公式 = 心理槓桿(為什麼會停滑),不是句子本身。** 每條先想「這一秒觸發觀眾哪個情緒」,再套句型。
> 這裡全是**口白層**公式;每次生成都要同時配畫面層(第一幀秀成果)+ 字卡層(3–7 字),缺一層 hook 就漏。
> 生成時把 ○○ 換成你帳號的領域與當支主題。
> 信心度規則:每次分析驗證某公式在**你的帳號**有效 → 升級(理論→中→高→已驗證);連續兩次表現差 → 降級或淘汰。

| # | 公式(心理槓桿) | 口白句型範例 | 字卡範例 | 主打機制 | 信心度 |
|---|------|------------|---------|--------|--------|
| R1 | 負面警告 / 損失 | 「不要再手動○○了,這樣一天白白燒掉 2 小時」 | 「別再○○」 | 完播/留言 | 中(理論;⚠️ 痛點必須配承諾:只丟痛點不給 payoff 無效) |
| R2 | 結果倒敘(懸念) | 「這個方法讓我○○,其實超簡單」 | 「○○其實很簡單」 | 完播 | 中(理論) |
| R3 | 秘密內幕 | 「99% 的人都不知道○○可以這樣用」 | 「99%不知道」 | 完播 | 中(理論) |
| R4 | 犀利問句 | 「你知道為什麼你○○了,卻還是○○嗎?」 | 「還在瞎忙?」 | 留言 | 中(理論) |
| R5 | 反直覺斷言 | 「其實做○○,根本不用○○」 | 「不用○○」 | 完播/收藏 | 中(理論) |
| R6 | 過程直擊 | (無口白,實拍過程 / before→after) | 「30秒完成」 | 完播 | 中(理論) |
| R7 | 指名受眾 | 「如果你是○○,這支先存起來」 | 「○○必看」 | 轉發/收藏 | 中(理論) |
| R8 | 埋尾爆點 | 「最後一個才是我天天在用的,看到結尾」 | 「第3個最神」 | 完播 | 中(理論) |
| R9 | 段位對照/自我定位 | 「○○的 6 個段位,看看你在哪一級」 | 「你是哪段位?」 | 完播/留言/收藏 | 中高(外部案例多次驗證,待你的帳號數據確認) |
| R10 | 平台原生數據截圖 | (無口白,第一幀直接螢幕錄後台數據/成效排行) | 借截圖本身數據當字卡 | 完播/收藏 | 中(外部案例驗證,待你的帳號數據確認) |
| R11 | 利益承諾 | 「學會這一招,○○就能○○」 | 「○○就能○○」 | 收藏 | 低(理論) |
| R12 | 數字衝擊 | 「用這個方法,我把 3 小時的○○壓到 5 分鐘」 | 「3hr→5min」 | 完播/收藏 | 低(理論) |
| R13 | 社會證明 / 見證 | 「我學生用這套方法,第一個月就○○」 | 「30天○○」 | 轉發 | 低(理論) |
| R14 | 稀缺 / 限時 | 「這套○○我只公開到今晚,之後收起來」 | 「限今晚」 | 留言/轉發 | 低(理論) |
| R15 | 情緒共鳴 | 「○○後根本沒時間○○,但我靠這個追上了」 | 「○○也能」 | 轉發 | 低(理論) |
| R16 | 故事代入 / 反轉 | 「○○那天,我決定○○ —— 後來發生的事…」 | 「○○之後」 | 完播/轉發 | 低(理論) |
| R17 | 荒謬違和 / 自嘲 | 「我常常在○○,但這支能教你○○」 | 「○○拍的」 | 完播 | 低(理論) |

> R10 用法:第一幀放平台官方後台數據截圖(觀看/rate 排行/成長曲線),借平台權威 + 具體數字,比手做字卡更可信;適合「拆解數據/教流量」類主題。
> 「別人說有效」不等於你的帳號有效,一律等數據。

## 五、降權地雷(生成時絕對避開)

- ❌ 開頭自我介紹、鋪陳背景(「大家好我是…」= 直接被滑)
- ❌ 帶浮水印的轉載影片(TikTok logo 直接降權)
- ❌ 畫質差、直式以外的比例(必須 9:16、1080×1920)
- ❌ 互動誘餌口白「按讚訂閱分享」連發;一支只下一個 CTA
- ❌ 硬塞 30 個 hashtag;1–3 個精準標籤就好
- ❌ 音樂蓋過口白、無字幕(關聲音看不懂 = 滑走)
- ❌ 把答案在 hook 就講完,主體沒有留住人的理由

## 六、發布操作建議(附在每次生成結果後提醒)

- 發布後 60 分鐘內守留言區,快速回覆衝互動速度。
- Caption 第一行當第二 hook;內文含關鍵字(IG 搜尋 + Google 都吃)。
- 封面圖(cover)選有字卡的那幀,顧到主頁瀏覽的點擊。
- 固定領域、固定框架連發(系列感),演算法和觀眾都吃熟悉感。
- 一週 3–5 支穩定發,勝過爆發式連發再消失。

## 七、客群輪廓(由你的分析逐步累積)

> 每次分析 Reels 時,系統會從「哪種留言最多、誰在回、什麼字眼引起反應」推斷你的客群,寫入此區。累積式更新,不覆蓋舊洞察,矛盾時標註。

- 主題領域:(尚未累積 —— 第一次分析後填入)
- 客群樣貌:(尚未累積)
- 有感的字眼/痛點:(尚未累積)
- 無感的內容:(尚未累積)

## 八、已驗證模式(來自你的實際流量數據,權重最高)

> 此區的規則來自你帳號的真實流量數據,生成時優先於前面章節的通用規則。自有數據 > 外部參考案例。

(尚未累積 —— 每次分析後,系統會把新發現的模式寫入這裡)

---

## 版本紀錄

| 版本 | 日期 | 變更 | 依據 |
|------|------|------|------|
| v1.0 | (帳號建立日) | 通用種子模型:2026 演算法權重、長度×機制對照、三層 hook、17 條鉤子公式、節奏規範、降權地雷 | 平台通用研究彙整 |
$seed$)
on conflict (id) do update
  set version = excluded.version,
      content = excluded.content,
      updated_at = now();

-- ── 個人模型(版本化,append-only)──
create table if not exists public.user_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null,
  content text not null,
  change_note text,
  created_at timestamptz not null default now()
);
create index if not exists user_models_user_created_idx
  on public.user_models (user_id, created_at desc);

-- ── 案例庫(每次分析一筆)──
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  case_no int not null,
  source_url text,
  is_own boolean not null default true,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists cases_user_idx on public.cases (user_id, case_no desc);

-- ── 分析結果 ──
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  report text not null,
  transcript text,
  metrics_text text,
  created_at timestamptz not null default now()
);

-- ── 生成的腳本 ──
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  content text not null,
  model_version text,
  created_at timestamptz not null default now()
);
create index if not exists scripts_user_idx on public.scripts (user_id, created_at desc);

-- ── RLS:每人只能讀寫自己的資料 ──
alter table public.base_models enable row level security;
alter table public.user_models enable row level security;
alter table public.cases enable row level security;
alter table public.analyses enable row level security;
alter table public.scripts enable row level security;

drop policy if exists "base model readable" on public.base_models;
create policy "base model readable" on public.base_models
  for select to authenticated using (true);

drop policy if exists "own models select" on public.user_models;
create policy "own models select" on public.user_models
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own models insert" on public.user_models;
create policy "own models insert" on public.user_models
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own cases select" on public.cases;
create policy "own cases select" on public.cases
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own cases insert" on public.cases;
create policy "own cases insert" on public.cases
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own analyses select" on public.analyses;
create policy "own analyses select" on public.analyses
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own analyses insert" on public.analyses;
create policy "own analyses insert" on public.analyses
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own scripts select" on public.scripts;
create policy "own scripts select" on public.scripts
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own scripts insert" on public.scripts;
create policy "own scripts insert" on public.scripts
  for insert to authenticated with check (user_id = auth.uid());

-- ── Storage:reels bucket,每人只能碰自己 user_id 開頭的資料夾 ──
insert into storage.buckets (id, name, public)
values ('reels', 'reels', false)
on conflict (id) do nothing;

drop policy if exists "reels upload own folder" on storage.objects;
create policy "reels upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reels read own folder" on storage.objects;
create policy "reels read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reels update own folder" on storage.objects;
create policy "reels update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reels delete own folder" on storage.objects;
create policy "reels delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reels' and (storage.foldername(name))[1] = auth.uid()::text);
