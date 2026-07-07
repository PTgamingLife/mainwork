<#
.SYNOPSIS
  一鍵把 mainwork 的子資料夾上架成「獨立 GitHub repo + GitHub Pages」。
  首次執行會建立 repo、推送、開啟 Pages;之後再執行同一個作品名 = 更新上線版本。

.PARAMETER SiteName
  mainwork 底下的子資料夾名稱(就是你的作品資料夾),例如 health-quest-rpg。

.PARAMETER RepoName
  (選用) 自訂 GitHub repo 名稱。預設用資料夾名轉小寫。

.PARAMETER Private
  (選用) 建成私有 repo(注意:免費帳號私有 repo 的 Pages 需付費方案才公開)。

.PARAMETER Message
  (選用) commit 訊息,預設 "update site"。

.EXAMPLE
  # 首次上架
  ./scripts/deploy-site.ps1 health-quest-rpg

  # 改完內容後重新上線
  ./scripts/deploy-site.ps1 health-quest-rpg -Message "修正首頁排版"

  # 自訂 repo 名
  ./scripts/deploy-site.ps1 health-quest-rpg -RepoName my-health-game
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$SiteName,
  [string]$RepoName,
  [switch]$Private,
  [string]$Message = "update site"
)
$ErrorActionPreference = "Stop"

# --- 確保 gh / git 在 PATH(winget 裝完同一個 session 可能還沒更新)---
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "找不到 gh CLI。請先安裝: winget install --id GitHub.cli"
}

# --- 定位作品資料夾(腳本固定放在 mainwork/scripts/,上一層就是 mainwork 根)---
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SiteDir  = Join-Path $RepoRoot $SiteName

if (-not (Test-Path -LiteralPath $SiteDir -PathType Container)) {
  throw "找不到作品資料夾: $SiteDir`n請確認 $SiteName 是 mainwork 底下的子資料夾名。"
}
if (-not (Test-Path -LiteralPath (Join-Path $SiteDir 'index.html'))) {
  Write-Warning "⚠️ $SiteName 根目錄沒有 index.html,GitHub Pages 首頁可能空白(若首頁在子資料夾請自行確認)。"
}

if (-not $RepoName) {
  $RepoName = ($SiteName -replace '[^a-zA-Z0-9._-]', '-').ToLower().Trim('-')
}

# --- 確認 gh 已登入 ---
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw "gh 尚未登入。請先在終端機執行一次(瀏覽器授權): gh auth login"
}
$login = (gh api user --jq .login).Trim()
if (-not $login) { throw "無法取得 GitHub 帳號,請確認 gh auth status。" }

$visibility = if ($Private) { '--private' } else { '--public' }

Write-Host "📦 作品資料夾 : $SiteDir"
Write-Host "👤 GitHub 帳號: $login"
Write-Host "📛 目標 repo  : $login/$RepoName"
Write-Host ""

Push-Location $SiteDir
try {
  $firstTime = -not (Test-Path -LiteralPath (Join-Path $SiteDir '.git'))

  if ($firstTime) {
    Write-Host "🆕 首次上架,建立獨立 repo 並推送…"
    git init -b main | Out-Null
    git add -A
    git commit -m $Message | Out-Null
    gh repo create $RepoName $visibility --source=. --remote=origin --push
    if ($LASTEXITCODE -ne 0) { throw "gh repo create 失敗(repo 名可能已存在?可加 -RepoName 換名)。" }

    Write-Host "🌐 啟用 GitHub Pages(main 分支 / 根目錄)…"
    $body = '{"source":{"branch":"main","path":"/"}}'
    $body | gh api -X POST "repos/$login/$RepoName/pages" --input - *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Pages 自動啟用未成功(可能稍後才就緒)。可重跑本指令,或到 repo Settings > Pages 手動選 main / root。"
    }
  }
  else {
    Write-Host "🔄 更新既有 repo…"
    git add -A
    if (git status --porcelain) {
      git commit -m $Message | Out-Null
      git push origin main
      if ($LASTEXITCODE -ne 0) { throw "git push 失敗,請檢查網路或憑證。" }
    }
    else {
      Write-Host "（無變更,略過 commit/push）"
    }
  }
}
finally {
  Pop-Location
}

$url = "https://$login.github.io/$RepoName/"
Write-Host ""
Write-Host "✅ 完成!作品網址(Pages 首次部署約需 1–2 分鐘生效):"
Write-Host "   $url"
Write-Host ""
Write-Host "   repo:  https://github.com/$login/$RepoName"
