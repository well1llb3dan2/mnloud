$ErrorActionPreference = "Stop"

function Invoke-Build {
  param (
    [string]$Path,
    [string]$Name
  )
  Write-Host "Building $Name..." -ForegroundColor Cyan
  Push-Location $Path
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

function Start-AppProcess {
  param (
    [string]$Path,
    [string]$Command,
    [string]$Title
  )

  $escaped = $Command.Replace('"', '\"')
  Start-Process powershell -ArgumentList "-NoProfile -Command `"`$host.ui.RawUI.WindowTitle='$Title'; Set-Location '$Path'; $escaped`""
}

$root = Resolve-Path "E:\Development\Loud"

Invoke-Build -Path "$root\customer-portal" -Name "customer-portal"
Invoke-Build -Path "$root\manager-portal" -Name "manager-portal"

Start-AppProcess -Path "$root\server" -Command "npm run start" -Title "server"
Start-AppProcess -Path "$root\customer-portal" -Command "npm run dev" -Title "customer-portal"
Start-AppProcess -Path "$root\manager-portal" -Command "npm run dev" -Title "manager-portal"
Start-AppProcess -Path "$root" -Command "cloudflared tunnel run loud" -Title "cloudflared"

Write-Host "All processes started." -ForegroundColor Green
