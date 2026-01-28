import { exec } from 'child_process';
import { promisify } from 'util';

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
    // Get network interfaces
    try {
      const { stdout } = await execAsync('ip addr show 2>/dev/null || ifconfig 2>/dev/null');
      const interfaces = [];
      
      // Parse interface info
      const ifaceRegex = /^\d+:\s+(\S+):|^(\S+):/gm;
      const ipRegex = /inet\s+(\d+\.\d+\.\d+\.\d+)/g;
      
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
                      ipMatch[1].startsWith('172.16.') ||
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
        result.status = 'warning';
        result.message = `${result.details.exposedServices.length} service(s) exposed on all interfaces`;
        
        for (const svc of result.details.exposedServices) {
          result.recommendations.push({
            severity: 'medium',
            message: `Port ${svc.port} (${svc.process}) is bound to 0.0.0.0 - accessible from any network interface`,
          });
        }
      }
    } catch {
      // Ignore
    }

    // Check for port forwarding in WSL
    try {
      const { stdout } = await execAsync('powershell.exe -Command "netsh interface portproxy show all" 2>/dev/null');
      if (stdout.trim() && !stdout.includes('no entries')) {
        const lines = stdout.split('\n').filter(l => l.includes(':'));
        result.details.portForwarding = lines.length;
        
        if (lines.length > 0) {
          result.recommendations.push({
            severity: 'medium',
            message: `${lines.length} port forwarding rule(s) configured in Windows`,
          });
        }
      }
    } catch {
      // Not WSL or no port forwarding
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
