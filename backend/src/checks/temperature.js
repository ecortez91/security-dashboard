/**
 * Temperature Check Module
 * 
 * Dedicated temperature monitoring using thermal-pulse.
 * Provides detailed CPU/GPU temperature data with status thresholds.
 */

import { config as defaultConfig } from '../../../tools/thermal-pulse/src/config.js';
import * as sensors from '../../../tools/thermal-pulse/src/sensors.js';
import { getStatusText, getStatusEmoji } from '../../../tools/thermal-pulse/src/formatter.js';

// Re-export for direct API use
export { sensors };

/**
 * Get temperature configuration
 * Falls back to thermal-pulse defaults if not set
 */
function getConfig() {
  return {
    host: process.env.LHM_HOST || defaultConfig.lhm.host,
    port: parseInt(process.env.LHM_PORT, 10) || defaultConfig.lhm.port,
    username: process.env.LHM_USERNAME || defaultConfig.lhm.username,
    password: process.env.LHM_PASSWORD || defaultConfig.lhm.password,
    thresholds: defaultConfig.thresholds,
  };
}

/**
 * Security-focused temperature check
 * Returns results compatible with the security dashboard format
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

  const conf = getConfig();

  try {
    // Get snapshot from thermal-pulse
    const snapshot = await sensors.getSnapshot();
    
    result.details.timestamp = snapshot.timestamp.toISOString();
    result.details.source = 'LibreHardwareMonitor (thermal-pulse)';
    
    // CPU Temperature
    const cpuTemp = snapshot.summary.cpu.package;
    const cpuAvg = snapshot.summary.cpu.average;
    const cpuMax = snapshot.summary.cpu.max;
    
    result.details.cpu = {
      current: cpuTemp,
      average: cpuAvg,
      sessionMax: cpuMax,
      status: cpuTemp !== null ? getStatusText(cpuTemp, 'cpu') : 'UNKNOWN',
      emoji: cpuTemp !== null ? getStatusEmoji(cpuTemp, 'cpu') : '❓',
    };
    
    // GPU Temperature
    const gpuCore = snapshot.summary.gpu.core;
    const gpuHotspot = snapshot.summary.gpu.hotspot;
    const gpuMax = snapshot.summary.gpu.max;
    
    result.details.gpu = {
      current: gpuCore,
      hotspot: gpuHotspot,
      sessionMax: gpuMax,
      status: gpuCore !== null ? getStatusText(gpuCore, 'gpu') : 'UNKNOWN',
      emoji: gpuCore !== null ? getStatusEmoji(gpuCore, 'gpu') : '❓',
    };
    
    // All temperatures for detailed view
    result.details.allTemps = snapshot.temperatures
      .filter(t => !t.name.includes('Distance') && !t.name.includes('Limit') && !t.name.includes('Resolution'))
      .map(t => ({
        name: t.name,
        value: t.value,
        category: t.category,
        min: t.min,
        max: t.max,
      }));
    
    // Determine overall status and recommendations
    const thresholds = conf.thresholds;
    
    // CPU status
    if (cpuTemp !== null) {
      if (cpuTemp >= thresholds.cpu.critical) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `🔴 CPU temperature is ${cpuTemp.toFixed(1)}°C — CRITICAL! Immediate action required.`,
        });
      } else if (cpuTemp >= thresholds.cpu.warning) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `🟡 CPU temperature is ${cpuTemp.toFixed(1)}°C — running warm. Check cooling.`,
        });
      }
    }
    
    // GPU status
    if (gpuCore !== null) {
      if (gpuCore >= thresholds.gpu.critical) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `🔴 GPU temperature is ${gpuCore.toFixed(1)}°C — CRITICAL! Check GPU cooling immediately.`,
        });
      } else if (gpuCore >= thresholds.gpu.warning) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `🟡 GPU temperature is ${gpuCore.toFixed(1)}°C — running warm.`,
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
      const gpuStr = gpuCore !== null ? `${gpuCore.toFixed(0)}°C` : 'N/A';
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
    const snapshot = await sensors.getSnapshot();
    return {
      success: true,
      timestamp: snapshot.timestamp.toISOString(),
      summary: snapshot.summary,
      temperatures: snapshot.temperatures.map(t => ({
        name: t.name,
        value: t.value,
        unit: t.unit,
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
