# lf_ 一鍵啟動:建 venv → 安裝套件 → 檢查 port → 開本機網頁
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path '.venv\Scripts\python.exe')) {
    Write-Host '建立虛擬環境 .venv ...'
    python -m venv .venv
}
$lf_py = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'

$lf_hash = (Get-FileHash 'requirements.txt').Hash
$lf_mark = '.venv\lf_installed.txt'
if (-not (Test-Path $lf_mark) -or (Get-Content $lf_mark) -ne $lf_hash) {
    Write-Host '安裝套件 ...'
    & $lf_py -m pip install -q -r requirements.txt
    & $lf_py -m playwright install chromium
    Set-Content $lf_mark $lf_hash
}

$lf_port = 8766
if (Test-Path '.env') {
    $lf_line = Select-String -Path '.env' -Pattern '^\s*LF_PORT\s*=\s*(\d+)' | Select-Object -First 1
    if ($lf_line) { $lf_port = [int]$lf_line.Matches[0].Groups[1].Value }
}
$lf_busy = Get-NetTCPConnection -LocalPort $lf_port -State Listen -ErrorAction SilentlyContinue
if ($lf_busy) {
    $lf_pid = $lf_busy[0].OwningProcess
    Write-Host "Port $lf_port 已被程式佔用(PID $lf_pid)。請關掉它,或在 .env 設定 LF_PORT=其他號碼。" -ForegroundColor Yellow
    exit 1
}

Start-Process "http://127.0.0.1:$lf_port"
& $lf_py lf_server.py $lf_port
