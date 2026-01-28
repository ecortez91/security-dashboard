#!/bin/bash
#
# Security Dashboard - Harden SSH (Linux)
#
# This script applies security best practices to SSH configuration.
# Run with: sudo bash harden-ssh.sh
#
# ⚠️  WARNING: This will disable password authentication!
#     Make sure you have SSH key access before running.
#

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🔐 Security Dashboard - Harden SSH Configuration"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP_FILE="/etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)"

if [ ! -f "$SSHD_CONFIG" ]; then
    echo "❌ SSH config not found at $SSHD_CONFIG"
    exit 1
fi

echo "⚠️  WARNING: This will disable password authentication!"
echo "   Make sure you have SSH key access configured."
echo ""
read -p "Continue? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "📁 Creating backup at $BACKUP_FILE..."
cp "$SSHD_CONFIG" "$BACKUP_FILE"

echo "🔧 Applying security hardening..."

# Function to set or add config option
set_config() {
    local key="$1"
    local value="$2"
    
    if grep -qE "^#?${key}\s" "$SSHD_CONFIG"; then
        sed -i "s/^#*${key}\s.*/${key} ${value}/" "$SSHD_CONFIG"
    else
        echo "${key} ${value}" >> "$SSHD_CONFIG"
    fi
    echo "   ✓ ${key} ${value}"
}

echo ""
echo "Applying settings:"

# Core security settings
set_config "PermitRootLogin" "no"
set_config "PasswordAuthentication" "no"
set_config "PubkeyAuthentication" "yes"
set_config "PermitEmptyPasswords" "no"
set_config "ChallengeResponseAuthentication" "no"
set_config "UsePAM" "yes"

# Additional hardening
set_config "X11Forwarding" "no"
set_config "MaxAuthTries" "3"
set_config "MaxSessions" "3"
set_config "AllowAgentForwarding" "no"
set_config "AllowTcpForwarding" "no"
set_config "ClientAliveInterval" "300"
set_config "ClientAliveCountMax" "2"
set_config "LoginGraceTime" "30"

# Protocol and ciphers
set_config "Protocol" "2"

echo ""
echo "🔄 Validating configuration..."
if sshd -t; then
    echo "   ✓ Configuration valid"
else
    echo "❌ Configuration invalid! Restoring backup..."
    cp "$BACKUP_FILE" "$SSHD_CONFIG"
    exit 1
fi

echo ""
echo "🔄 Restarting SSH service..."
if systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || service ssh restart 2>/dev/null; then
    echo "   ✓ SSH service restarted"
else
    echo "⚠️  Could not restart SSH. Please restart manually."
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✨ SSH hardening complete!"
echo ""
echo "  Changes applied:"
echo "  • Root login disabled"
echo "  • Password authentication disabled"
echo "  • Public key authentication enabled"
echo "  • Max auth tries: 3"
echo "  • Session timeout: 5 minutes"
echo ""
echo "  Backup saved to: $BACKUP_FILE"
echo ""
echo "  ⚠️  Test SSH access in a NEW terminal before closing this one!"
echo "═══════════════════════════════════════════════════════════"
