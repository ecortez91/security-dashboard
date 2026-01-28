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
      // Count non-empty, non-header lines
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
      const { stdout } = await execAsync('powershell.exe -Command "Get-NetFirewallProfile | Select-Object Name,Enabled" 2>/dev/null');
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
      if (!allEnabled) {
        result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: 'Some Windows Firewall profiles are disabled',
        });
        result.fixes.push({
          id: 'enable_windows_firewall',
          name: 'Enable Windows Firewall',
          description: 'Enable all Windows Firewall profiles for maximum protection',
          autoFix: true,
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
        message: 'Enable a firewall immediately. Your system is exposed.',
      });
      result.fixes.push({
        id: 'enable_ufw',
        name: 'Enable UFW Firewall',
        description: 'Enable the Uncomplicated Firewall (UFW) with default deny incoming policy',
        autoFix: true,
      });
    } else {
      result.message = 'Firewall is active';
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check firewall: ${error.message}`;
  }

  return result;
}
