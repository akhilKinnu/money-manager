# FinTrack Pro - PowerShell Launcher
$filePath = Join-Path $PSScriptRoot "index.html"
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  FinTrack Pro - Modern Expense & Income Manager " -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Launching $filePath in your default browser..." -ForegroundColor Yellow
Start-Process $filePath
