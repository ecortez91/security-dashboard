#!/bin/bash
#
# Security Dashboard - Enable Firewall (macOS)
#
# Enables and configures the macOS Application Firewall.
# Run with: sudo bash enable-firewall.sh
#

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🛡️  Security Dashboard - Enable Firewall (macOS)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Check for macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "❌ This script is for macOS only"
    exit 1
fi

echo "🔧 Enabling Application Firewall..."
/usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

echo "🔧 Enabling stealth mode (don't respond to pings)..."
/usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on

echo "🔧 Enabling logging..."
/usr/libexec/ApplicationFirewall/socketfilterfw --setloggingmode on

echo "🔧 Blocking all incoming connections (except essential services)..."
/usr/libexec/ApplicationFirewall/socketfilterfw --setblockall on

echo ""
echo "Current firewall status:"
echo ""
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode
/usr/libexec/ApplicationFirewall/socketfilterfw --getblockall

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✨ Firewall enabled!"
echo ""
echo "  Settings applied:"
echo "  • Application Firewall: ON"
echo "  • Stealth Mode: ON (won't respond to pings)"
echo "  • Block All Incoming: ON"
echo ""
echo "  To allow specific apps, go to:"
echo "  System Settings → Network → Firewall → Options"
echo "═══════════════════════════════════════════════════════════"
