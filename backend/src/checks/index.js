import { checkOpenPorts } from './openPorts.js';
import { checkFirewall } from './firewall.js';
import { checkSSH } from './ssh.js';
import { checkGateway } from './gateway.js';
import { checkSystemUpdates } from './updates.js';
import { checkFilePermissions } from './permissions.js';
import { checkRunningServices } from './services.js';
import { checkNetworkExposure } from './network.js';
import { checkHardware } from './hardware.js';

const checks = {
  hardware: checkHardware,
  openPorts: checkOpenPorts,
  firewall: checkFirewall,
  ssh: checkSSH,
  gateway: checkGateway,
  updates: checkSystemUpdates,
  permissions: checkFilePermissions,
  services: checkRunningServices,
  network: checkNetworkExposure,
};

export async function runAllChecks() {
  const results = {
    timestamp: new Date().toISOString(),
    overallScore: 0,
    totalChecks: Object.keys(checks).length,
    passed: 0,
    info: 0,
    warnings: 0,
    critical: 0,
    checks: [],
  };

  for (const [id, checkFn] of Object.entries(checks)) {
    try {
      const result = await checkFn();
      result.id = id;
      results.checks.push(result);

      if (result.status === 'pass') results.passed++;
      else if (result.status === 'info') results.info++;
      else if (result.status === 'warning') results.warnings++;
      else if (result.status === 'critical') results.critical++;
    } catch (error) {
      results.checks.push({
        id,
        name: id,
        status: 'error',
        message: error.message,
      });
    }
  }

  // Calculate overall score (0-100)
  // 'info' status counts as pass (100 points) since it's just informational
  results.overallScore = Math.round(
    (((results.passed + results.info) * 100) + (results.warnings * 50)) / results.totalChecks
  );

  return results;
}

export async function runCheck(checkId) {
  if (!checks[checkId]) {
    throw new Error(`Unknown check: ${checkId}`);
  }
  const result = await checks[checkId]();
  result.id = checkId;
  return result;
}

export async function applyFix(fixId, params) {
  // Import fixes dynamically
  const { fixes } = await import('./fixes.js');
  
  if (!fixes[fixId]) {
    throw new Error(`Unknown fix: ${fixId}`);
  }
  
  return await fixes[fixId](params);
}
