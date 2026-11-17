-- LadyS:運動動作改由表管理(/workout-sync)。運動教練 agent 新增一列即可上架,ladys-workout 每天輪 2 招
create table if not exists public.ladys_workout_moves (
  id bigserial primary key,
  ladys_img text not null unique,
  ladys_title text not null,
  ladys_tip text not null default '',
  ladys_reps text not null default '',
  ladys_ratio text not null default '1:1' check (ladys_ratio ~ '^\d+:\d+$'),
  ladys_bg text not null default '#FFF8F0' check (ladys_bg ~ '^#[0-9A-Fa-f]{6}$'),
  ladys_sort integer not null default 0,
  ladys_enabled boolean not null default true,
  ladys_added_by text not null default 'secretary' check (ladys_added_by in ('coach', 'secretary', 'user')),
  ladys_created_at timestamptz not null default now(),
  ladys_updated_at timestamptz not null default now()
);
create index if not exists ladys_workout_moves_sort_idx on public.ladys_workout_moves (ladys_sort, id);
alter table public.ladys_workout_moves enable row level security;
revoke all on public.ladys_workout_moves from anon, authenticated;

-- 原本寫死在 ladys-workout 的 15 招,依原順序搬進表
insert into public.ladys_workout_moves (ladys_img, ladys_title, ladys_tip, ladys_reps, ladys_ratio, ladys_bg, ladys_sort, ladys_added_by) values
  ('workout-situp.png', '愛的親親', '腳互相固定做仰臥起坐,坐起來親一下。練核心與默契。', '10 下', '1:1', '#FFF8F0', 10, 'secretary'),
  ('workout-squat.png', '背對背擁抱', '背貼背深蹲到大腿與地面平行。練下半身與平衡。', '10 下', '1:1', '#FFF8F0', 20, 'secretary'),
  ('workout-abs01.png', '坐姿抱頭交替收腿', '雙手抱頭、上身後仰約 45°,一腳屈膝收到胸前、另一腳伸直懸空,左右交替。', '每邊 15 下', '25:18', '#ECE6DC', 30, 'secretary'),
  ('workout-abs02.png', '撐地屈膝快速收腹', '雙手在身後撐地,雙腳併攏離地;快速把膝蓋收向胸口,再往前伸直,腳不落地。', '20 下', '25:18', '#ECE6DC', 40, 'secretary'),
  ('workout-abs03.png', '懸空剪刀腳踩點', '雙手撐地、腿伸直離地,兩腳上下交替擺動,像在空中踩點。', '30 秒', '25:18', '#ECE6DC', 50, 'secretary'),
  ('workout-abs04.png', '坐姿左右擺腿', '雙手撐地、雙腿併攏微彎離地,整雙腿像雨刷一樣左右擺動,上身保持穩定。', '20 下', '25:18', '#ECE6DC', 60, 'secretary'),
  ('workout-abs05.png', '坐姿開合伸腿', '屈膝收腿併攏 → 雙腿向前伸直同時打開成 V,再收回。', '20 下', '25:18', '#ECE6DC', 70, 'secretary'),
  ('workout-abs06.png', '坐姿屈膝收腹', '上身後仰撐地,雙膝收向胸口時上身微微往前,伸腿時上身再後仰,像折疊刀。', '20 下', '25:18', '#ECE6DC', 80, 'secretary'),
  ('workout-abs07.png', '坐姿剪刀腳', '腿伸直離地,左右腿水平交叉、打開,像剪刀開合。', '30 秒', '25:18', '#ECE6DC', 90, 'secretary'),
  ('workout-abs08.png', '畫彩虹', '雙腿併攏伸直,從左邊低處經過上方畫一道弧線到右邊,再畫回來。', '×16(抱啞鈴或水瓶)', '25:18', '#ECE6DC', 100, 'secretary'),
  ('workout-abs09.png', '腿部舉重', '雙腿併攏,從貼近地面往上抬到約 60°,再慢慢放下但不碰地。', '×16(抱啞鈴或水瓶)', '25:18', '#ECE6DC', 110, 'secretary'),
  ('workout-abs10.png', '膝關節前推', '屈膝讓小腿離地,膝蓋從胸前往前推出去、再收回,腳全程懸空。', '×16(抱啞鈴或水瓶)', '25:18', '#ECE6DC', 120, 'secretary'),
  ('workout-abs11.png', '左右側腹扭', '屈膝雙腳離地,抱著啞鈴把上身左右轉,帶到身體兩側（俄羅斯轉體）。', '×16(抱啞鈴或水瓶)', '25:18', '#ECE6DC', 130, 'secretary'),
  ('workout-abs12.png', '觸摸腳掌', '躺下、雙腿垂直朝天,捲起上背、雙手往上去碰腳掌,再慢慢躺回。', '×16(抱啞鈴或水瓶)', '25:18', '#ECE6DC', 140, 'secretary'),
  ('workout-abs13.png', '奪命剪刀腳', '最後衝刺:抱著啞鈴、腿伸直低空快速上下交替踢,撐滿 30 秒。', '30 秒(抱啞鈴或水瓶)', '25:18', '#ECE6DC', 150, 'secretary')
on conflict (ladys_img) do nothing;
