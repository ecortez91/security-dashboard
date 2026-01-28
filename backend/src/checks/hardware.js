import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isWSL2 } from './utils.js';

const execAsync = promisify(exec);

// Get Windows temperature via OpenHardwareMonitor or PowerShell (if available)
async function getWindowsTemperature() {
  try {
    // Try to get temperature from Windows WMI
    const { stdout } = await execAsync(
      `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi 2>$null | Select-Object -First 1 -ExpandProperty CurrentTemperature"`,
      { timeout: 5000 }
    );
    const kelvin = parseInt(stdout.trim());
    if (kelvin && kelvin > 0) {
      // WMI returns temperature in tenths of Kelvin
      return (kelvin / 10) - 273.15;
    }
  } catch {
    // WMI thermal zone might not be available
  }
  return null;
}

export async function checkHardware() {
  const result = {
    name: 'Hardware Health',
    description: 'Monitors CPU temperature, fan speeds, and system health',
    category: 'hardware',
    status: 'pass',
    details: {},
    recommendations: [],
    fixes: [],
  };

  try {
    // CPU Temperature
    let temps = await si.cpuTemperature();
    
    // In WSL2, try to get temperature from Windows
    const inWSL2 = await isWSL2();
    if (inWSL2 && !temps.main) {
      const windowsTemp = await getWindowsTemperature();
      if (windowsTemp) {
        temps = { ...temps, main: Math.round(windowsTemp) };
      }
    }
    
    result.details.temperature = {
      main: temps.main,
      max: temps.max,
      cores: temps.cores,
      chipset: temps.chipset,
      source: inWSL2 ? 'wsl2' : 'native',
    };
    
    result.details.environment = { wsl2: inWSL2 };

    // Check for high temperatures
    if (temps.main) {
      if (temps.main > 85) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `CPU temperature is ${temps.main}°C — CRITICAL! Check cooling immediately.`,
        });
      } else if (temps.main > 75) {
        result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `CPU temperature is ${temps.main}°C — running hot. Check airflow and fans.`,
        });
      } else if (temps.main > 65) {
        result.recommendations.push({
          severity: 'medium',
          message: `CPU temperature is ${temps.main}°C — warm but acceptable.`,
        });
      }
    } else if (inWSL2) {
      // Don't warn about temp unavailability in WSL2, just note it
      result.details.tempNote = 'Temperature monitoring limited in WSL2. Install OpenHardwareMonitor on Windows for detailed readings.';
    }

    // CPU Info
    const cpu = await si.cpu();
    result.details.cpu = {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      speed: cpu.speed,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores,
    };

    // Current Load
    const load = await si.currentLoad();
    result.details.load = {
      currentLoad: Math.round(load.currentLoad),
      avgLoad: load.avgLoad,
      cpusLoad: load.cpus?.map(c => Math.round(c.load)),
    };

    if (load.currentLoad > 90) {
      if (result.status === 'pass') result.status = 'warning';
      result.recommendations.push({
        severity: 'medium',
        message: `CPU load is ${Math.round(load.currentLoad)}% — system under heavy load.`,
      });
    }

    // Memory
    const mem = await si.mem();
    result.details.memory = {
      total: formatBytes(mem.total),
      used: formatBytes(mem.used),
      free: formatBytes(mem.free),
      usedPercent: Math.round((mem.used / mem.total) * 100),
    };

    if (result.details.memory.usedPercent > 90) {
      if (result.status === 'pass') result.status = 'warning';
      result.recommendations.push({
        severity: 'high',
        message: `Memory usage is ${result.details.memory.usedPercent}% — consider closing applications.`,
      });
    }

    // Disk Usage
    const disks = await si.fsSize();
    result.details.disks = disks.map(d => ({
      mount: d.mount,
      size: formatBytes(d.size),
      used: formatBytes(d.used),
      usedPercent: Math.round(d.use),
    }));

    for (const disk of disks) {
      if (disk.use > 90) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `Disk ${disk.mount} is ${Math.round(disk.use)}% full — consider cleanup.`,
        });
      }
    }

    // Fans (if available)
    try {
      const fans = await si.fans();
      if (fans && fans.length > 0) {
        result.details.fans = fans;
        
        for (const fan of fans) {
          if (fan.rpm === 0) {
            result.status = 'critical';
            result.recommendations.push({
              severity: 'critical',
              message: `Fan "${fan.name || 'Unknown'}" is not spinning (0 RPM)! Check immediately.`,
            });
          }
        }
      }
    } catch {
      // Fans not available on all systems
    }

    // Battery (if laptop)
    try {
      const battery = await si.battery();
      if (battery.hasBattery) {
        result.details.battery = {
          percent: battery.percent,
          isCharging: battery.isCharging,
          cycleCount: battery.cycleCount,
          maxCapacity: battery.maxCapacity,
        };
      }
    } catch {
      // Battery not available
    }

    // System Uptime
    const time = si.time();
    result.details.uptime = formatUptime(time.uptime);

    // Determine overall message
    if (result.status === 'critical') {
      result.message = 'Critical hardware issues detected!';
    } else if (result.status === 'warning') {
      result.message = 'Hardware warnings detected';
    } else {
      const tempStr = temps.main ? `${temps.main}°C` : 'N/A';
      result.message = `System healthy — CPU: ${tempStr}, Load: ${Math.round(load.currentLoad)}%, RAM: ${result.details.memory.usedPercent}%`;
    }

  } catch (error) {
    result.status = 'error';
    result.message = `Failed to check hardware: ${error.message}`;
  }

  return result;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
