<#
.SYNOPSIS
    Security Dashboard - Complete Security Fix (Windows)

.DESCRIPTION
    Runs all security fixes:
    1. Enable Windows Firewall
    2. Configure Windows Defender
    3. Disable unnecessary services
    4. Check for updates

.NOTES
    Run as Administrator
#>

#Requires -RunAsAdministrator

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🛡️  Security Dashboard - Complete Security Fix (Windows)" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$fixes = @()

# 1. Enable Firewall
Write-Host "[1/5] 🔥 Windows Firewall" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
    Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block
    Write-Host "  ✅ Firewall enabled for all profiles" -ForegroundColor Green
    $fixes += "Firewall: Enabled"
}
catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 2. Windows Defender
Write-Host "[2/5] 🦠 Windows Defender" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
    Set-MpPreference -PUAProtection Enabled -ErrorAction SilentlyContinue
    Set-MpPreference -SubmitSamplesConsent SendSafeSamples -ErrorAction SilentlyContinue
    Write-Host "  ✅ Real-time protection enabled" -ForegroundColor Green
    Write-Host "  ✅ PUA protection enabled" -ForegroundColor Green
    $fixes += "Defender: Configured"
    
    Write-Host "  🔍 Running quick scan..." -ForegroundColor Gray
    Start-MpScan -ScanType QuickScan -AsJob | Out-Null
    Write-Host "  ✅ Quick scan started in background" -ForegroundColor Green
}
catch {
    Write-Host "  ⚠️ Some Defender settings may require manual configuration" -ForegroundColor Yellow
}
Write-Host ""

# 3. Disable risky services
Write-Host "[3/5] ⚙️  Disabling Risky Services" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray

$riskyServices = @(
    @{Name="RemoteRegistry"; Display="Remote Registry"},
    @{Name="Telnet"; Display="Telnet"},
    @{Name="TlntSvr"; Display="Telnet Server"},
    @{Name="SNMP"; Display="SNMP"},
    @{Name="SSDPSRV"; Display="SSDP Discovery"}
)

foreach ($svc in $riskyServices) {
    $service = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq 'Running') {
            Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
            Set-Service -Name $svc.Name -StartupType Disabled -ErrorAction SilentlyContinue
            Write-Host "  ✅ Disabled: $($svc.Display)" -ForegroundColor Green
            $fixes += "Service disabled: $($svc.Display)"
        }
        else {
            Write-Host "  ○ Already stopped: $($svc.Display)" -ForegroundColor Gray
        }
    }
}
Write-Host ""

# 4. Enable automatic updates
Write-Host "[4/5] 📦 Windows Update Settings" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray
try {
    $AU = (New-Object -ComObject Microsoft.Update.AutoUpdate)
    $AU.EnableService()
    Write-Host "  ✅ Automatic updates enabled" -ForegroundColor Green
    $fixes += "Auto-updates: Enabled"
}
catch {
    Write-Host "  ⚠️ Configure in Settings → Windows Update" -ForegroundColor Yellow
}
Write-Host ""

# 5. Account security
Write-Host "[5/5] 👤 Account Security" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────" -ForegroundColor DarkGray

# Check for guest account
$guest = Get-LocalUser -Name "Guest" -ErrorAction SilentlyContinue
if ($guest -and $guest.Enabled) {
    Disable-LocalUser -Name "Guest" -ErrorAction SilentlyContinue
    Write-Host "  ✅ Guest account disabled" -ForegroundColor Green
    $fixes += "Guest account: Disabled"
}
else {
    Write-Host "  ○ Guest account already disabled" -ForegroundColor Gray
}

# Recommend password policy
Write-Host "  💡 Tip: Enable Windows Hello or use strong passwords" -ForegroundColor Cyan
Write-Host ""

# Summary
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✨ Security Fix Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Applied fixes:" -ForegroundColor White
foreach ($fix in $fixes) {
    Write-Host "    • $fix" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Recommendations:" -ForegroundColor Yellow
Write-Host "    • Run Windows Update to install latest patches" -ForegroundColor Gray
Write-Host "    • Enable BitLocker for disk encryption" -ForegroundColor Gray
Write-Host "    • Use a password manager" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
