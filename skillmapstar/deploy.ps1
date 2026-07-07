# SkillMap Star 一鍵部署 / 更新
# 第一次執行:初始化 git + 設定 remote + 推送
# 之後每次執行:更新星圖資料 → commit → push
# 用法:在 skillmapstar 資料夾按右鍵「以 PowerShell 執行」,或:  powershell -ExecutionPolicy Bypass -File deploy.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$REMOTE = "https://github.com/PTgamingLife/skillmapstar.git"

Write-Host "=== 1/4 更新技能星圖資料 ===" -ForegroundColor Cyan
if (Get-Command node -ErrorAction SilentlyContinue) {
    node gen-skills.mjs
} else {
    Write-Host "（找不到 node,略過自動產生;沿用現有 skills.json）" -ForegroundColor Yellow
}

Write-Host "=== 2/4 準備 git ===" -ForegroundColor Cyan
if (-not (Test-Path ".git")) {
    git init | Out-Null
    git branch -M main
    Write-Host "已初始化 git repo"
}
# 設定 / 修正 remote
$hasOrigin = (git remote) -contains "origin"
if (-not $hasOrigin) {
    git remote add origin $REMOTE
    Write-Host "已設定 remote: $REMOTE"
}

Write-Host "=== 3/4 commit ===" -ForegroundColor Cyan
# 只加該進 repo 的檔案(不含截圖等雜物可自行調整)
git add index.html skills.json gen-skills.mjs README.md deploy.ps1 skillmap-overview.png 2>$null
$changes = git status --porcelain
if ($changes) {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "skillmap update $stamp" | Out-Null
    Write-Host "已 commit"
} else {
    Write-Host "無變更,略過 commit"
}

Write-Host "=== 4/4 push ===" -ForegroundColor Cyan
git push -u origin main
Write-Host ""
Write-Host "✅ 完成!" -ForegroundColor Green
Write-Host "首次部署後,到 GitHub repo → Settings → Pages → Source 選 main /(root) 存檔。"
Write-Host "網址:https://ptgaminglife.github.io/skillmapstar/"

