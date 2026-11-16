# Joyful 揪福 餐廳官方網站

**網址**：https://ptgaminglife.github.io/joyfulhamburger/  
**GitHub**：https://github.com/PTgamingLife/joyfulhamburger  
**類型**：純前端靜態網頁（HTML / CSS / JavaScript）

---

## 網站功能總覽

| 頁面 | 說明 |
|------|------|
| 🏠 首頁 | 語言選擇（中 / En / 日 / 한） |
| 🍽 菜單 | 5大分類 × 64道料理，4語言顯示 |
| 📅 訂位 | 線上訂位表單 + FAQ |
| 🗺 交通 | Google Maps 圓形紅點按鈕、交通方式、營業時間 |
| 💬 留言牆 | 留言送薯條 QR Code、照片留言牆（50/50 版型） |

---

## 菜單分類（共 64 道料理）

### 1. 套餐 Combo
- A 套餐：濃湯 ＋ 飲品 **+$89**
- B 套餐：炸物 ＋ 飲品 **+$129**
- C 套餐：洋蔥圈/雞柳 ＋ 湯 ＋ 飲品 **+$169**

### 2. 漢堡 Burger（皆附脆薯）
| 品項 | 標籤 | 價格 |
|------|------|------|
| 招牌 Joyful 花生牛肉起司堡 | ★ | $280 / $320 |
| 焦糖海鹽熔岩炸雞堡 | ★ | $260 |
| 經典肉醬牛肉起司堡 | — | $260 |
| 罪純粹牛肉起司堡 | — | $260 |
| 傲椒薯餅青醬炒菇堡（素） | — | $220 |
| 墨西哥辣椒蕈菇牛肉起司堡 | 🌶️ | $300 |
| 塔塔巧滋蟹肉魚排堡 | — | $240 |
| 加美式炒蛋（加點） | — | +$20 |

### 3. 義大利麵（7種醬底 × 23道）
| 醬底 | 品項 |
|------|------|
| 粉紅醬 | 肉醬洋菇、菌菇雞肉、★ 鮮蝦干貝 |
| 紅醬 | 肉醬、★ 菌菇雞肉、海鮮 |
| 白醬 | ★ 蛋汁培根（Carbonara）、菌菇雞肉、海鮮、鮮蔬 |
| 辣奶油 🌶️ | 菌菇雞肉、海鮮 |
| 青醬 | ★ 培根、雞肉、海鮮 |
| 米型麵 | ★ 粉紅菌菇雞肉、松露野菇、青醬培根、巴薩米可雞柳 |
| 清炒 | 鮮蔬、🌶️ 蒜頭小魚乾、🌶️ 蒜香梅花豬、★ 白酒蛤蜊 |

### 4. 炸物 & 湯品
黃金脆薯、薯球、雞塊、★ 熔岩起司脆薯、松露薯條、肉醬起司薯、★ 洋蔥圈、雞柳條、★ 揪福雞翅、任性三拼盤、玉米濃湯

### 5. 飲料
一般飲品（$60–$80）、咖啡（$100–$120）、★ 康普茶 4款（$160）、精釀啤酒 5款（$180–$200）

> ★ = 店家推薦　🌶️ = 微辣

---

## 多語言支援

| 語言 | 覆蓋範圍 |
|------|---------|
| 中文 | 完整 |
| English | 完整（所有頁面文字 + 菜名） |
| 日本語 | 完整（含 64道菜日文名稱） |
| 한국어 | 完整（含 64道菜韓文名稱） |

---

## 技術規格

```
src/
├── index.html   — HTML shell，AEO Schema.org JSON-LD（Restaurant / FAQPage / HowTo）
├── app.js       — 路由、渲染、i18n 查找表（CAT_I18N / NAME_I18N），無框架
└── style.css    — 霓虹白底設計（--pink #FF006E / --cyan #00F0FF / --green #AAFF00）
```

### 設計系統
- **主色**：白底 + 霓虹粉（#FF006E）、青（#00F0FF）、綠（#AAFF00）、橘（#FF6B00）
- **字型**：Helvetica Neue / Noto Sans TC
- **路由**：純 JS `go(page)` 函式切換，SPA 架構

### AEO / SEO
- Schema.org：`Restaurant`、`FAQPage`、`HowTo`（訂位流程）
- Google Search Console 驗證檔：`googlebe2faa99e4a8959c.html`
- 多語言 meta description、keywords

### 店內規則（菜單頁底部顯示）
- 寵物友善 · 每人低消 $200 · 用餐 90 分鐘 · 自取餐具 · 不收服務費

---

## 部署方式

透過 **GitHub Actions** 自動部署至 GitHub Pages：

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    steps:
      - uses: actions/upload-pages-artifact@v3
        with:
          path: src        # 只部署 src/ 目錄
      - uses: actions/deploy-pages@v4
```

---

## 座標

**Google Maps**：25.0433304, 121.5073904  
**營業時間**：週一至週五 11:30–21:30 ／ 週六至週日 11:00–22:00

---

*最後更新：2026-06-22*
