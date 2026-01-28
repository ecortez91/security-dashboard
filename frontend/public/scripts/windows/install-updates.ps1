<#
.SYNOPSIS
    Security Dashboard - Install Windows Updates

.DESCRIPTION
    Checks for and installs all available Windows updates.

.NOTES
    Run as Administrator
#>

#Requires -RunAsAdministrator

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📦 Security Dashboard - Install Windows Updates" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if PSWindowsUpdate module is available
$hasModule = Get-Module -ListAvailable -Name PSWindowsUpdate

if (-not $hasModule) {
    Write-Host "📦 Installing PSWindowsUpdate module..." -ForegroundColor Yellow
    try {
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -ErrorAction SilentlyContinue | Out-Null
        Install-Module -Name PSWindowsUpdate -Force -AllowClobber -Scope CurrentUser
        Import-Module PSWindowsUpdate
        Write-Host "   ✅ Module installed" -ForegroundColor Green
    }
    catch {
        Write-Host "   ⚠️  Could not install module. Using Windows Update directly..." -ForegroundColor Yellow
        
        # Fallback to UsoClient
        Write-Host ""
        Write-Host "🔄 Starting Windows Update scan..." -ForegroundColor Yellow
        Start-Process -FilePath "UsoClient.exe" -ArgumentList "StartScan" -Wait -NoNewWindow
        
        Write-Host "🔄 Downloading updates..." -ForegroundColor Yellow
        Start-Process -FilePath "UsoClient.exe" -ArgumentList "StartDownload" -Wait -NoNewWindow
        
        Write-Host "🔄 Installing updates..." -ForegroundColor Yellow
        Start-Process -FilePath "UsoClient.exe" -ArgumentList "StartInstall" -Wait -NoNewWindow
        
        Write-Host ""
        Write-Host "✅ Windows Update process started!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check progress in: Settings → Windows Update" -ForegroundColor Gray
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 0
    }
}

Import-Module PSWindowsUpdate -ErrorAction SilentlyContinue

Write-Host "🔍 Checking for available updates..." -ForegroundColor Yellow
Write-Host ""

$updates = Get-WindowsUpdate -AcceptAll -IgnoreReboot

if ($updates.Count -eq 0) {
    Write-Host "✅ No updates available. System is up to date!" -ForegroundColor Green
}
else {
    Write-Host "📋 Found $($updates.Count) update(s):" -ForegroundColor Cyan
    $updates | Format-Table KB, Size, Title -AutoSize
    
    Write-Host ""
    $confirm = Read-Host "Install all updates? (Y/n)"
    
    if ($confirm -ne 'n' -and $confirm -ne 'N') {
        Write-Host ""
        Write-Host "🔄 Downloading and installing updates..." -ForegroundColor Yellow
        Write-Host "   This may take a while..." -ForegroundColor Gray
        Write-Host ""
        
        Install-WindowsUpdate -AcceptAll -IgnoreReboot -Verbose
        
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host "  ✨ Updates installed!" -ForegroundColor Green
        
        # Check if reboot is needed
        $rebootRequired = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired" -ErrorAction SilentlyContinue)
        
        if ($rebootRequired) {
            Write-Host ""
            Write-Host "  ⚠️  REBOOT REQUIRED to complete installation" -ForegroundColor Yellow
            Write-Host ""
            $reboot = Read-Host "  Reboot now? (y/N)"
            if ($reboot -eq 'y' -or $reboot -eq 'Y') {
                Write-Host "  Rebooting in 10 seconds..." -ForegroundColor Yellow
                Start-Sleep -Seconds 10
                Restart-Computer -Force
            }
        }
        Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    }
}

Write-Host ""
Read-Host "Press Enter to exit"
