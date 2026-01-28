import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function checkFirewall() {
  const result = {
    name: 'Firewall Status',
    description: 'Checks if a firewall is active and properly configured',
    category: 'security',
    status: 'pass',
    details: {},
    recommendations: [],
    fixes: [],
  };

  try {
    // Check UFW status (Ubuntu/Debian)
    let ufwStatus = null;
    try {
      const { stdout } = await execAsync('sudo ufw status 2>/dev/null || ufw status 2>/dev/null');
      ufwStatus = stdout.toLowerCase().includes('active');
      result.details.ufw = {
        installed: true,
        active: ufwStatus,
        output: stdout.trim(),
      };
    } catch {
      result.details.ufw = { installed: false };
    }

    // Check iptables rules
    let iptablesRules = 0;
    try {
      const { stdout } = await execAsync('sudo iptables -L -n 2>/dev/null || iptables -L -n 2>/dev/null');
      iptablesRules = stdout.split('\n').filter(line => 
        line.trim() && 
        !line.startsWith('Chain') && 
        !line.startsWith('target')
      ).length;
      result.details.iptables = {
        available: true,
        rulesCount: iptablesRules,
      };
    } catch {
      result.details.iptables = { available: false };
    }

    // Check Windows Firewall (if running in WSL)
    try {
      const { stdout } = await execAsync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "Get-NetFirewallProfile | Select-Object Name,Enabled" 2>/dev/null');
      const profiles = stdout.split('\n')
        .filter(line => line.includes('True') || line.includes('False'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return { name: parts[0], enabled: parts[1] === 'True' };
        });
      
      result.details.windowsFirewall = {
        available: true,
        profiles,
      };

      const allEnabled = profiles.every(p => p.enabled);
      const disabledProfiles = profiles.filter(p => !p.enabled).map(p => p.name);
      
      if (!allEnabled) {
        result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `Windows Firewall disabled for: ${disabledProfiles.join(', ')}`,
        });
        result.fixes.push({
          id: 'enable_windows_firewall',
          name: 'Enable Windows Firewall',
          description: 'Enable all Windows Firewall profiles for maximum protection',
          autoFix: true,
          script: 'enable-firewall',
          manualSteps: [
            'Open Windows Security',
            'Click "Firewall & network protection"',
            'Click on each network type (Domain, Private, Public)',
            'Turn "Windows Defender Firewall" to ON'
          ]
        });
      }
    } catch {
      result.details.windowsFirewall = { available: false };
    }

    // Determine overall status
    const hasActiveFirewall = ufwStatus || iptablesRules > 0 || 
      result.details.windowsFirewall?.profiles?.some(p => p.enabled);

    if (!hasActiveFirewall) {
      result.status = 'critical';
      result.message = 'No active firewall detected!';
      result.recommendations.push({
        severity: 'critical',
        message: 'Your system has no firewall protection. All network ports are potentially exposed to attackers.',
      });
      result.fixes.push({
        id: 'enable_ufw',
        name: 'Enable Firewall (Linux)',
        description: 'Enable UFW/firewalld/iptables with secure defaults',
        autoFix: true,
        script: 'enable-firewall',
        manualSteps: [
          'Run: sudo ufw enable',
          'Run: sudo ufw default deny incoming',
          'Run: sudo ufw default allow outgoing',
          'Run: sudo ufw allow ssh (to prevent lockout)',
          'Run: sudo ufw status (verify)'
        ]
      });
    } else {
      result.message = 'Firewall is active';
      
      // Add recommendation for additional hardening
      if (result.details.windowsFirewall?.available) {
        result.recommendations.push({
          severity: 'info',
          message: 'Consider reviewing firewall rules to ensure only necessary ports are open',
        });
      }
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check firewall: ${error.message}`;
    result.details.error = error.message;
  }

  return result;
}
