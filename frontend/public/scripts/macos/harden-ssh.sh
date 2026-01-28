#!/bin/bash
#
# Security Dashboard - Harden SSH (macOS)
#
# Applies security best practices to SSH on macOS.
# Run with: sudo bash harden-ssh.sh
#

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🔐 Security Dashboard - Harden SSH (macOS)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP_FILE="/etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)"

echo "📋 Current Remote Login status:"
systemsetup -getremotelogin 2>/dev/null || echo "   (Unable to check)"
echo ""

read -p "Do you want to DISABLE Remote Login (SSH) entirely? (y/N): " disable_ssh
if [[ "$disable_ssh" =~ ^[Yy]$ ]]; then
    echo "🔧 Disabling Remote Login..."
    systemsetup -setremotelogin off
    echo ""
    echo "✅ Remote Login (SSH) has been DISABLED."
    echo "   No further hardening needed."
    exit 0
fi

if [ ! -f "$SSHD_CONFIG" ]; then
    echo "❌ SSH config not found. Is Remote Login enabled?"
    exit 1
fi

echo "⚠️  This will harden SSH but keep it enabled."
echo "   Password authentication will be DISABLED."
echo ""
read -p "Continue? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "📁 Creating backup at $BACKUP_FILE..."
cp "$SSHD_CONFIG" "$BACKUP_FILE"

echo "🔧 Applying security settings..."

# Function to set config
set_config() {
    local key="$1"
    local value="$2"
    
    if grep -qE "^#?${key}\s" "$SSHD_CONFIG"; then
        sed -i '' "s/^#*${key}.*/${key} ${value}/" "$SSHD_CONFIG"
    else
        echo "${key} ${value}" >> "$SSHD_CONFIG"
    fi
    echo "   ✓ ${key} ${value}"
}

set_config "PermitRootLogin" "no"
set_config "PasswordAuthentication" "no"
set_config "PubkeyAuthentication" "yes"
set_config "ChallengeResponseAuthentication" "no"
set_config "UsePAM" "no"
set_config "X11Forwarding" "no"
set_config "MaxAuthTries" "3"
set_config "ClientAliveInterval" "300"
set_config "ClientAliveCountMax" "2"

echo ""
echo "🔄 Restarting SSH service..."
launchctl unload /System/Library/LaunchDaemons/ssh.plist 2>/dev/null || true
launchctl load -w /System/Library/LaunchDaemons/ssh.plist 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✨ SSH hardening complete!"
echo ""
echo "  Backup saved to: $BACKUP_FILE"
echo "  ⚠️  Test SSH access before closing this terminal!"
echo "═══════════════════════════════════════════════════════════"
