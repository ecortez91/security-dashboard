import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function checkSystemUpdates() {
  const result = {
    name: 'System Updates',
    description: 'Checks for available system and security updates',
    category: 'system',
    status: 'pass',
    details: {},
    recommendations: [],
    fixes: [],
  };

  try {
    // Check for apt updates (Debian/Ubuntu)
    let aptUpdates = null;
    try {
      // First update the package list quietly
      await execAsync('sudo apt-get update -qq 2>/dev/null || apt-get update -qq 2>/dev/null');
      
      const { stdout } = await execAsync('apt list --upgradable 2>/dev/null | grep -c upgradable || echo 0');
      aptUpdates = parseInt(stdout.trim()) || 0;
      
      // Check for security updates specifically
      const { stdout: secStdout } = await execAsync('apt list --upgradable 2>/dev/null | grep -i security | wc -l || echo 0');
      const securityUpdates = parseInt(secStdout.trim()) || 0;
      
      result.details.apt = {
        available: true,
        totalUpdates: aptUpdates,
        securityUpdates,
      };

      if (securityUpdates > 0) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `${securityUpdates} security update(s) available. Install immediately!`,
        });
        result.fixes.push({
          id: 'install_security_updates',
          name: 'Install Security Updates',
          description: 'Install critical security updates',
          autoFix: true,
        });
      } else if (aptUpdates > 0) {
        result.status = 'warning';
        result.recommendations.push({
          severity: 'low',
          message: `${aptUpdates} package update(s) available`,
        });
        result.fixes.push({
          id: 'install_all_updates',
          name: 'Install All Updates',
          description: 'Install all available package updates',
          autoFix: true,
        });
      }
    } catch {
      result.details.apt = { available: false };
    }

    // Check npm global packages
    try {
      const { stdout } = await execAsync('npm outdated -g --json 2>/dev/null');
      const outdated = JSON.parse(stdout || '{}');
      const outdatedCount = Object.keys(outdated).length;
      
      result.details.npm = {
        available: true,
        outdatedPackages: outdatedCount,
        packages: Object.keys(outdated),
      };

      if (outdatedCount > 0) {
        result.recommendations.push({
          severity: 'low',
          message: `${outdatedCount} npm global package(s) have updates available`,
        });
      }
    } catch {
      result.details.npm = { available: true, outdatedPackages: 0 };
    }

    // Check Node.js version
    try {
      const { stdout: nodeVersion } = await execAsync('node --version');
      const { stdout: latestLts } = await execAsync('npm view node@lts version 2>/dev/null || echo ""');
      
      result.details.node = {
        current: nodeVersion.trim(),
        latestLts: latestLts.trim() || 'unknown',
      };
    } catch {
      result.details.node = { current: 'unknown' };
    }

    // Determine overall message
    if (result.status === 'pass') {
      result.message = 'System is up to date';
    } else if (result.status === 'critical') {
      result.message = 'Critical security updates available!';
    } else {
      result.message = 'Some updates are available';
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check updates: ${error.message}`;
  }

  return result;
}
