<#
.SYNOPSIS
    Start Security Dashboard on Windows

.DESCRIPTION
    Launches LibreHardwareMonitor and the Security Dashboard servers.
    Handles WSL2 integration automatically.

.EXAMPLE
    .\start-windows.ps1
    .\start-windows.ps1 -SkipLHM
#>

param(
    [switch]$SkipLHM,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🛡️  Security Dashboard - Windows Launcher" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# Find LibreHardwareMonitor
$lhmPaths = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\LibreHardwareMonitor*\LibreHardwareMonitor.exe",
    "$env:ProgramFiles\LibreHardwareMonitor\LibreHardwareMonitor.exe",
    "$env:ProgramFiles(x86)\LibreHardwareMonitor\LibreHardwareMonitor.exe"
)

$lhmExe = $null
foreach ($pattern in $lhmPaths) {
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $lhmExe = $found.FullName
        break
    }
}

# Start LibreHardwareMonitor if needed
if (-not $SkipLHM) {
    $lhmRunning = Get-Process -Name "LibreHardwareMonitor" -ErrorAction SilentlyContinue
    
    if (-not $lhmRunning) {
        if ($lhmExe) {
            Write-Host "🌡️  Starting LibreHardwareMonitor..." -ForegroundColor Yellow
            Start-Process -FilePath $lhmExe -Verb RunAs
            Start-Sleep -Seconds 3
            Write-Host "   ✅ LibreHardwareMonitor started" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  LibreHardwareMonitor not found. Install with:" -ForegroundColor Yellow
            Write-Host "      winget install LibreHardwareMonitor.LibreHardwareMonitor" -ForegroundColor Gray
        }
    } else {
        Write-Host "🌡️  LibreHardwareMonitor already running" -ForegroundColor Green
    }
}

# Check LHM web server
Write-Host ""
Write-Host "🔍 Checking LHM Web Server..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8085/data.json" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   ✅ LHM Web Server is accessible" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  LHM Web Server not responding" -ForegroundColor Yellow
    Write-Host "      Enable it in LibreHardwareMonitor: Options → Remote Web Server" -ForegroundColor Gray
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

Write-Host ""
Write-Host "📁 Project root: $rootDir" -ForegroundColor Gray

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}
Write-Host "📦 Node.js: $nodeVersion" -ForegroundColor Gray

# Start servers
Write-Host ""

if (-not $FrontendOnly) {
    Write-Host "🚀 Starting Backend server..." -ForegroundColor Yellow
    $backendPath = Join-Path $rootDir "backend"
    Start-Process -FilePath "cmd" -ArgumentList "/c cd /d `"$backendPath`" && npm run dev" -WindowStyle Normal
    Write-Host "   Backend starting on http://localhost:4000" -ForegroundColor Green
}

if (-not $BackendOnly) {
    Start-Sleep -Seconds 2
    Write-Host "🚀 Starting Frontend server..." -ForegroundColor Yellow
    $frontendPath = Join-Path $rootDir "frontend"
    Start-Process -FilePath "cmd" -ArgumentList "/c cd /d `"$frontendPath`" && npm run dev" -WindowStyle Normal
    Write-Host "   Frontend starting on http://localhost:3000" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "✨ Dashboard will be available at:" -ForegroundColor Cyan
Write-Host "   🌐 http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "API endpoints:" -ForegroundColor Gray
Write-Host "   📊 http://localhost:4000/api/checks" -ForegroundColor Gray
Write-Host "   🌡️  http://localhost:4000/api/temperature" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# Open browser after a delay
Start-Sleep -Seconds 5
Start-Process "http://localhost:3000"
