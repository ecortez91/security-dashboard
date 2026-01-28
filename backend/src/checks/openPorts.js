import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function checkOpenPorts() {
  const result = {
    name: 'Open Ports',
    description: 'Checks for ports listening on all interfaces (0.0.0.0 or ::)',
    category: 'network',
    status: 'pass',
    details: [],
    recommendations: [],
    fixes: [],
  };

  try {
    // Check listening ports
    const { stdout } = await execAsync('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null');
    const lines = stdout.split('\n').filter(line => line.includes('LISTEN'));
    
    const exposedPorts = [];
    const localPorts = [];

    for (const line of lines) {
      // Parse the line to extract port and binding info
      const parts = line.split(/\s+/);
      let localAddr = '';
      
      // Find the local address column
      for (const part of parts) {
        if (part.includes(':') && (part.includes('0.0.0.0') || part.includes('::') || part.includes('*') || /^\d+\.\d+\.\d+\.\d+:\d+$/.test(part) || /^127\./.test(part))) {
          localAddr = part;
          break;
        }
      }

      if (!localAddr) continue;

      const port = localAddr.split(':').pop();
      const isExposed = localAddr.includes('0.0.0.0') || localAddr.includes('::') || localAddr.includes('*');
      const isLocal = localAddr.includes('127.0.0.1') || localAddr.includes('::1');

      // Get process name
      const processMatch = line.match(/users:\(\("([^"]+)"/);
      const processName = processMatch ? processMatch[1] : 'unknown';

      const portInfo = {
        port: parseInt(port),
        binding: localAddr,
        process: processName,
        exposed: isExposed && !isLocal,
      };

      if (portInfo.exposed) {
        exposedPorts.push(portInfo);
      } else {
        localPorts.push(portInfo);
      }
    }

    result.details = {
      exposedPorts,
      localPorts,
      totalListening: exposedPorts.length + localPorts.length,
    };

    if (exposedPorts.length > 0) {
      result.status = 'warning';
      result.message = `${exposedPorts.length} port(s) are listening on all interfaces`;
      
      for (const port of exposedPorts) {
        result.recommendations.push({
          severity: 'medium',
          message: `Port ${port.port} (${port.process}) is exposed to all interfaces. Consider binding to localhost only.`,
        });
        
        // Only add fix for known safe services
        if (['node', 'python', 'python3'].includes(port.process)) {
          result.fixes.push({
            id: `close_port_${port.port}`,
            name: `Restrict port ${port.port} to localhost`,
            description: `Change ${port.process} to bind to 127.0.0.1:${port.port} instead of 0.0.0.0:${port.port}`,
            autoFix: false,
            manual: true,
          });
        }
      }
    } else {
      result.message = 'No ports are exposed to external interfaces';
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check ports: ${error.message}`;
  }

  return result;
}
