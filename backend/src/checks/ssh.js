import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';

const execAsync = promisify(exec);

export async function checkSSH() {
  const result = {
    name: 'SSH Security',
    description: 'Checks SSH configuration for security best practices',
    category: 'security',
    status: 'pass',
    details: {},
    recommendations: [],
    fixes: [],
  };

  try {
    // Check if SSH server is running
    let sshRunning = false;
    try {
      const { stdout } = await execAsync('pgrep -x sshd');
      sshRunning = stdout.trim().length > 0;
    } catch {
      sshRunning = false;
    }

    result.details.sshServerRunning = sshRunning;

    if (!sshRunning) {
      result.message = 'SSH server is not running';
      result.details.note = 'SSH is disabled, which is secure if you don\'t need remote access';
      return result;
    }

    // Check SSH config
    const configPath = '/etc/ssh/sshd_config';
    let config = '';
    
    try {
      config = await readFile(configPath, 'utf8');
    } catch {
      result.details.configReadable = false;
      result.message = 'Cannot read SSH config (may need sudo)';
      return result;
    }

    const configChecks = {
      permitRootLogin: {
        pattern: /^PermitRootLogin\s+(\S+)/m,
        secure: ['no', 'prohibit-password'],
        message: 'Root login should be disabled',
      },
      passwordAuth: {
        pattern: /^PasswordAuthentication\s+(\S+)/m,
        secure: ['no'],
        message: 'Password authentication should be disabled (use keys)',
      },
      pubkeyAuth: {
        pattern: /^PubkeyAuthentication\s+(\S+)/m,
        secure: ['yes'],
        message: 'Public key authentication should be enabled',
      },
      x11Forwarding: {
        pattern: /^X11Forwarding\s+(\S+)/m,
        secure: ['no'],
        message: 'X11 forwarding should be disabled if not needed',
      },
      maxAuthTries: {
        pattern: /^MaxAuthTries\s+(\d+)/m,
        secure: (val) => parseInt(val) <= 3,
        message: 'MaxAuthTries should be 3 or less',
      },
    };

    result.details.config = {};
    let issues = 0;

    for (const [key, check] of Object.entries(configChecks)) {
      const match = config.match(check.pattern);
      const value = match ? match[1].toLowerCase() : 'default';
      
      result.details.config[key] = value;

      let isSecure;
      if (typeof check.secure === 'function') {
        isSecure = value !== 'default' && check.secure(value);
      } else {
        isSecure = check.secure.includes(value);
      }

      if (!isSecure && value !== 'default') {
        issues++;
        result.recommendations.push({
          severity: 'medium',
          message: check.message,
        });
      }
    }

    // Check authorized_keys
    try {
      await access(`${process.env.HOME}/.ssh/authorized_keys`, constants.R_OK);
      const { stdout } = await execAsync(`wc -l ${process.env.HOME}/.ssh/authorized_keys`);
      result.details.authorizedKeys = parseInt(stdout.split(' ')[0]);
    } catch {
      result.details.authorizedKeys = 0;
    }

    // Check for known_hosts
    try {
      const { stdout } = await execAsync(`wc -l ${process.env.HOME}/.ssh/known_hosts 2>/dev/null`);
      result.details.knownHosts = parseInt(stdout.split(' ')[0]);
    } catch {
      result.details.knownHosts = 0;
    }

    if (issues > 0) {
      result.status = issues >= 2 ? 'critical' : 'warning';
      result.message = `${issues} SSH configuration issue(s) found`;
      result.fixes.push({
        id: 'harden_ssh',
        name: 'Harden SSH Configuration',
        description: 'Apply security best practices to SSH configuration',
        autoFix: true,
      });
    } else {
      result.message = 'SSH configuration looks secure';
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check SSH: ${error.message}`;
  }

  return result;
}
