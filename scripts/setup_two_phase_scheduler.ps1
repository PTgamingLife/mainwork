# Two-Phase LINE Bot Scheduler Setup
# Task 1: 7:00 AM — Phase 1 (send text to LINE group)
# Task 2: Every 2 minutes — Phase 2 (check confirmation, send images if confirmed)

$PythonExe = "C:\Users\nancy\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$ScriptDir = "C:\Users\nancy\OneDrive\桌面\AI_use\claudeskill\code"

# ── Task 1: Morning text at 7:00 AM ────────────────────────────────────────
$Task1Name = "AI輪播_Phase1_早安文字"
$Task1Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "scripts\morning_send.py" `
    -WorkingDirectory $ScriptDir

$Task1Trigger = New-ScheduledTaskTrigger -Daily -At "07:00AM"

$Task1Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Remove old task if exists
Unregister-ScheduledTask -TaskName $Task1Name -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $Task1Name `
    -Action $Task1Action `
    -Trigger $Task1Trigger `
    -Settings $Task1Settings `
    -RunLevel Highest `
    -Force

Write-Host "✅ Task 1 registered: $Task1Name (07:00 AM daily)"

# ── Task 2: Image sender polling every 2 minutes ──────────────────────────
$Task2Name = "AI輪播_Phase2_圖片發送"
$Task2Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "scripts\send_images_if_confirmed.py" `
    -WorkingDirectory $ScriptDir

# Repeat every 2 minutes, runs for 1 day (resets daily)
$Task2Trigger = New-ScheduledTaskTrigger -Daily -At "07:01AM"
$Task2Trigger.Repetition = (New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 2) -Once -At "07:01AM").Repetition

$Task2Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -MultipleInstances IgnoreNew

# Remove old task if exists
Unregister-ScheduledTask -TaskName $Task2Name -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $Task2Name `
    -Action $Task2Action `
    -Trigger $Task2Trigger `
    -Settings $Task2Settings `
    -RunLevel Highest `
    -Force

Write-Host "✅ Task 2 registered: $Task2Name (every 2 min from 07:01 AM)"

# ── Summary ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================"
Write-Host "兩階段排程設定完成！"
Write-Host "======================================"
Write-Host "Task 1  07:00  發送文字到 LINE（每天）"
Write-Host "Task 2  07:01~ 每 2 分鐘檢查是否有「確認」，有則發 6 張圖"
Write-Host ""
Write-Host "下一步："
Write-Host "1. 在 config/.env 加入 LINE_GROUP_ID=C你的群組ID"
Write-Host "2. 部署 Supabase Edge Function（見下方指令）"
Write-Host "3. 在 LINE Developer Console 設定 Webhook URL"
Write-Host ""
Write-Host "部署 Edge Function："
Write-Host "  cd $ScriptDir"
Write-Host "  npx supabase functions deploy line-webhook --no-verify-jwt"
Write-Host ""
Write-Host "LINE Webhook URL（貼到 LINE Developer Console）："
Write-Host "  https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/line-webhook"
