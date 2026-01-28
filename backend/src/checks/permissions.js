import { exec } from 'child_process';
import { promisify } from 'util';
import { stat } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export async function checkFilePermissions() {
  const result = {
    name: 'File Permissions',
    description: 'Checks critical file and directory permissions',
    category: 'security',
    status: 'pass',
    details: {
      issues: [],
      checked: [],
    },
    recommendations: [],
    fixes: [],
  };

  const criticalPaths = [
    { path: join(homedir(), '.ssh'), maxMode: 0o700, type: 'directory' },
    { path: join(homedir(), '.ssh', 'id_rsa'), maxMode: 0o600, type: 'file' },
    { path: join(homedir(), '.ssh', 'id_ed25519'), maxMode: 0o600, type: 'file' },
    { path: join(homedir(), '.ssh', 'authorized_keys'), maxMode: 0o600, type: 'file' },
    { path: join(homedir(), '.gnupg'), maxMode: 0o700, type: 'directory' },
    { path: join(homedir(), '.config', 'clawdbot'), maxMode: 0o700, type: 'directory' },
    { path: '/etc/shadow', maxMode: 0o640, type: 'file', system: true },
    { path: '/etc/passwd', maxMode: 0o644, type: 'file', system: true },
  ];

  for (const check of criticalPaths) {
    try {
      const stats = await stat(check.path);
      const mode = stats.mode & 0o777;
      const isSecure = mode <= check.maxMode;

      const checkResult = {
        path: check.path,
        currentMode: `0${mode.toString(8)}`,
        requiredMode: `0${check.maxMode.toString(8)}`,
        secure: isSecure,
      };

      result.details.checked.push(checkResult);

      if (!isSecure) {
        result.details.issues.push(checkResult);
        result.recommendations.push({
          severity: check.system ? 'critical' : 'high',
          message: `${check.path} has permissions ${checkResult.currentMode}, should be ${checkResult.requiredMode} or stricter`,
        });
        
        if (!check.system) {
          result.fixes.push({
            id: `fix_perm_${check.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: `Fix ${check.path} permissions`,
            description: `Change permissions to ${checkResult.requiredMode}`,
            autoFix: true,
            command: `chmod ${check.maxMode.toString(8)} "${check.path}"`,
          });
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        result.details.checked.push({
          path: check.path,
          error: error.message,
        });
      }
      // ENOENT means file doesn't exist, which is fine
    }
  }

  // Check for world-writable files in home directory
  try {
    const { stdout } = await execAsync(`find ${homedir()} -maxdepth 2 -perm -0002 -type f 2>/dev/null | head -10`);
    const worldWritable = stdout.trim().split('\n').filter(Boolean);
    
    if (worldWritable.length > 0) {
      result.details.worldWritableFiles = worldWritable;
      result.recommendations.push({
        severity: 'medium',
        message: `Found ${worldWritable.length} world-writable file(s) in home directory`,
      });
    }
  } catch {
    // Ignore errors from find
  }

  // Determine status
  const issues = result.details.issues;
  if (issues.length > 0) {
    const hasCritical = issues.some(i => 
      i.path.includes('/etc/') || i.path.includes('.ssh')
    );
    result.status = hasCritical ? 'critical' : 'warning';
    result.message = `${issues.length} permission issue(s) found`;
  } else {
    result.message = 'File permissions are secure';
  }

  return result;
}
