import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Services that could be security risks if running unintentionally
const suspiciousServices = [
  { name: 'telnet', risk: 'critical', reason: 'Unencrypted remote access protocol' },
  { name: 'ftp', risk: 'high', reason: 'Unencrypted file transfer protocol' },
  { name: 'rsh', risk: 'critical', reason: 'Insecure remote shell' },
  { name: 'rlogin', risk: 'critical', reason: 'Insecure remote login' },
  { name: 'vnc', risk: 'medium', reason: 'Remote desktop - ensure encrypted' },
  { name: 'mysql', risk: 'low', reason: 'Database server - check binding' },
  { name: 'postgres', risk: 'low', reason: 'Database server - check binding' },
  { name: 'redis', risk: 'medium', reason: 'In-memory store - often misconfigured' },
  { name: 'mongo', risk: 'medium', reason: 'Database - check authentication' },
  { name: 'docker', risk: 'low', reason: 'Container runtime - check socket permissions' },
];

export async function checkRunningServices() {
  const result = {
    name: 'Running Services',
    description: 'Checks for potentially risky running services',
    category: 'security',
    status: 'pass',
    details: {
      services: [],
      riskyServices: [],
    },
    recommendations: [],
    fixes: [],
  };

  try {
    // Get list of listening services
    const { stdout } = await execAsync('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null');
    const lines = stdout.split('\n').filter(line => line.includes('LISTEN'));

    // Also check running processes
    const { stdout: psOutput } = await execAsync('ps aux --no-headers 2>/dev/null | awk \'{print $11}\'');
    const processes = psOutput.split('\n').map(p => p.toLowerCase());

    // Check for suspicious services
    for (const service of suspiciousServices) {
      const isRunning = processes.some(p => p.includes(service.name)) ||
                       lines.some(l => l.toLowerCase().includes(service.name));
      
      if (isRunning) {
        result.details.riskyServices.push({
          name: service.name,
          risk: service.risk,
          reason: service.reason,
        });

        result.recommendations.push({
          severity: service.risk,
          message: `${service.name} is running: ${service.reason}`,
        });

        if (service.risk === 'critical') {
          result.fixes.push({
            id: `stop_${service.name}`,
            name: `Stop ${service.name}`,
            description: `Stop the ${service.name} service`,
            autoFix: true,
          });
        }
      }
    }

    // Parse all listening services
    for (const line of lines) {
      const processMatch = line.match(/users:\(\("([^"]+)"/);
      const portMatch = line.match(/:(\d+)\s/);
      
      if (processMatch && portMatch) {
        result.details.services.push({
          name: processMatch[1],
          port: parseInt(portMatch[1]),
        });
      }
    }

    // Determine status
    const criticalServices = result.details.riskyServices.filter(s => s.risk === 'critical');
    const highRiskServices = result.details.riskyServices.filter(s => s.risk === 'high');

    if (criticalServices.length > 0) {
      result.status = 'critical';
      result.message = `${criticalServices.length} critical-risk service(s) running!`;
    } else if (highRiskServices.length > 0) {
      result.status = 'warning';
      result.message = `${highRiskServices.length} high-risk service(s) detected`;
    } else {
      result.message = `${result.details.services.length} service(s) running, no major risks`;
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check services: ${error.message}`;
  }

  return result;
}
