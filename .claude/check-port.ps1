# .claude/check-port.ps1
# PreToolUse hook for mcp__Claude_Preview__preview_start
# Reads the server name from stdin JSON, finds the matching config in launch.json,
# checks if its port is in use, and if so picks the first free alternativePort,
# then rewrites both `port` and the port number inside `runtimeArgs` in launch.json.

$input_json = $null
try { $input_json = $Input | Out-String | ConvertFrom-Json } catch {}

# Extract the server name from the tool_input
$serverName = $input_json.tool_input.name
if (-not $serverName) { exit 0 }

$launchPath = Join-Path $PSScriptRoot "launch.json"
if (-not (Test-Path $launchPath)) { exit 0 }

$launch = Get-Content $launchPath -Raw | ConvertFrom-Json

# Find the matching configuration
$cfg = $launch.configurations | Where-Object { $_.name -eq $serverName }
if (-not $cfg) { exit 0 }

$desiredPort = [int]$cfg.port

# Check if the desired port is already in use
function Test-PortInUse($port) {
    $result = netstat -ano 2>$null | Select-String "[:.]${port}\s+.*LISTENING"
    return ($null -ne $result)
}

if (-not (Test-PortInUse $desiredPort)) { exit 0 }  # Port is free — nothing to do

# Port is taken — find the first free alternative
$alternatives = @()
if ($cfg.PSObject.Properties["alternativePorts"]) {
    $alternatives = $cfg.alternativePorts
}

$freePort = $null
foreach ($p in $alternatives) {
    if (-not (Test-PortInUse $p)) {
        $freePort = [int]$p
        break
    }
}

if (-not $freePort) {
    # No alternativePorts defined or all taken — scan sequentially from desired+1
    $candidate = $desiredPort + 1
    while ($candidate -lt 65535) {
        if (-not (Test-PortInUse $candidate)) { $freePort = $candidate; break }
        $candidate++
    }
}

if (-not $freePort) { exit 0 }  # Give up, let preview_start handle it

# Rewrite the port in the config object
$cfg.port = $freePort

# Rewrite the port number inside runtimeArgs (replace the old port string with new)
if ($cfg.PSObject.Properties["runtimeArgs"]) {
    $oldStr = [string]$desiredPort
    $newStr = [string]$freePort
    $cfg.runtimeArgs = $cfg.runtimeArgs | ForEach-Object {
        if ($_ -eq $oldStr) { $newStr } else { $_ }
    }
}

# Save updated launch.json (ConvertTo-Json depth 5 preserves nested arrays)
$launch | ConvertTo-Json -Depth 5 | Set-Content $launchPath -Encoding utf8

# Emit a systemMessage so Claude knows what happened
$msg = @{ systemMessage = "[check-port] Port $desiredPort in use — switched '$serverName' to port $freePort and updated launch.json." }
$msg | ConvertTo-Json -Compress
