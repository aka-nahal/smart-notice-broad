# Emergency: kill all RunaNet-related processes (launcher, uvicorn, next, node children).
Get-CimInstance Win32_Process | Where-Object {
    $_.Name -in @('python.exe','node.exe','cmd.exe','npm.cmd') -and
    $_.CommandLine -and
    ($_.CommandLine -match 'launcher\.py' -or
     $_.CommandLine -match 'start\.py'   -or
     $_.CommandLine -match 'start\.bat'  -or
     $_.CommandLine -match 'next dev'    -or
     $_.CommandLine -match 'next start'  -or
     $_.CommandLine -match 'uvicorn'     -or
     $_.CommandLine -match 'app\.main')
} | ForEach-Object {
    Write-Host ("Killing PID {0}: {1}" -f $_.ProcessId, $_.Name)
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { Write-Host "  (already gone)" }
}

Start-Sleep -Seconds 2
$held = Get-NetTCPConnection -LocalPort 3000,8000 -ErrorAction SilentlyContinue | Where-Object State -eq 'Listen'
if ($held) {
    Write-Host ""
    Write-Host "Still listening:"
    $held | Select-Object LocalPort, OwningProcess | Format-Table
} else {
    Write-Host ""
    Write-Host "Ports 3000 and 8000 are free."
}
