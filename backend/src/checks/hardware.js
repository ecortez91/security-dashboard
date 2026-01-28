import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isWSL2 } from './utils.js';

const execAsync = promisify(exec);

// Get hardware data from LibreHardwareMonitor web server
async function getLibreHardwareMonitorData() {
  try {
    const response = await fetch('http://localhost:8085/data.json', { 
      signal: AbortSignal.timeout(3000) 
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // LibreHardwareMonitor not running or web server not enabled
  }
  return null;
}

// Parse LHM data to extract temperatures
function parseLHMTemperatures(data) {
  const temps = { cpu: null, gpu: null, all: [] };
  
  function traverse(node) {
    if (!node) return;
    
    // Check if this is a temperature sensor
    if (node.Type === 'Temperature' && node.Value) {
      const value = parseFloat(node.Value.replace(/[^0-9.]/g, ''));
      if (!isNaN(value)) {
        temps.all.push({ name: node.Text, value });
        
        // Identify CPU and GPU temps
        const name = node.Text.toLowerCase();
        if (name.includes('cpu') || name.includes('core')) {
          if (!temps.cpu || value > temps.cpu) temps.cpu = value;
        }
        if (name.includes('gpu')) {
          if (!temps.gpu || value > temps.gpu) temps.gpu = value;
        }
      }
    }
    
    // Recurse into children
    if (node.Children) {
      for (const child of node.Children) {
        traverse(child);
      }
    }
  }
  
  traverse(data);
  return temps;
}

// Parse LHM data to extract fan speeds
function parseLHMFans(data) {
  const fans = [];
  
  function traverse(node) {
    if (!node) return;
    
    if (node.Type === 'Fan' && node.Value) {
      const rpm = parseInt(node.Value.replace(/[^0-9]/g, ''));
      fans.push({ name: node.Text, rpm: isNaN(rpm) ? 0 : rpm });
    }
    
    if (node.Children) {
      for (const child of node.Children) {
        traverse(child);
      }
    }
  }
  
  traverse(data);
  return fans;
}

// Get Windows temperature via WMI (works without extra software!)
async function getWindowsTemperature() {
  try {
    const { stdout } = await execAsync(
      `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi -ErrorAction Stop | Select-Object -First 1 -ExpandProperty CurrentTemperature"`,
      { timeout: 8000 }
    );
    const kelvin = parseInt(stdout.trim());
    if (kelvin && kelvin > 0) {
      return Math.round(((kelvin / 10) - 273.15) * 10) / 10; // Round to 1 decimal
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
    // Check environment
    const inWSL2 = await isWSL2();
    result.details.environment = { wsl2: inWSL2 };
    
    // Try to get data from LibreHardwareMonitor first
    let lhmData = null;
    let lhmTemps = null;
    let lhmFans = null;
    
    if (inWSL2) {
      lhmData = await getLibreHardwareMonitorData();
      if (lhmData) {
        lhmTemps = parseLHMTemperatures(lhmData);
        lhmFans = parseLHMFans(lhmData);
        result.details.dataSource = 'LibreHardwareMonitor';
      }
    }
    
    // CPU Temperature
    let temps = await si.cpuTemperature();
    
    // In WSL2, try WMI first (no extra software needed), then LHM as backup
    if (inWSL2 && !temps.main) {
      const windowsTemp = await getWindowsTemperature();
      if (windowsTemp) {
        temps = { ...temps, main: windowsTemp };
        result.details.dataSource = 'Windows WMI';
      } else if (lhmTemps?.cpu) {
        temps = { ...temps, main: Math.round(lhmTemps.cpu) };
        result.details.dataSource = 'LibreHardwareMonitor';
      }
    }
    
    result.details.temperature = {
      main: temps.main,
      max: temps.max,
      cores: temps.cores,
      chipset: temps.chipset,
      gpu: lhmTemps?.gpu || null,
      all: lhmTemps?.all || [],
      source: lhmData ? 'LibreHardwareMonitor' : (inWSL2 ? 'wsl2-fallback' : 'native'),
    };
    
    // Fan data from LHM
    if (lhmFans && lhmFans.length > 0) {
      result.details.fans = lhmFans;
      
      // Check for stopped fans
      for (const fan of lhmFans) {
        if (fan.rpm === 0) {
          result.status = 'critical';
          result.recommendations.push({
            severity: 'critical',
            message: `Fan "${fan.name}" is not spinning (0 RPM)! Check immediately.`,
          });
        }
      }
    }

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
    } else if (inWSL2 && !temps.main) {
      // No temperature source available
      result.details.tempNote = 'Temperature monitoring unavailable. For detailed sensor data, install LibreHardwareMonitor on Windows.';
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

    // Disk Usage (filter out WSL special mounts)
    const disks = await si.fsSize();
    const ignoreMounts = ['/mnt/wsl', '/mnt/wslg', '/usr/lib/wsl', '/usr/lib/modules'];
    
    result.details.disks = disks
      .filter(d => !ignoreMounts.some(m => d.mount.startsWith(m)))
      .map(d => ({
        mount: d.mount,
        size: formatBytes(d.size),
        used: formatBytes(d.used),
        usedPercent: Math.round(d.use),
      }));

    for (const disk of result.details.disks) {
      if (disk.usedPercent > 90) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `Disk ${disk.mount} is ${disk.usedPercent}% full — consider cleanup.`,
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
