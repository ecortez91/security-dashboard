import { exec } from 'child_process';
import { promisify } from 'util';
import { isWSL2, getWSLNetworkMode } from './utils.js';

const execAsync = promisify(exec);

export async function checkNetworkExposure() {
  const result = {
    name: 'Network Exposure',
    description: 'Checks for external network exposure and potential vulnerabilities',
    category: 'network',
    status: 'pass',
    details: {
      interfaces: [],
      publicIp: null,
      exposedServices: [],
    },
    recommendations: [],
    fixes: [],
  };

  try {
    // Detect WSL2 environment
    const inWSL2 = await isWSL2();
    const wslMode = inWSL2 ? await getWSLNetworkMode() : null;
    
    result.details.environment = {
      wsl2: inWSL2,
      networkMode: wslMode,
    };

    // Get network interfaces
    try {
      const { stdout } = await execAsync('ip addr show 2>/dev/null || ifconfig 2>/dev/null');
      const interfaces = [];
      
      // Parse interface info
      let currentIface = '';
      for (const line of stdout.split('\n')) {
        const ifaceMatch = line.match(/^\d+:\s+(\S+):|^(\S+):/);
        if (ifaceMatch) {
          currentIface = ifaceMatch[1] || ifaceMatch[2];
        }
        
        const ipMatch = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch && currentIface) {
          interfaces.push({
            name: currentIface,
            ip: ipMatch[1],
            isPrivate: ipMatch[1].startsWith('10.') || 
                      ipMatch[1].startsWith('192.168.') ||
                      ipMatch[1].startsWith('172.') ||
                      ipMatch[1].startsWith('127.'),
          });
        }
      }
      
      result.details.interfaces = interfaces;
    } catch {
      result.details.interfaces = [];
    }

    // Check public IP (indicates internet connectivity)
    try {
      const { stdout } = await execAsync('curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null');
      result.details.publicIp = stdout.trim() || null;
    } catch {
      result.details.publicIp = null;
    }

    // Check if any services are bound to public interfaces
    try {
      const { stdout } = await execAsync('ss -tlnp 2>/dev/null | grep -E "0\\.0\\.0\\.0|::" || echo ""');
      const exposedLines = stdout.trim().split('\n').filter(Boolean);
      
      for (const line of exposedLines) {
        const portMatch = line.match(/:(\d+)\s/);
        const processMatch = line.match(/users:\(\("([^"]+)"/);
        
        if (portMatch) {
          result.details.exposedServices.push({
            port: parseInt(portMatch[1]),
            process: processMatch ? processMatch[1] : 'unknown',
          });
        }
      }

      if (result.details.exposedServices.length > 0) {
        // In WSL2 NAT mode, this is not a real concern
        if (inWSL2 && wslMode === 'nat') {
          result.status = 'info';
          result.message = `${result.details.exposedServices.length} service(s) on all interfaces (isolated by WSL2 NAT)`;
          result.details.wsl2Note = 'In WSL2 NAT mode, services bound to 0.0.0.0 are NOT accessible from external networks. The WSL2 virtual network (172.x.x.x) is isolated, and Windows Firewall protects the host.';
          
          result.recommendations.push({
            severity: 'info',
            message: '✓ WSL2 NAT mode provides network isolation. External devices cannot reach these services directly.',
          });
          result.recommendations.push({
            severity: 'info',
            message: '✓ Only your Windows host can access these ports via localhost forwarding.',
          });
        } else {
          result.status = 'warning';
          result.message = `${result.details.exposedServices.length} service(s) exposed on all interfaces`;
          
          for (const svc of result.details.exposedServices) {
            result.recommendations.push({
              severity: 'medium',
              message: `Port ${svc.port} (${svc.process}) is bound to 0.0.0.0 - accessible from any network interface`,
            });
          }
        }
      }
    } catch {
      // Ignore
    }

    // Check for port forwarding in WSL
    if (inWSL2) {
      try {
        const { stdout } = await execAsync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "netsh interface portproxy show v4tov4" 2>/dev/null');
        if (stdout.trim() && stdout.includes(':')) {
          const lines = stdout.split('\n').filter(l => l.includes(':'));
          result.details.portForwarding = {
            enabled: true,
            rules: lines.length,
          };
          
          result.status = 'warning';
          result.recommendations.push({
            severity: 'medium',
            message: `${lines.length} Windows port forwarding rule(s) detected — these expose WSL2 ports to your network!`,
          });
        } else {
          result.details.portForwarding = { enabled: false, rules: 0 };
        }
      } catch {
        result.details.portForwarding = { enabled: false, rules: 0 };
      }
    }

    // Check default gateway
    try {
      const { stdout } = await execAsync('ip route show default 2>/dev/null || route -n 2>/dev/null | grep UG');
      result.details.defaultGateway = stdout.trim().split(/\s+/)[2] || 'unknown';
    } catch {
      result.details.defaultGateway = 'unknown';
    }

    // Final status
    if (result.status === 'pass') {
      result.message = 'Network configuration looks secure';
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check network: ${error.message}`;
  }

  return result;
}
