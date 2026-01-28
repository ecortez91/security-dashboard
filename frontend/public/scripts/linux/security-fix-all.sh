#!/bin/bash
#
# Security Dashboard - Complete Security Fix (Linux)
#
# Runs all security fixes:
# 1. Enable firewall
# 2. Install updates
# 3. Disable risky services
# 4. Fix file permissions
# 5. Basic hardening
#
# Run with: sudo bash security-fix-all.sh
#

set -e

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🛡️  Security Dashboard - Complete Security Fix (Linux)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

FIXES=()

# 1. Enable Firewall
echo "[1/5] 🔥 Firewall Configuration"
echo "─────────────────────────────────────────────"

if command -v ufw &> /dev/null; then
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    echo "  ✅ UFW enabled with secure defaults"
    FIXES+=("Firewall: UFW enabled")
elif command -v firewall-cmd &> /dev/null; then
    systemctl enable --now firewalld
    firewall-cmd --set-default-zone=drop
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --reload
    echo "  ✅ firewalld enabled"
    FIXES+=("Firewall: firewalld enabled")
else
    echo "  ⚠️ No firewall manager found. Install ufw or firewalld."
fi
echo ""

# 2. Install Updates
echo "[2/5] 📦 System Updates"
echo "─────────────────────────────────────────────"

if command -v apt-get &> /dev/null; then
    apt-get update -qq
    apt-get upgrade -y -qq
    apt-get autoremove -y -qq
    echo "  ✅ APT packages updated"
    FIXES+=("Updates: APT packages updated")
elif command -v dnf &> /dev/null; then
    dnf upgrade -y -q
    echo "  ✅ DNF packages updated"
    FIXES+=("Updates: DNF packages updated")
elif command -v yum &> /dev/null; then
    yum update -y -q
    echo "  ✅ YUM packages updated"
    FIXES+=("Updates: YUM packages updated")
elif command -v pacman &> /dev/null; then
    pacman -Syu --noconfirm
    echo "  ✅ Pacman packages updated"
    FIXES+=("Updates: Pacman packages updated")
fi
echo ""

# 3. Disable Risky Services
echo "[3/5] ⚙️  Disabling Risky Services"
echo "─────────────────────────────────────────────"

RISKY_SERVICES=("telnet" "telnet.socket" "rsh" "rlogin" "tftp" "xinetd" "vsftpd" "rpcbind")

for svc in "${RISKY_SERVICES[@]}"; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
        systemctl stop "$svc" 2>/dev/null || true
        systemctl disable "$svc" 2>/dev/null || true
        echo "  ✅ Disabled: $svc"
        FIXES+=("Service disabled: $svc")
    fi
done
echo "  ○ Checked ${#RISKY_SERVICES[@]} risky services"
echo ""

# 4. Fix File Permissions
echo "[4/5] 📁 File Permissions"
echo "─────────────────────────────────────────────"

# Secure SSH config
if [ -f /etc/ssh/sshd_config ]; then
    chmod 600 /etc/ssh/sshd_config
    echo "  ✅ /etc/ssh/sshd_config: 600"
fi

# Secure passwd/shadow
chmod 644 /etc/passwd 2>/dev/null && echo "  ✅ /etc/passwd: 644"
chmod 640 /etc/shadow 2>/dev/null && echo "  ✅ /etc/shadow: 640"
chmod 644 /etc/group 2>/dev/null && echo "  ✅ /etc/group: 644"

# Secure cron
chmod 700 /etc/crontab 2>/dev/null && echo "  ✅ /etc/crontab: 700"
chmod 700 /var/spool/cron 2>/dev/null || true

FIXES+=("Permissions: Critical files secured")
echo ""

# 5. Basic Hardening
echo "[5/5] 🔐 Basic Hardening"
echo "─────────────────────────────────────────────"

# Disable root login via password
if [ -f /etc/ssh/sshd_config ]; then
    if ! grep -q "^PermitRootLogin no" /etc/ssh/sshd_config; then
        sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config || \
            echo "PermitRootLogin no" >> /etc/ssh/sshd_config
        echo "  ✅ SSH root login disabled"
        FIXES+=("SSH: Root login disabled")
    else
        echo "  ○ SSH root login already disabled"
    fi
fi

# Set secure umask
if ! grep -q "umask 027" /etc/profile; then
    echo "umask 027" >> /etc/profile
    echo "  ✅ Default umask set to 027"
fi

# Disable core dumps
if ! grep -q "hard core 0" /etc/security/limits.conf 2>/dev/null; then
    echo "* hard core 0" >> /etc/security/limits.conf
    echo "  ✅ Core dumps disabled"
fi

# Restart SSH if changed
if systemctl is-active --quiet sshd 2>/dev/null; then
    systemctl restart sshd
    echo "  ✅ SSH service restarted"
elif systemctl is-active --quiet ssh 2>/dev/null; then
    systemctl restart ssh
    echo "  ✅ SSH service restarted"
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════"
echo "  ✨ Security Fix Complete!"
echo ""
echo "  Applied fixes:"
for fix in "${FIXES[@]}"; do
    echo "    • $fix"
done
echo ""
echo "  Recommendations:"
echo "    • Review /var/log/auth.log for suspicious activity"
echo "    • Set up fail2ban for brute-force protection"
echo "    • Enable automatic security updates (unattended-upgrades)"
echo "    • Configure log rotation and monitoring"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if reboot needed
if [ -f /var/run/reboot-required ]; then
    echo "⚠️  REBOOT REQUIRED for some changes to take effect"
    read -p "Reboot now? (y/N): " reboot_confirm
    if [[ "$reboot_confirm" =~ ^[Yy]$ ]]; then
        reboot
    fi
fi
