<#
.SYNOPSIS
    Quick temperature check using thermal-pulse

.DESCRIPTION
    Shows current CPU and GPU temperatures with status indicators.
    
.EXAMPLE
    .\temp-check.ps1
    .\temp-check.ps1 -Watch
    .\temp-check.ps1 -Json
#>

param(
    [switch]$Watch,
    [switch]$Json,
    [int]$Interval = 2
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$thermalPulse = Join-Path (Split-Path -Parent $scriptDir) "tools\thermal-pulse\src\cli.js"

if (-not (Test-Path $thermalPulse)) {
    Write-Host "❌ thermal-pulse not found at: $thermalPulse" -ForegroundColor Red
    Write-Host "   Run: git submodule update --init" -ForegroundColor Gray
    exit 1
}

$format = if ($Json) { "json" } else { "text" }
$args = @("--format", $format)

if ($Watch) {
    $args += @("--watch", "--interval", ($Interval * 1000))
}

node $thermalPulse @args
