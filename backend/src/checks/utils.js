import { readFile } from 'fs/promises';

/**
 * Detect if running inside WSL2
 */
export async function isWSL2() {
  try {
    const release = await readFile('/proc/version', 'utf8');
    return release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
  } catch {
    return false;
  }
}

/**
 * Check if WSL2 is using NAT mode (default) vs mirrored networking
 */
export async function getWSLNetworkMode() {
  try {
    // Check for mirrored mode in .wslconfig
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "Get-Content $env:USERPROFILE\\.wslconfig 2>$null"');
    
    if (stdout.toLowerCase().includes('networkingmode=mirrored')) {
      return 'mirrored';
    }
  } catch {
    // Ignore errors
  }
  
  return 'nat'; // Default mode
}
