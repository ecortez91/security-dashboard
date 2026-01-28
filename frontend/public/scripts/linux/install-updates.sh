#!/bin/bash
#
# Security Dashboard - Install System Updates (Linux)
#
# Detects package manager and installs all available updates.
# Run with: sudo bash install-updates.sh
#

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  📦 Security Dashboard - Install System Updates"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Detect package manager
if command -v apt-get &> /dev/null; then
    echo "📦 Detected: Debian/Ubuntu (apt)"
    echo ""
    
    echo "🔄 Updating package lists..."
    apt-get update
    
    echo ""
    echo "🔄 Installing security updates..."
    apt-get upgrade -y
    
    echo ""
    echo "🔄 Removing unused packages..."
    apt-get autoremove -y
    
    echo ""
    echo "🔄 Cleaning package cache..."
    apt-get clean
    
elif command -v dnf &> /dev/null; then
    echo "📦 Detected: Fedora/RHEL 8+ (dnf)"
    echo ""
    
    echo "🔄 Checking for updates..."
    dnf check-update || true
    
    echo ""
    echo "🔄 Installing updates..."
    dnf upgrade -y
    
    echo ""
    echo "🔄 Cleaning cache..."
    dnf clean all
    
elif command -v yum &> /dev/null; then
    echo "📦 Detected: RHEL/CentOS (yum)"
    echo ""
    
    echo "🔄 Checking for updates..."
    yum check-update || true
    
    echo ""
    echo "🔄 Installing updates..."
    yum update -y
    
    echo ""
    echo "🔄 Cleaning cache..."
    yum clean all
    
elif command -v pacman &> /dev/null; then
    echo "📦 Detected: Arch Linux (pacman)"
    echo ""
    
    echo "🔄 Syncing and upgrading..."
    pacman -Syu --noconfirm
    
elif command -v zypper &> /dev/null; then
    echo "📦 Detected: openSUSE (zypper)"
    echo ""
    
    echo "🔄 Refreshing repositories..."
    zypper refresh
    
    echo ""
    echo "🔄 Installing updates..."
    zypper update -y
    
elif command -v apk &> /dev/null; then
    echo "📦 Detected: Alpine Linux (apk)"
    echo ""
    
    echo "🔄 Updating and upgrading..."
    apk update
    apk upgrade
    
else
    echo "❌ Unknown package manager. Please update manually."
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✨ Updates installed successfully!"
echo ""

# Check if reboot is needed
if [ -f /var/run/reboot-required ]; then
    echo "  ⚠️  REBOOT REQUIRED for some updates to take effect"
    echo ""
    read -p "  Reboot now? (y/N): " reboot_confirm
    if [[ "$reboot_confirm" =~ ^[Yy]$ ]]; then
        echo "  Rebooting in 5 seconds..."
        sleep 5
        reboot
    fi
fi

echo "═══════════════════════════════════════════════════════════"
