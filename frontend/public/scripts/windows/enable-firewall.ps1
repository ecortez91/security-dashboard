<#
.SYNOPSIS
    Security Dashboard - Enable Windows Firewall

.DESCRIPTION
    Enables Windows Defender Firewall for all network profiles
    and configures secure default rules.

.NOTES
    Run as Administrator:
    Right-click PowerShell → Run as Administrator
    Then: .\enable-firewall.ps1
#>

#Requires -RunAsAdministrator

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🛡️  Security Dashboard - Enable Windows Firewall" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "🔧 Enabling Windows Firewall for all profiles..." -ForegroundColor Yellow
    Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
    Write-Host "   ✅ Firewall enabled for Domain, Public, and Private networks" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🔧 Setting default inbound action to Block..." -ForegroundColor Yellow
    Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block
    Write-Host "   ✅ Inbound connections blocked by default" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🔧 Setting default outbound action to Allow..." -ForegroundColor Yellow
    Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultOutboundAction Allow
    Write-Host "   ✅ Outbound connections allowed by default" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🔧 Enabling firewall logging..." -ForegroundColor Yellow
    Set-NetFirewallProfile -Profile Domain,Public,Private -LogBlocked True -LogAllowed False
    Write-Host "   ✅ Logging enabled for blocked connections" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "📊 Current Firewall Status:" -ForegroundColor Cyan
    Write-Host ""
    Get-NetFirewallProfile | Format-Table Name, Enabled, DefaultInboundAction, DefaultOutboundAction -AutoSize
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  ✨ Windows Firewall enabled and configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Settings applied:" -ForegroundColor White
    Write-Host "  • All profiles: Enabled" -ForegroundColor Gray
    Write-Host "  • Inbound: Block by default" -ForegroundColor Gray
    Write-Host "  • Outbound: Allow by default" -ForegroundColor Gray
    Write-Host "  • Logging: Enabled for blocked traffic" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  To manage rules: Windows Security → Firewall" -ForegroundColor Gray
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Read-Host "Press Enter to exit"
