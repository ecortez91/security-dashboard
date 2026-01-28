/**
 * AI-Powered Fix Suggestions
 * 
 * Analyzes security check results and searches for solutions.
 * Uses web search + AI to generate context-aware fix recommendations.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Search the web for solutions to a specific issue
 */
async function searchForSolutions(query, platform = 'linux') {
  try {
    // Use a simple web search approach
    const searchQuery = encodeURIComponent(`${query} ${platform} fix solution`);
    
    // Try to use curl to fetch search results (simplified)
    // In production, you'd use a proper search API
    const { stdout } = await execAsync(
      `curl -s "https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1" 2>/dev/null | head -c 5000`,
      { timeout: 10000 }
    );
    
    try {
      const data = JSON.parse(stdout);
      return {
        abstract: data.AbstractText || null,
        source: data.AbstractSource || null,
        url: data.AbstractURL || null,
        relatedTopics: (data.RelatedTopics || []).slice(0, 3).map(t => ({
          text: t.Text,
          url: t.FirstURL
        }))
      };
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Detect the current platform
 */
async function detectPlatform() {
  try {
    const { stdout } = await execAsync('uname -s');
    const os = stdout.trim().toLowerCase();
    
    if (os === 'darwin') return 'macos';
    if (os === 'linux') {
      // Check if WSL
      try {
        const { stdout: release } = await execAsync('cat /proc/version');
        if (release.toLowerCase().includes('microsoft')) return 'wsl';
      } catch {}
      return 'linux';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Generate fix suggestions based on check results
 */
export async function generateFixSuggestions(check) {
  const platform = await detectPlatform();
  const suggestions = {
    checkId: check.id,
    checkName: check.name,
    status: check.status,
    platform,
    timestamp: new Date().toISOString(),
    analysis: '',
    suggestedFixes: [],
    searchResults: null,
    generatedScript: null,
  };

  // Analyze the check and generate suggestions
  const details = check.details || {};
  const recommendations = check.recommendations || [];
  
  // Build analysis based on check type and details
  let analysis = `Issue detected: ${check.message}\n\n`;
  
  // Check-specific analysis
  switch (check.id) {
    case 'firewall':
      analysis += analyzeFirewallIssue(details, platform);
      suggestions.suggestedFixes = getFirewallFixes(details, platform);
      break;
      
    case 'updates':
      analysis += analyzeUpdatesIssue(details, platform);
      suggestions.suggestedFixes = getUpdatesFixes(details, platform);
      break;
      
    case 'ssh':
      analysis += analyzeSSHIssue(details, platform);
      suggestions.suggestedFixes = getSSHFixes(details, platform);
      break;
      
    case 'permissions':
      analysis += analyzePermissionsIssue(details, platform);
      suggestions.suggestedFixes = getPermissionsFixes(details, platform);
      break;
      
    case 'services':
      analysis += analyzeServicesIssue(details, platform);
      suggestions.suggestedFixes = getServicesFixes(details, platform);
      break;
      
    case 'openPorts':
      analysis += analyzePortsIssue(details, platform);
      suggestions.suggestedFixes = getPortsFixes(details, platform);
      break;
      
    case 'temperature':
    case 'hardware':
      analysis += analyzeHardwareIssue(details, platform);
      suggestions.suggestedFixes = getHardwareFixes(details, platform);
      break;
      
    default:
      // Generic analysis for unknown check types
      analysis += `Check details:\n${JSON.stringify(details, null, 2)}\n\n`;
      analysis += `Recommendations from check:\n`;
      recommendations.forEach((r, i) => {
        analysis += `${i + 1}. [${r.severity}] ${r.message}\n`;
      });
      
      // Search for solutions
      const searchQuery = `${check.name} ${check.message} ${recommendations[0]?.message || ''}`;
      suggestions.searchResults = await searchForSolutions(searchQuery, platform);
      
      suggestions.suggestedFixes = [{
        title: 'Research Required',
        description: 'This issue requires manual investigation. See search results for potential solutions.',
        steps: [
          'Review the check details above',
          'Search for the specific error message online',
          'Consult system documentation',
          'Consider reaching out to support forums'
        ],
        risk: 'low',
        automated: false
      }];
  }
  
  suggestions.analysis = analysis;
  
  // Generate a script if we have actionable fixes
  const scriptableFixes = suggestions.suggestedFixes.filter(f => f.commands && f.commands.length > 0);
  if (scriptableFixes.length > 0) {
    suggestions.generatedScript = generateScript(scriptableFixes, platform, check);
  }
  
  return suggestions;
}

// ============ Check-specific analyzers ============

function analyzeFirewallIssue(details, platform) {
  let analysis = '';
  
  if (details.ufw?.installed && !details.ufw?.active) {
    analysis += '🔍 UFW is installed but not active.\n';
    analysis += 'This means your system has firewall software but it\'s disabled.\n\n';
  }
  
  if (details.windowsFirewall?.available) {
    const disabled = details.windowsFirewall.profiles?.filter(p => !p.enabled) || [];
    if (disabled.length > 0) {
      analysis += `🔍 Windows Firewall is disabled for: ${disabled.map(p => p.name).join(', ')}\n`;
      analysis += 'These network profiles are unprotected.\n\n';
    }
  }
  
  if (!details.ufw?.installed && !details.windowsFirewall?.available && details.iptables?.rulesCount === 0) {
    analysis += '🔍 No active firewall protection detected.\n';
    analysis += 'Your system is exposed to network attacks.\n\n';
  }
  
  return analysis;
}

function getFirewallFixes(details, platform) {
  const fixes = [];
  
  if (platform === 'linux' || platform === 'wsl') {
    fixes.push({
      title: 'Enable UFW Firewall',
      description: 'Enable and configure UFW with secure defaults',
      steps: [
        'Enable UFW: sudo ufw enable',
        'Set default deny incoming: sudo ufw default deny incoming',
        'Set default allow outgoing: sudo ufw default allow outgoing',
        'Allow SSH to prevent lockout: sudo ufw allow ssh',
        'Check status: sudo ufw status verbose'
      ],
      commands: [
        'sudo ufw --force enable',
        'sudo ufw default deny incoming',
        'sudo ufw default allow outgoing',
        'sudo ufw allow ssh'
      ],
      risk: 'medium',
      warning: 'Ensure SSH is allowed before enabling if you\'re connected remotely!',
      automated: true
    });
  }
  
  if (platform === 'wsl' && details.windowsFirewall?.available) {
    fixes.push({
      title: 'Enable Windows Firewall',
      description: 'Enable Windows Defender Firewall for all profiles',
      steps: [
        'Open Windows Security',
        'Click "Firewall & network protection"',
        'Enable firewall for Domain, Private, and Public networks',
        'Or run PowerShell as Admin: Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True'
      ],
      commands: [],
      risk: 'low',
      automated: false
    });
  }
  
  if (platform === 'macos') {
    fixes.push({
      title: 'Enable macOS Firewall',
      description: 'Enable the Application Firewall',
      steps: [
        'Open System Settings → Network → Firewall',
        'Turn on the Firewall',
        'Click Options to configure app permissions',
        'Enable "Block all incoming connections" for maximum security'
      ],
      commands: [
        'sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on',
        'sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on'
      ],
      risk: 'low',
      automated: true
    });
  }
  
  return fixes;
}

function analyzeUpdatesIssue(details, platform) {
  let analysis = '';
  
  if (details.apt?.totalUpdates > 0) {
    analysis += `🔍 ${details.apt.totalUpdates} package update(s) available via APT.\n`;
    if (details.apt.securityUpdates > 0) {
      analysis += `⚠️  ${details.apt.securityUpdates} are SECURITY updates - install these first!\n`;
    }
    if (details.apt.packages?.length > 0) {
      analysis += `Packages: ${details.apt.packages.join(', ')}\n`;
    }
    analysis += '\n';
  }
  
  if (details.npm?.outdatedPackages > 0) {
    analysis += `🔍 ${details.npm.outdatedPackages} npm global package(s) outdated.\n`;
    if (details.npm.packages?.length > 0) {
      analysis += `Packages: ${details.npm.packages.join(', ')}\n`;
    }
    analysis += '\n';
  }
  
  return analysis;
}

function getUpdatesFixes(details, platform) {
  const fixes = [];
  
  if (details.apt?.totalUpdates > 0) {
    fixes.push({
      title: 'Install APT Package Updates',
      description: `Update ${details.apt.totalUpdates} package(s) to latest versions`,
      steps: [
        'Update package lists: sudo apt-get update',
        'Install all updates: sudo apt-get upgrade -y',
        'Remove unused packages: sudo apt-get autoremove -y',
        'Reboot if kernel was updated: sudo reboot'
      ],
      commands: [
        'sudo apt-get update',
        'sudo apt-get upgrade -y',
        'sudo apt-get autoremove -y'
      ],
      risk: 'low',
      automated: true
    });
    
    if (details.apt.securityUpdates > 0) {
      fixes.unshift({
        title: '🚨 Install Security Updates First',
        description: `${details.apt.securityUpdates} critical security update(s) available`,
        steps: [
          'Install security updates only: sudo apt-get upgrade -y --only-upgrade',
          'Or use unattended-upgrades for automatic security updates'
        ],
        commands: [
          'sudo apt-get update',
          'sudo apt-get upgrade -y'
        ],
        risk: 'low',
        priority: 'critical',
        automated: true
      });
    }
  }
  
  if (details.npm?.outdatedPackages > 0) {
    fixes.push({
      title: 'Update npm Global Packages',
      description: `Update ${details.npm.outdatedPackages} outdated npm package(s)`,
      steps: [
        'Update all global packages: npm update -g',
        'Or update specific package: npm update -g <package-name>'
      ],
      commands: ['npm update -g'],
      risk: 'low',
      automated: true
    });
  }
  
  return fixes;
}

function analyzeSSHIssue(details, platform) {
  let analysis = '';
  
  if (details.permitRootLogin === 'yes') {
    analysis += '🔍 Root login via SSH is ENABLED - this is a security risk.\n';
    analysis += 'Attackers often target root accounts for brute-force attacks.\n\n';
  }
  
  if (details.passwordAuthentication === 'yes') {
    analysis += '🔍 Password authentication is ENABLED.\n';
    analysis += 'Consider using SSH keys only for better security.\n\n';
  }
  
  if (details.x11Forwarding === 'yes') {
    analysis += '🔍 X11 forwarding is enabled - usually not needed and adds attack surface.\n\n';
  }
  
  return analysis;
}

function getSSHFixes(details, platform) {
  const fixes = [];
  
  if (details.permitRootLogin === 'yes') {
    fixes.push({
      title: 'Disable Root SSH Login',
      description: 'Prevent direct root login via SSH',
      steps: [
        'Edit /etc/ssh/sshd_config',
        'Set: PermitRootLogin no',
        'Restart SSH: sudo systemctl restart sshd'
      ],
      commands: [
        "sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config",
        'sudo systemctl restart sshd'
      ],
      risk: 'medium',
      warning: 'Ensure you have another user with sudo access before disabling root login!',
      automated: true
    });
  }
  
  if (details.passwordAuthentication === 'yes') {
    fixes.push({
      title: 'Disable Password Authentication',
      description: 'Allow only SSH key authentication',
      steps: [
        'First, ensure you have SSH keys set up!',
        'Edit /etc/ssh/sshd_config',
        'Set: PasswordAuthentication no',
        'Restart SSH: sudo systemctl restart sshd'
      ],
      commands: [
        "sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
        'sudo systemctl restart sshd'
      ],
      risk: 'high',
      warning: '⚠️ CRITICAL: Ensure SSH keys are working before running this or you will be locked out!',
      automated: true
    });
  }
  
  return fixes;
}

function analyzePermissionsIssue(details, platform) {
  let analysis = '';
  
  if (details.issues && details.issues.length > 0) {
    analysis += '🔍 Permission issues found:\n';
    details.issues.forEach(issue => {
      analysis += `  - ${issue.path}: ${issue.problem}\n`;
    });
    analysis += '\n';
  }
  
  return analysis;
}

function getPermissionsFixes(details, platform) {
  const fixes = [];
  
  if (details.issues) {
    details.issues.forEach(issue => {
      fixes.push({
        title: `Fix permissions on ${issue.path}`,
        description: issue.problem,
        steps: [
          `Change permissions: sudo chmod ${issue.recommended || '600'} ${issue.path}`,
          `Verify: ls -la ${issue.path}`
        ],
        commands: [`sudo chmod ${issue.recommended || '600'} ${issue.path}`],
        risk: 'low',
        automated: true
      });
    });
  }
  
  return fixes;
}

function analyzeServicesIssue(details, platform) {
  let analysis = '';
  
  if (details.riskyServices && details.riskyServices.length > 0) {
    analysis += '🔍 Potentially risky services running:\n';
    details.riskyServices.forEach(svc => {
      analysis += `  - ${svc.name}: ${svc.reason || 'Legacy/insecure protocol'}\n`;
    });
    analysis += '\n';
  }
  
  return analysis;
}

function getServicesFixes(details, platform) {
  const fixes = [];
  
  if (details.riskyServices) {
    details.riskyServices.forEach(svc => {
      fixes.push({
        title: `Disable ${svc.name}`,
        description: `Stop and disable the ${svc.name} service`,
        steps: [
          `Stop service: sudo systemctl stop ${svc.name}`,
          `Disable service: sudo systemctl disable ${svc.name}`,
          `Verify: sudo systemctl status ${svc.name}`
        ],
        commands: [
          `sudo systemctl stop ${svc.name}`,
          `sudo systemctl disable ${svc.name}`
        ],
        risk: 'medium',
        warning: `Ensure nothing depends on ${svc.name} before disabling`,
        automated: true
      });
    });
  }
  
  return fixes;
}

function analyzePortsIssue(details, platform) {
  let analysis = '';
  
  if (details.exposedPorts && details.exposedPorts.length > 0) {
    analysis += '🔍 Ports exposed to all interfaces (0.0.0.0):\n';
    details.exposedPorts.forEach(port => {
      analysis += `  - Port ${port.port} (${port.service || 'unknown'}): ${port.process || 'unknown process'}\n`;
    });
    analysis += '\nThese ports are accessible from any network interface.\n\n';
  }
  
  return analysis;
}

function getPortsFixes(details, platform) {
  const fixes = [];
  
  if (details.exposedPorts) {
    fixes.push({
      title: 'Review and Restrict Open Ports',
      description: 'Bind services to localhost or specific interfaces',
      steps: [
        'For each exposed port, decide if it needs to be public',
        'Configure the service to bind to 127.0.0.1 if only local access needed',
        'Use firewall rules to restrict access to specific IPs',
        'Close unused ports'
      ],
      commands: [],
      risk: 'medium',
      automated: false
    });
    
    details.exposedPorts.forEach(port => {
      if (port.service === 'ssh' || port.port === 22) {
        fixes.push({
          title: 'Restrict SSH Access',
          description: 'Allow SSH only from specific IPs',
          steps: [
            'Add allowed IPs to UFW: sudo ufw allow from <YOUR_IP> to any port 22',
            'Delete the general SSH allow rule: sudo ufw delete allow ssh',
            'Or configure /etc/hosts.allow and /etc/hosts.deny'
          ],
          commands: [],
          risk: 'high',
          warning: 'Be careful not to lock yourself out!',
          automated: false
        });
      }
    });
  }
  
  return fixes;
}

function analyzeHardwareIssue(details, platform) {
  let analysis = '';
  
  if (details.cpu?.current > 80) {
    analysis += `🔍 CPU temperature is HIGH: ${details.cpu.current}°C\n`;
    analysis += 'This could indicate cooling issues or high system load.\n\n';
  }
  
  if (details.gpu?.current > 85) {
    analysis += `🔍 GPU temperature is HIGH: ${details.gpu.current}°C\n`;
    analysis += 'Check GPU cooling and consider reducing load.\n\n';
  }
  
  if (details.memory?.usedPercent > 90) {
    analysis += `🔍 Memory usage is HIGH: ${details.memory.usedPercent}%\n`;
    analysis += 'Consider closing unused applications or adding more RAM.\n\n';
  }
  
  return analysis;
}

function getHardwareFixes(details, platform) {
  const fixes = [];
  
  if (details.cpu?.current > 80 || details.temperature?.cpu > 80) {
    fixes.push({
      title: 'Reduce CPU Temperature',
      description: 'Cool down your CPU',
      steps: [
        'Check CPU fan is working properly',
        'Clean dust from heatsink and fans',
        'Reapply thermal paste if temps remain high',
        'Improve case airflow',
        'Check for runaway processes: top or htop',
        'Consider undervolting for laptops'
      ],
      commands: ['top -o %CPU'],
      risk: 'low',
      automated: false
    });
  }
  
  if (details.memory?.usedPercent > 90) {
    fixes.push({
      title: 'Free Up Memory',
      description: 'Reduce memory usage',
      steps: [
        'Close unused applications',
        'Check memory usage: free -h',
        'Find memory-hungry processes: ps aux --sort=-%mem | head',
        'Clear cache: sudo sync; echo 3 | sudo tee /proc/sys/vm/drop_caches',
        'Consider adding swap or more RAM'
      ],
      commands: [
        'free -h',
        'ps aux --sort=-%mem | head -10'
      ],
      risk: 'low',
      automated: false
    });
  }
  
  return fixes;
}

// ============ Script Generator ============

function generateScript(fixes, platform, check) {
  const isWindows = platform === 'windows';
  const isMac = platform === 'macos';
  
  let script = '';
  
  if (isWindows) {
    script = `# Security Fix Script - Generated by Security Dashboard
# Issue: ${check.name} - ${check.message}
# Generated: ${new Date().toISOString()}
# 
# Run as Administrator in PowerShell

Write-Host "Security Dashboard - Automated Fix" -ForegroundColor Cyan
Write-Host "Issue: ${check.message}" -ForegroundColor Yellow
Write-Host ""

`;
    fixes.forEach((fix, i) => {
      script += `# Fix ${i + 1}: ${fix.title}\n`;
      script += `Write-Host "Applying: ${fix.title}..." -ForegroundColor Yellow\n`;
      if (fix.commands) {
        fix.commands.forEach(cmd => {
          // Convert bash commands to PowerShell where possible
          script += `${cmd}\n`;
        });
      }
      script += `Write-Host "Done!" -ForegroundColor Green\n\n`;
    });
  } else {
    script = `#!/bin/bash
# Security Fix Script - Generated by Security Dashboard
# Issue: ${check.name} - ${check.message}
# Generated: ${new Date().toISOString()}
#
# Run with: sudo bash fix-script.sh

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Security Dashboard - Automated Fix"
echo "  Issue: ${check.message}"
echo "═══════════════════════════════════════════════════════════"
echo ""

`;
    fixes.forEach((fix, i) => {
      script += `# Fix ${i + 1}: ${fix.title}\n`;
      script += `echo "🔧 Applying: ${fix.title}..."\n`;
      if (fix.warning) {
        script += `echo "⚠️  Warning: ${fix.warning}"\n`;
        script += `read -p "Continue? (y/N): " confirm\n`;
        script += `[[ ! "$confirm" =~ ^[Yy]$ ]] && { echo "Skipped."; }\n`;
        script += `[[ "$confirm" =~ ^[Yy]$ ]] && {\n`;
      }
      if (fix.commands) {
        fix.commands.forEach(cmd => {
          script += `  ${cmd}\n`;
        });
      }
      if (fix.warning) {
        script += `}\n`;
      }
      script += `echo "✅ Done!"\necho ""\n\n`;
    });
    
    script += `echo "═══════════════════════════════════════════════════════════"
echo "  ✨ All fixes applied!"
echo "═══════════════════════════════════════════════════════════"
`;
  }
  
  return {
    content: script,
    filename: isWindows ? 'security-fix.ps1' : 'security-fix.sh',
    type: isWindows ? 'powershell' : 'bash'
  };
}

export { searchForSolutions, detectPlatform };
