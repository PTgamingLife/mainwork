-- 電子發票消費追蹤 schema
-- invoices        發票表頭 (每張一列)
-- invoice_items   發票明細 (品項,可為空)
-- bot_config      沿用既有表存放 'spending_budget' (JSON 字串)

create table if not exists invoices (
    inv_num      text primary key,          -- 發票號碼 (唯一,用於去重)
    inv_date     text not null,             -- YYYY/MM/DD (民國轉西元後)
    seller_name  text not null default '',
    amount       integer not null default 0,
    category     text not null default '其他',
    created_at   timestamptz not null default now()
);

create index if not exists invoices_date_idx on invoices (inv_date);
create index if not exists invoices_category_idx on invoices (category);

create table if not exists invoice_items (
    id           bigserial primary key,
    inv_num      text not null references invoices (inv_num) on delete cascade,
    description  text not null default '',
    quantity     integer not null default 1,
    unit_price   integer not null default 0,
    amount       integer not null default 0
);

create index if not exists invoice_items_inv_idx on invoice_items (inv_num);

-- 月預算設定範例 (寫進既有 bot_config 表):
-- insert into bot_config (key, value)
-- values ('spending_budget', '{"總額":20000,"餐飲":6000,"生活":5000}')
-- on conflict (key) do update set value = excluded.value;
