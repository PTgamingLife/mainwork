# 電子發票消費追蹤 × 家庭財務模型

把台灣財政部電子發票平台的**手機條碼載具**消費,自動抓回來、分類、比對月預算,
並流入 `household-finance` 家庭財務模型的交易紀錄。

```
每天排程
   │
   ▼
財政部 InvApp API ── carrierInvChk(表頭)+ carrierInvDetail(明細)
   │
   ▼
自動分類(餐飲/超商/交通/購物/生活/娛樂/醫療/居家/其他)
   │
   ├─► Supabase invoices / invoice_items(+ 本地 logs/invoices.jsonl fallback)
   │
   ├─► 月預算比對 → 超支/接近上限時 LINE 推播
   │
   └─► （--finance)寫入 household-finance/data.json 的 transactions(實際流水帳)
```

## 檔案

| 檔案 | 作用 |
|------|------|
| `src/einvoice_client.py` | 手機條碼載具查詢(`carrierInvChk` 表頭 / `carrierInvDetail` 明細)。無憑證時自動用 fixture 假資料。 |
| `src/spending.py` | 關鍵字分類器 + 月預算比對 + LINE 報表格式化。 |
| `src/database.py` | 發票儲存(Supabase REST + 本地 jsonl fallback,依 `inv_num` 去重)。 |
| `src/finance_bridge.py` | 發票 → `household-finance/data.json` 的 `transactions` 橋接。 |
| `scripts/fetch_invoices.py` | 每日執行器。 |
| `supabase/migrations/0001_einvoice.sql` | `invoices` + `invoice_items` schema。 |
| `tests/fixtures/einvoice_sample.json` | `--test` 用範例資料。 |

## 使用方式

```bash
python scripts/fetch_invoices.py            # 抓近 2 天,存檔,超支才推播 LINE
python scripts/fetch_invoices.py --test     # 用假資料跑完整流程,不推播、不寫 data.json
python scripts/fetch_invoices.py --days 7   # 往回抓 7 天
python scripts/fetch_invoices.py --report   # 只發本月消費整理到 LINE
python scripts/fetch_invoices.py --finance  # 抓完同步進家庭財務 data.json
python -m src.finance_bridge 2026/07        # 單獨把某月發票同步進 data.json(--dry-run 預覽)
```

## 環境變數(憑證絕不寫進程式碼)

| 變數 | 說明 |
|------|------|
| `EINVOICE_APP_ID` | 財政部電子發票平台申請的 AppID(einvoice.nat.gov.tw,免費、需審核) |
| `EINVOICE_CARRIER_NO` | 手機條碼(`/` 開頭 8 碼) |
| `EINVOICE_CARRIER_PIN` | 手機條碼驗證碼(你在平台設定的密碼) |
| `SPENDING_BUDGET` | 選填。月預算 JSON,例如 `{"總額":20000,"餐飲":6000}` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 沿用既有;不設定則只寫本地 jsonl |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_USER_ID`(或 `LINE_GROUP_ID`) | 沿用既有;超支推播用 |

**三個憑證任一未設定** → 自動切換 fixture 假資料模式,整條流程免憑證即可端到端跑通。

## 分類對應(電子發票 → 家庭財務模型稅目)

`finance_bridge` 把消費稅目對應到 `household-finance` 模型的稅目:

| 電子發票分類 | 家庭財務稅目 |
|--------------|--------------|
| 餐飲 / 超商 / 生活 | 飲食 |
| 交通 | 交通 |
| 居家 | 居住 |
| 娛樂 | 娛樂 |
| 購物 / 醫療 / 其他 | 其他 |

## 設計取捨

- **只寫 `transactions`,不動 `expenses`**:`expenses` 是家庭財務模型的「規劃月預算」,由 `household-finance` skill 的記帳/建議模式管理;自動覆蓋會破壞模型。發票代表「實際花費」,因此進 `transactions` 流水帳,再由建議模式對照規劃 vs 實際。
- **去重**:發票以 `inv_num` 為主鍵;`transactions` 每筆帶 `inv` 欄位,重跑會跳過已存在的。
- **明細不保證每張都有**:小店家未上傳品項時只有總金額,分類靠店家名稱推斷。
- **API 有流量限制**:走「每天批次抓一次」最穩,對齊既有 `run_daily` 排程模式。

## 上線步驟

1. 到 einvoice.nat.gov.tw 申請 `AppID`。
2. 設好三個 `EINVOICE_*` 環境變數(建議放 Supabase secret / 部署環境變數,勿入 git)。
3. 在 Supabase 套用 `supabase/migrations/0001_einvoice.sql`。
4. (選填)設 `SPENDING_BUDGET` 月預算。
5. 用既有排程器每天跑 `python scripts/fetch_invoices.py --finance`。

> 註:財政部 API 的 `invDate` 可能回傳**民國年**(如 `114/07/14`)。fixture 先以西元跑通流程;
> 正式串接看到真實回傳格式後,於 `einvoice_client` 補上民國↔西元轉換即可。
