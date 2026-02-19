$ErrorActionPreference = "SilentlyContinue"

$workspaceMarker = "VAULT_1"
$processes = Get-CimInstance Win32_Process -Filter "name='electron.exe'" |
  Where-Object { $_.CommandLine -like "*$workspaceMarker*" }

if (-not $processes) {
  Write-Output "No VAULT_1 Electron process to stop."
  exit 0
}

foreach ($process in $processes) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    Write-Output ("Stopped VAULT_1 Electron process {0}" -f $process.ProcessId)
  } catch {
    Write-Output ("Failed to stop process {0}" -f $process.ProcessId)
  }
}
