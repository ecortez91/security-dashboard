/**
 * Script Metadata
 * 
 * Provides information about available fix scripts for download.
 */

export const scripts = {
  // All-in-one fixes
  'security-fix-all': {
    name: 'Complete Security Fix',
    description: 'Runs all security fixes: firewall, updates, services, permissions, and hardening',
    platforms: {
      linux: {
        file: '/scripts/linux/security-fix-all.sh',
        command: 'sudo bash security-fix-all.sh',
        type: 'shell'
      },
      windows: {
        file: '/scripts/windows/security-fix-all.ps1',
        command: 'Right-click → Run as Administrator',
        type: 'powershell'
      },
      macos: {
        file: '/scripts/macos/security-fix-all.sh',
        command: 'sudo bash security-fix-all.sh',
        type: 'shell'
      }
    }
  },
  
  // Firewall
  'enable-firewall': {
    name: 'Enable Firewall',
    description: 'Enables and configures the system firewall with secure defaults',
    platforms: {
      linux: {
        file: '/scripts/linux/enable-firewall.sh',
        command: 'sudo bash enable-firewall.sh',
        type: 'shell',
        details: [
          'Enables UFW, firewalld, or iptables (auto-detected)',
          'Sets default policy to deny incoming, allow outgoing',
          'Allows SSH (port 22) to prevent lockout'
        ]
      },
      windows: {
        file: '/scripts/windows/enable-firewall.ps1',
        command: 'Run enable-firewall.bat (double-click) or PowerShell as Admin',
        doubleClick: '/scripts/windows/enable-firewall.bat',
        type: 'powershell',
        details: [
          'Enables Windows Defender Firewall for all profiles',
          'Blocks all incoming by default',
          'Allows all outgoing by default',
          'Enables logging for blocked connections'
        ]
      },
      macos: {
        file: '/scripts/macos/enable-firewall.sh',
        command: 'sudo bash enable-firewall.sh',
        type: 'shell',
        details: [
          'Enables Application Firewall',
          'Enables Stealth Mode (ignores pings)',
          'Blocks all incoming connections'
        ]
      }
    }
  },
  
  // SSH Hardening
  'harden-ssh': {
    name: 'Harden SSH',
    description: 'Applies security best practices to SSH configuration',
    warning: '⚠️ This will disable password authentication. Ensure you have SSH key access first!',
    platforms: {
      linux: {
        file: '/scripts/linux/harden-ssh.sh',
        command: 'sudo bash harden-ssh.sh',
        type: 'shell',
        details: [
          'Disables root login',
          'Disables password authentication',
          'Enables public key authentication only',
          'Sets max auth tries to 3',
          'Enables session timeouts',
          'Creates backup of original config'
        ]
      },
      macos: {
        file: '/scripts/macos/harden-ssh.sh',
        command: 'sudo bash harden-ssh.sh',
        type: 'shell',
        details: [
          'Option to disable Remote Login entirely',
          'Or harden with key-only authentication',
          'Creates backup of original config'
        ]
      }
    }
  },
  
  // System Updates
  'install-updates': {
    name: 'Install System Updates',
    description: 'Downloads and installs all available system updates',
    platforms: {
      linux: {
        file: '/scripts/linux/install-updates.sh',
        command: 'sudo bash install-updates.sh',
        type: 'shell',
        details: [
          'Auto-detects package manager (apt, dnf, yum, pacman, etc.)',
          'Updates package lists',
          'Installs all available updates',
          'Cleans package cache',
          'Prompts for reboot if required'
        ]
      },
      windows: {
        file: '/scripts/windows/install-updates.ps1',
        command: 'Run as Administrator in PowerShell',
        type: 'powershell',
        details: [
          'Checks for available Windows Updates',
          'Downloads and installs all updates',
          'Prompts for reboot if required'
        ]
      },
      macos: {
        file: null,
        command: 'softwareupdate -ia --verbose',
        type: 'manual',
        details: [
          'Run: softwareupdate -l (list updates)',
          'Run: sudo softwareupdate -ia (install all)',
          'Or use: System Settings → General → Software Update'
        ]
      }
    }
  }
};

/**
 * Get scripts for current platform
 */
export function getScriptsForPlatform(platform) {
  const result = {};
  
  for (const [id, script] of Object.entries(scripts)) {
    if (script.platforms[platform]) {
      result[id] = {
        ...script,
        platform: script.platforms[platform]
      };
      delete result[id].platforms;
    }
  }
  
  return result;
}

/**
 * Detect platform from request or environment
 */
export function detectPlatform(userAgent = '') {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  
  // Default to linux for WSL
  return 'linux';
}
