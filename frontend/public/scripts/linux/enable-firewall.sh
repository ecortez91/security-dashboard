#!/bin/bash
#
# Security Dashboard - Enable Firewall (Linux)
# 
# This script enables and configures UFW or iptables firewall.
# Run with: sudo bash enable-firewall.sh
#

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🛡️  Security Dashboard - Enable Firewall (Linux)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

# Detect firewall system
if command -v ufw &> /dev/null; then
    echo "📦 Found: UFW (Uncomplicated Firewall)"
    echo ""
    
    echo "🔧 Enabling UFW..."
    ufw --force enable
    
    echo "🔧 Setting default policies..."
    ufw default deny incoming
    ufw default allow outgoing
    
    echo "🔧 Allowing SSH (port 22) to prevent lockout..."
    ufw allow ssh
    
    echo ""
    echo "✅ UFW Firewall enabled!"
    echo ""
    echo "Current status:"
    ufw status verbose
    
elif command -v firewall-cmd &> /dev/null; then
    echo "📦 Found: firewalld"
    echo ""
    
    echo "🔧 Starting firewalld..."
    systemctl start firewalld
    systemctl enable firewalld
    
    echo "🔧 Setting default zone to drop..."
    firewall-cmd --set-default-zone=drop
    
    echo "🔧 Allowing SSH..."
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --reload
    
    echo ""
    echo "✅ firewalld enabled!"
    firewall-cmd --list-all
    
else
    echo "📦 Using: iptables (fallback)"
    echo ""
    
    echo "🔧 Flushing existing rules..."
    iptables -F
    
    echo "🔧 Setting default policies..."
    iptables -P INPUT DROP
    iptables -P FORWARD DROP
    iptables -P OUTPUT ACCEPT
    
    echo "🔧 Allowing loopback..."
    iptables -A INPUT -i lo -j ACCEPT
    
    echo "🔧 Allowing established connections..."
    iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    
    echo "🔧 Allowing SSH..."
    iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    
    # Save rules
    if command -v iptables-save &> /dev/null; then
        iptables-save > /etc/iptables.rules
        echo "📁 Rules saved to /etc/iptables.rules"
    fi
    
    echo ""
    echo "✅ iptables configured!"
    iptables -L -v
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✨ Firewall setup complete!"
echo "═══════════════════════════════════════════════════════════"
