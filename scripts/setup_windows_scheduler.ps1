# AI健康管理室 - Windows Task Scheduler 自動排程設定
# 執行方式：在 PowerShell（管理員）中執行此腳本

$PythonPath = "C:\Users\nancy\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$ScriptPath = "C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code\scripts\run_daily.py"
$TaskName = "AI健康管理室每日發送"
$SendTime = "08:00AM"

Write-Host "==================================="
Write-Host " AI健康管理室 Windows 排程設定"
Write-Host "==================================="

# 移除舊排程（如果存在）
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# 建立新排程
$action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument $ScriptPath `
    -WorkingDirectory "C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code"

$trigger = New-ScheduledTaskTrigger -Daily -At $SendTime

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "每天早上8點自動發送健康管理提醒到 LINE"

Write-Host ""
Write-Host "排程建立完成！"
Write-Host "任務名稱：$TaskName"
Write-Host "發送時間：每天 $SendTime"
Write-Host ""
Write-Host "管理排程："
Write-Host "  查看：Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "  手動執行：Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  停用：Disable-ScheduledTask -TaskName '$TaskName'"
Write-Host "  刪除：Unregister-ScheduledTask -TaskName '$TaskName'"
