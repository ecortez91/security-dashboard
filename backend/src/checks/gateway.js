import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export async function checkGateway() {
  const result = {
    name: 'Clawdbot Gateway',
    description: 'Checks Clawdbot Gateway configuration and security',
    category: 'application',
    status: 'pass',
    details: {},
    recommendations: [],
    fixes: [],
  };

  try {
    // Check if gateway is running
    let gatewayRunning = false;
    try {
      const { stdout } = await execAsync('pgrep -f "clawdbot.*gateway" || pgrep -f "node.*gateway"');
      gatewayRunning = stdout.trim().length > 0;
    } catch {
      gatewayRunning = false;
    }
    result.details.running = gatewayRunning;

    // Try to find and read gateway config
    const configPaths = [
      join(homedir(), '.config', 'clawdbot', 'config.yaml'),
      join(homedir(), '.clawdbot', 'config.yaml'),
      '/etc/clawdbot/config.yaml',
    ];

    let configContent = null;
    let configPath = null;

    for (const path of configPaths) {
      try {
        configContent = await readFile(path, 'utf8');
        configPath = path;
        break;
      } catch {
        continue;
      }
    }

    if (configContent) {
      result.details.configPath = configPath;
      
      // Check for security-relevant settings
      const securityChecks = {
        // Check if gateway is bound to localhost only
        localBinding: !configContent.includes('0.0.0.0') && !configContent.includes('::'),
        // Check if auth is configured
        hasAuth: configContent.includes('token') || configContent.includes('auth'),
        // Check if HTTPS is configured
        hasHttps: configContent.includes('https') || configContent.includes('tls') || configContent.includes('ssl'),
      };

      result.details.security = securityChecks;

      if (!securityChecks.localBinding) {
        result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: 'Gateway may be exposed to external interfaces. Bind to 127.0.0.1 for security.',
        });
      }

      if (!securityChecks.hasAuth) {
        result.status = 'warning';
        result.recommendations.push({
          severity: 'medium',
          message: 'No authentication token detected in config. Ensure gateway requires authentication.',
        });
      }
    } else {
      result.details.configPath = null;
      result.details.note = 'Gateway config not found (may be using defaults)';
    }

    // Check what port gateway is listening on
    try {
      const { stdout } = await execAsync('ss -tlnp 2>/dev/null | grep -E "node|clawdbot" || netstat -tlnp 2>/dev/null | grep -E "node|clawdbot"');
      const gatewayPorts = [];
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        const portMatch = line.match(/:(\d+)\s/);
        if (portMatch) {
          gatewayPorts.push(parseInt(portMatch[1]));
        }
      }
      
      result.details.listeningPorts = gatewayPorts;
    } catch {
      result.details.listeningPorts = [];
    }

    if (gatewayRunning) {
      if (result.status === 'pass') {
        result.message = 'Gateway is running with secure configuration';
      } else {
        result.message = 'Gateway is running but has security recommendations';
      }
    } else {
      result.status = 'info';
      result.message = 'Gateway is not currently running';
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check gateway: ${error.message}`;
  }

  return result;
}
