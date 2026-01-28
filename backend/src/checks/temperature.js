/**
 * Temperature Check Module
 * 
 * Dedicated temperature monitoring using thermal-pulse.
 * Provides detailed CPU/GPU temperature data with status thresholds.
 * 
 * WSL2 Compatible: Auto-detects Windows host IP when running in WSL.
 */

import { readFile } from 'fs/promises';
import http from 'http';

// Thresholds (matching thermal-pulse defaults)
const defaultThresholds = {
  cpu: { warning: 75, critical: 90 },
  gpu: { warning: 80, critical: 95 }
};

/**
 * Detect if running inside WSL2
 */
async function isWSL2() {
  try {
    const release = await readFile('/proc/version', 'utf8');
    return release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
  } catch {
    return false;
  }
}

/**
 * Get Windows host IP when running in WSL2
 * Uses the nameserver from /etc/resolv.conf (works in NAT mode)
 */
async function getWindowsHostIP() {
  try {
    const resolv = await readFile('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) {
      return match[1];
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Get temperature configuration
 * Auto-detects Windows host IP in WSL2
 */
async function getConfig() {
  let host = process.env.LHM_HOST || 'localhost';
  
  // In WSL2, we need the Windows host IP to reach LHM
  if (host === 'localhost' || host === '127.0.0.1') {
    const inWSL = await isWSL2();
    if (inWSL) {
      const windowsIP = await getWindowsHostIP();
      if (windowsIP) {
        host = windowsIP;
      }
    }
  }
  
  return {
    host,
    port: parseInt(process.env.LHM_PORT, 10) || 8085,
    username: process.env.LHM_USERNAME || '',
    password: process.env.LHM_PASSWORD || '',
    thresholds: defaultThresholds,
  };
}

/**
 * Fetch data from LibreHardwareMonitor via HTTP
 */
function fetchLHMDataHTTP(config) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: '/data.json',
      method: 'GET',
      headers: {},
      timeout: 3000,
    };

    if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      options.headers['Authorization'] = `Basic ${auth}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      if (res.statusCode === 401) {
        reject(new Error('Authentication failed'));
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Connection failed: ${e.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Fetch data from LHM via PowerShell (WSL fallback)
 * Used when direct HTTP fails because LHM is bound to 127.0.0.1
 */
async function fetchLHMDataPowerShell(config) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  // Build PowerShell command
  let psCommand = `Invoke-RestMethod -Uri 'http://localhost:${config.port}/data.json' -TimeoutSec 5`;
  
  if (config.username && config.password) {
    // Escape special characters in password for PowerShell
    const escapedPass = config.password.replace(/'/g, "''");
    psCommand = `
      $cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('${config.username}:${escapedPass}'))
      $headers = @{ Authorization = "Basic $cred" }
      Invoke-RestMethod -Uri 'http://localhost:${config.port}/data.json' -Headers $headers -TimeoutSec 5 | ConvertTo-Json -Depth 10
    `;
  }
  
  const { stdout } = await execAsync(
    `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`,
    { timeout: 15000 }
  );
  
  return JSON.parse(stdout);
}

/**
 * Fetch data from LibreHardwareMonitor web server
 * Tries HTTP first, falls back to PowerShell in WSL
 */
async function fetchLHMData(config) {
  const inWSL = await isWSL2();
  
  // Try direct HTTP first
  try {
    return await fetchLHMDataHTTP(config);
  } catch (httpError) {
    // If in WSL and HTTP failed, try PowerShell fallback
    if (inWSL) {
      try {
        return await fetchLHMDataPowerShell(config);
      } catch (psError) {
        // Both failed, throw the more useful error
        throw new Error(`HTTP: ${httpError.message}, PowerShell: ${psError.message}`);
      }
    }
    throw httpError;
  }
}

/**
 * Parse value string like "76.0 °C" into number
 */
function parseValue(valueStr) {
  if (!valueStr || valueStr === 'Value') return null;
  const match = valueStr.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract sensors from LHM tree structure
 */
function extractSensors(node, path = []) {
  const sensors = [];
  const currentPath = node.Text ? [...path, node.Text] : path;
  
  if (node.Value && node.Value !== 'Value') {
    const value = parseValue(node.Value);
    const min = parseValue(node.Min);
    const max = parseValue(node.Max);
    
    // Determine category
    let category = 'Other';
    const pathStr = currentPath.join(' ');
    
    if (pathStr.match(/Intel|AMD|CPU/i) && !pathStr.includes('GPU')) {
      category = 'CPU';
    } else if (pathStr.match(/NVIDIA|Radeon|GPU/i)) {
      category = 'GPU';
    } else if (pathStr.match(/DIMM|Memory/i)) {
      category = 'Memory';
    } else if (pathStr.match(/SSD|NVMe|WD_BLACK|Samsung|Drive/i)) {
      category = 'Storage';
    } else if (pathStr.match(/Nuvoton|ITE|Motherboard|System/i)) {
      category = 'Motherboard';
    }
    
    // Determine type
    let type = 'Unknown';
    for (const segment of currentPath) {
      if (segment === 'Temperatures') type = 'Temperature';
      else if (segment === 'Fans') type = 'Fan';
      else if (segment === 'Load') type = 'Load';
    }
    
    if (value !== null) {
      sensors.push({ name: node.Text, value, min, max, category, type });
    }
  }
  
  if (node.Children) {
    for (const child of node.Children) {
      sensors.push(...extractSensors(child, currentPath));
    }
  }
  
  return sensors;
}

/**
 * Get status text based on temperature
 */
function getStatusText(temp, type = 'cpu') {
  const thresholds = defaultThresholds[type];
  if (temp >= thresholds.critical) return 'CRITICAL';
  if (temp >= thresholds.warning) return 'WARNING';
  return 'OK';
}

/**
 * Get status emoji
 */
function getStatusEmoji(temp, type = 'cpu') {
  const thresholds = defaultThresholds[type];
  if (temp >= thresholds.critical) return '🔴';
  if (temp >= thresholds.warning) return '🟡';
  return '🟢';
}

/**
 * Security-focused temperature check
 */
export async function checkTemperature() {
  const result = {
    name: 'Temperature Monitor',
    description: 'Real-time CPU and GPU temperature monitoring via LibreHardwareMonitor',
    category: 'hardware',
    status: 'pass',
    details: {},
    recommendations: [],
    fixes: [],
  };

  try {
    const config = await getConfig();
    result.details.source = `LibreHardwareMonitor (${config.host}:${config.port})`;
    result.details.wsl2 = await isWSL2();
    
    const rawData = await fetchLHMData(config);
    const allSensors = extractSensors(rawData);
    const temperatures = allSensors.filter(s => s.type === 'Temperature');
    
    result.details.timestamp = new Date().toISOString();
    
    // Find key temperatures
    const cpuTemps = temperatures.filter(t => 
      t.category === 'CPU' && !t.name.includes('Distance')
    );
    const gpuTemps = temperatures.filter(t => t.category === 'GPU');
    
    const cpuPackage = cpuTemps.find(t => t.name.includes('Package') || t.name === 'Core Max');
    const cpuAverage = cpuTemps.find(t => t.name.includes('Average'));
    const gpuCore = gpuTemps.find(t => t.name === 'GPU Core');
    const gpuHotspot = gpuTemps.find(t => t.name.includes('Hot Spot'));
    
    // CPU details
    const cpuTemp = cpuPackage?.value ?? null;
    result.details.cpu = {
      current: cpuTemp,
      average: cpuAverage?.value ?? null,
      sessionMax: cpuPackage?.max ?? null,
      status: cpuTemp !== null ? getStatusText(cpuTemp, 'cpu') : 'UNKNOWN',
      emoji: cpuTemp !== null ? getStatusEmoji(cpuTemp, 'cpu') : '❓',
    };
    
    // GPU details
    const gpuCoreTemp = gpuCore?.value ?? null;
    result.details.gpu = {
      current: gpuCoreTemp,
      hotspot: gpuHotspot?.value ?? null,
      sessionMax: gpuCore?.max ?? null,
      status: gpuCoreTemp !== null ? getStatusText(gpuCoreTemp, 'gpu') : 'UNKNOWN',
      emoji: gpuCoreTemp !== null ? getStatusEmoji(gpuCoreTemp, 'gpu') : '❓',
    };
    
    // All temperatures
    result.details.allTemps = temperatures
      .filter(t => !t.name.includes('Distance') && !t.name.includes('Limit') && !t.name.includes('Resolution'))
      .map(t => ({
        name: t.name,
        value: t.value,
        category: t.category,
        min: t.min,
        max: t.max,
      }));
    
    // Check thresholds and set status
    const thresholds = config.thresholds;
    
    if (cpuTemp !== null) {
      if (cpuTemp >= thresholds.cpu.critical) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `🔴 CPU temperature is ${cpuTemp.toFixed(1)}°C — CRITICAL!`,
        });
      } else if (cpuTemp >= thresholds.cpu.warning) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `🟡 CPU temperature is ${cpuTemp.toFixed(1)}°C — running warm.`,
        });
      }
    }
    
    if (gpuCoreTemp !== null) {
      if (gpuCoreTemp >= thresholds.gpu.critical) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `🔴 GPU temperature is ${gpuCoreTemp.toFixed(1)}°C — CRITICAL!`,
        });
      } else if (gpuCoreTemp >= thresholds.gpu.warning) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `🟡 GPU temperature is ${gpuCoreTemp.toFixed(1)}°C — running warm.`,
        });
      }
    }
    
    // Set message
    if (result.status === 'critical') {
      result.message = 'Critical temperatures detected!';
    } else if (result.status === 'warning') {
      result.message = 'Temperatures elevated';
    } else {
      const cpuStr = cpuTemp !== null ? `${cpuTemp.toFixed(0)}°C` : 'N/A';
      const gpuStr = gpuCoreTemp !== null ? `${gpuCoreTemp.toFixed(0)}°C` : 'N/A';
      result.message = `Temps OK — CPU: ${cpuStr}, GPU: ${gpuStr}`;
    }
    
  } catch (error) {
    result.status = 'error';
    result.message = `Temperature monitoring unavailable: ${error.message}`;
    result.details.error = error.message;
    result.details.hint = 'Ensure LibreHardwareMonitor is running with Remote Web Server enabled.';
    
    result.fixes.push({
      id: 'install-lhm',
      name: 'Install LibreHardwareMonitor',
      description: 'Download and run LibreHardwareMonitor with Options → Remote Web Server enabled',
      autoFix: false,
    });
  }

  return result;
}

/**
 * Get raw temperature data (for API endpoint)
 */
export async function getTemperatureData() {
  try {
    const config = await getConfig();
    const rawData = await fetchLHMData(config);
    const allSensors = extractSensors(rawData);
    const temperatures = allSensors.filter(s => s.type === 'Temperature');
    
    // Find key temps
    const cpuTemps = temperatures.filter(t => t.category === 'CPU' && !t.name.includes('Distance'));
    const gpuTemps = temperatures.filter(t => t.category === 'GPU');
    
    const cpuPackage = cpuTemps.find(t => t.name.includes('Package') || t.name === 'Core Max');
    const gpuCore = gpuTemps.find(t => t.name === 'GPU Core');
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      host: config.host,
      summary: {
        cpu: {
          package: cpuPackage?.value ?? null,
          average: cpuTemps.find(t => t.name.includes('Average'))?.value ?? null,
          max: cpuPackage?.max ?? null,
        },
        gpu: {
          core: gpuCore?.value ?? null,
          hotspot: gpuTemps.find(t => t.name.includes('Hot Spot'))?.value ?? null,
          max: gpuCore?.max ?? null,
        }
      },
      temperatures: temperatures
        .filter(t => !t.name.includes('Distance') && !t.name.includes('Limit'))
        .map(t => ({
          name: t.name,
          value: t.value,
          category: t.category,
          min: t.min,
          max: t.max,
        })),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
