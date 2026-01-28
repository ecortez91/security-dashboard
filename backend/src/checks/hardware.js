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

// Get sensor data from OpenHardwareMonitor WMI
async function getOHMSensors() {
  try {
    const { stdout } = await execAsync(
      `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "Get-CimInstance -Namespace root/OpenHardwareMonitor -ClassName Sensor -ErrorAction Stop | Select-Object Name, SensorType, Value, Parent | ConvertTo-Json"`,
      { timeout: 10000 }
    );
    const sensors = JSON.parse(stdout);
    return Array.isArray(sensors) ? sensors : [sensors];
  } catch {
    return null;
  }
}

// Get NVIDIA GPU info via nvidia-smi
async function getNvidiaGPUInfo() {
  try {
    const { stdout } = await execAsync(
      `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "nvidia-smi --query-gpu=temperature.gpu,name,utilization.gpu,fan.speed,memory.used,memory.total --format=csv,noheader"`,
      { timeout: 8000 }
    );
    const parts = stdout.trim().split(',').map(s => s.trim());
    if (parts.length >= 4) {
      return {
        temperature: parseInt(parts[0]),
        name: parts[1],
        utilization: parseInt(parts[2]),
        fanSpeed: parseInt(parts[3]),
        memoryUsed: parts[4] || null,
        memoryTotal: parts[5] || null,
      };
    }
  } catch {
    // nvidia-smi not available or no NVIDIA GPU
  }
  return null;
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
    
    // Get NVIDIA GPU info
    const gpuInfo = inWSL2 ? await getNvidiaGPUInfo() : null;
    
    // Get OpenHardwareMonitor data (for fans)
    const ohmSensors = inWSL2 ? await getOHMSensors() : null;
    
    // Extract fan data from OHM
    if (ohmSensors) {
      const fans = ohmSensors.filter(s => s.SensorType === 'Fan');
      if (fans.length > 0) {
        result.details.fans = fans.map(f => ({
          name: f.Name + (f.Parent?.includes('nvidia') ? ' (GPU)' : ''),
          rpm: Math.round(f.Value),
        }));
        
        // Check for stopped fans
        for (const fan of result.details.fans) {
          if (fan.rpm === 0) {
            // Only alert if temp is high (fan might be in 0 RPM mode)
            const relatedTemp = ohmSensors.find(s => 
              s.SensorType === 'Temperature' && 
              s.Parent === fans.find(f2 => f2.Name === fan.name.replace(' (GPU)', ''))?.Parent
            );
            if (relatedTemp && relatedTemp.Value > 60) {
              result.status = 'critical';
              result.recommendations.push({
                severity: 'critical',
                message: `${fan.name} is at 0 RPM but temp is ${relatedTemp.Value}°C — check fan!`,
              });
            }
          }
        }
      }
      result.details.ohmConnected = true;
    }
    
    result.details.temperature = {
      cpu: temps.main,
      gpu: gpuInfo?.temperature || lhmTemps?.gpu || null,
      max: temps.max,
      cores: temps.cores,
      source: result.details.dataSource || (inWSL2 ? 'wsl2' : 'native'),
    };
    
    // GPU details
    if (gpuInfo) {
      result.details.gpu = {
        name: gpuInfo.name,
        temperature: gpuInfo.temperature,
        utilization: gpuInfo.utilization,
        fanSpeed: gpuInfo.fanSpeed,
        memoryUsed: gpuInfo.memoryUsed,
        memoryTotal: gpuInfo.memoryTotal,
      };
      
      // Check GPU temperature
      if (gpuInfo.temperature > 85) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `GPU temperature is ${gpuInfo.temperature}°C — CRITICAL! Check cooling.`,
        });
      } else if (gpuInfo.temperature > 80) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `GPU temperature is ${gpuInfo.temperature}°C — running hot.`,
        });
      }
      
      // Check GPU fan (0% might mean fans off due to low temp, or stopped fan)
      if (gpuInfo.fanSpeed === 0 && gpuInfo.temperature > 60) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `GPU fan is at 0% but temperature is ${gpuInfo.temperature}°C — check fan!`,
        });
      }
    }
    
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

    // Check for high CPU temperatures
    const cpuTemp = result.details.temperature.cpu;
    if (cpuTemp) {
      if (cpuTemp > 85) {
        result.status = 'critical';
        result.recommendations.push({
          severity: 'critical',
          message: `CPU temperature is ${cpuTemp}°C — CRITICAL! Check cooling immediately.`,
        });
      } else if (cpuTemp > 75) {
        if (result.status === 'pass') result.status = 'warning';
        result.recommendations.push({
          severity: 'high',
          message: `CPU temperature is ${cpuTemp}°C — running hot. Check airflow and fans.`,
        });
      } else if (cpuTemp > 65) {
        result.recommendations.push({
          severity: 'medium',
          message: `CPU temperature is ${cpuTemp}°C — warm but acceptable.`,
        });
      }
    } else if (inWSL2) {
      result.details.tempNote = 'CPU temperature unavailable via WMI.';
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
      const cpuTempStr = result.details.temperature.cpu ? `${result.details.temperature.cpu}°C` : 'N/A';
      const gpuTempStr = result.details.gpu?.temperature ? `${result.details.gpu.temperature}°C` : null;
      const tempInfo = gpuTempStr ? `CPU: ${cpuTempStr}, GPU: ${gpuTempStr}` : `CPU: ${cpuTempStr}`;
      result.message = `System healthy — ${tempInfo}, RAM: ${result.details.memory.usedPercent}%`;
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
