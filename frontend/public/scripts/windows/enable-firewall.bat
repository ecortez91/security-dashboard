@echo off
:: Security Dashboard - Enable Firewall (Double-click launcher)
:: This will request Administrator privileges automatically

echo.
echo ===============================================
echo   Security Dashboard - Enable Windows Firewall
echo ===============================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0enable-firewall.ps1"

pause
