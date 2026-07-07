# SkillMap Star ✦ 技能星圖

把我用 `/done` 累積的技能,以 3D 星球視覺化:每顆星 = 一個技能,內容重疊的星之間連線,其餘只連回中央核心。機密一律不入此 repo(只放大意與方向)。

## 檔案
- `index.html` — 3D 星圖(Three.js,單檔,可直接開或部署 GitHub Pages)
- `skills.json` — 星點資料(已抽除機密;手動精修的內容會被保留)
- `gen-skills.mjs` — 從 `~/.claude/skills/*/SKILL.md` 自動補上新技能星點

## 更新星圖(每次 /done 新增技能後)
```bash
node gen-skills.mjs        # 掃描 ~/.claude/skills,補上新 skill 到 skills.json
# 再手動把新條目的 summary / tags / category 修得更精準
```

## 部署到 GitHub Pages
```bash
git remote add origin https://github.com/PTgamingLife/skillmapstar.git
git add index.html skills.json gen-skills.mjs README.md
git commit -m "skillmap star 3D 視覺化"
git push -u origin main
```
然後 GitHub repo → Settings → Pages → Source 選 `main` 分支 `/ (root)` → 存檔。
幾分鐘後即可在 `https://ptgaminglife.github.io/skillmapstar/` 看到。

## 操作
拖曳旋轉 · 滾輪縮放 · 點星看大意與相關技能 · 點核心看總覽
