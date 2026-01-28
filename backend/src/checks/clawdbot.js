/**
 * Clawdbot Security Audit Check
 * 
 * Runs `clawdbot security audit` and parses the results.
 * Works on both WSL (Linux) and Windows.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Parse clawdbot security audit output
 */
function parseAuditOutput(output) {
  const result = {
    summary: { critical: 0, warn: 0, info: 0 },
    issues: [],
    attackSurface: {}
  };
  
  // Parse summary line
  const summaryMatch = output.match(/Summary:\s*(\d+)\s*critical\s*·\s*(\d+)\s*warn\s*·\s*(\d+)\s*info/);
  if (summaryMatch) {
    result.summary.critical = parseInt(summaryMatch[1], 10);
    result.summary.warn = parseInt(summaryMatch[2], 10);
    result.summary.info = parseInt(summaryMatch[3], 10);
  }
  
  // Parse issues
  const lines = output.split('\n');
  let currentSeverity = null;
  let currentIssue = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect severity headers
    if (trimmed === 'CRITICAL') {
      currentSeverity = 'critical';
      continue;
    } else if (trimmed === 'WARN') {
      currentSeverity = 'warning';
      continue;
    } else if (trimmed === 'INFO') {
      currentSeverity = 'info';
      continue;
    }
    
    // Skip empty lines and headers
    if (!trimmed || trimmed.startsWith('Clawdbot security') || trimmed.startsWith('Summary:') || trimmed.startsWith('Run deeper:')) {
      continue;
    }
    
    // Parse issue line (id + title)
    const issueMatch = trimmed.match(/^([a-z_.]+)\s+(.+)$/);
    if (issueMatch && currentSeverity) {
      // Save previous issue if exists
      if (currentIssue) {
        result.issues.push(currentIssue);
      }
      
      currentIssue = {
        id: issueMatch[1],
        title: issueMatch[2],
        severity: currentSeverity,
        description: '',
        fix: ''
      };
      continue;
    }
    
    // Parse description/fix lines (indented)
    if (currentIssue && line.startsWith('  ')) {
      if (trimmed.startsWith('Fix:')) {
        currentIssue.fix = trimmed.replace('Fix:', '').trim();
      } else if (trimmed.includes('groups:') || trimmed.includes('tools.') || trimmed.includes('hooks:') || trimmed.includes('browser')) {
        // Attack surface info
        const parts = trimmed.split(/[,:]\s*/);
        parts.forEach(part => {
          const [key, val] = part.split('=');
          if (key && val !== undefined) {
            result.attackSurface[key.trim()] = val.trim();
          } else if (part.includes(':')) {
            const [k, v] = part.split(':');
            result.attackSurface[k.trim()] = v.trim();
          }
        });
      } else {
        currentIssue.description = (currentIssue.description ? currentIssue.description + ' ' : '') + trimmed;
      }
    }
  }
  
  // Don't forget the last issue
  if (currentIssue) {
    result.issues.push(currentIssue);
  }
  
  return result;
}

/**
 * Run clawdbot security audit
 */
export async function checkClawdbot() {
  const result = {
    name: 'Clawdbot Security',
    description: 'Security audit of Clawdbot/Gateway configuration',
    category: 'application',
    status: 'pass',
    details: {},
    recommendations: [],
    fixes: [],
  };

  try {
    // Try running from WSL first
    let auditOutput = '';
    let platform = 'linux';
    
    try {
      const { stdout } = await execAsync('clawdbot security audit 2>&1', { timeout: 30000 });
      auditOutput = stdout;
    } catch (e) {
      // Try from PowerShell (Windows)
      try {
        const { stdout } = await execAsync(
          '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "clawdbot security audit"',
          { timeout: 30000 }
        );
        auditOutput = stdout;
        platform = 'windows';
      } catch {
        throw new Error('Could not run clawdbot security audit on either platform');
      }
    }
    
    // If WSL output has 0 critical, also check Windows
    const wslParsed = parseAuditOutput(auditOutput);
    
    if (wslParsed.summary.critical === 0 && platform === 'linux') {
      try {
        const { stdout: winOutput } = await execAsync(
          '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "clawdbot security audit"',
          { timeout: 30000 }
        );
        const winParsed = parseAuditOutput(winOutput);
        
        // Merge results if Windows has issues
        if (winParsed.summary.critical > 0 || winParsed.summary.warn > wslParsed.summary.warn) {
          result.details.windows = winParsed;
          result.details.wsl = wslParsed;
          result.details.combined = {
            summary: {
              critical: wslParsed.summary.critical + winParsed.summary.critical,
              warn: wslParsed.summary.warn + winParsed.summary.warn,
              info: Math.max(wslParsed.summary.info, winParsed.summary.info)
            },
            issues: [...wslParsed.issues, ...winParsed.issues.map(i => ({ ...i, platform: 'windows' }))]
          };
        } else {
          result.details = wslParsed;
          result.details.platform = 'wsl';
        }
      } catch {
        // Windows check failed, just use WSL results
        result.details = wslParsed;
        result.details.platform = 'wsl';
      }
    } else {
      result.details = wslParsed;
      result.details.platform = platform;
    }
    
    // Determine status and build recommendations
    const combined = result.details.combined || result.details;
    const summary = combined.summary;
    const issues = combined.issues || result.details.issues || [];
    
    if (summary.critical > 0) {
      result.status = 'critical';
      result.message = `${summary.critical} critical security issue(s) found!`;
    } else if (summary.warn > 0) {
      result.status = 'warning';
      result.message = `${summary.warn} warning(s) found`;
    } else {
      result.message = 'Clawdbot configuration is secure';
    }
    
    // Add recommendations for each issue
    issues.forEach(issue => {
      result.recommendations.push({
        severity: issue.severity === 'critical' ? 'critical' : issue.severity === 'warning' ? 'high' : 'low',
        message: `[${issue.id}] ${issue.title}: ${issue.description}`
      });
      
      if (issue.fix) {
        result.fixes.push({
          id: `clawdbot_${issue.id}`,
          name: issue.title,
          description: issue.description,
          autoFix: false,
          command: issue.fix,
          manualSteps: [
            issue.fix.startsWith('chmod') 
              ? `Run in terminal: ${issue.fix}`
              : issue.fix,
            'Re-run: clawdbot security audit to verify'
          ],
          platform: issue.platform || result.details.platform
        });
      }
    });
    
    // Store raw output for debugging
    result.details.rawOutput = auditOutput;
    
  } catch (error) {
    result.status = 'error';
    result.message = `Failed to run Clawdbot audit: ${error.message}`;
    result.details.error = error.message;
  }

  return result;
}

/**
 * Run deep audit
 */
export async function checkClawdbotDeep() {
  try {
    const { stdout } = await execAsync('clawdbot security audit --deep 2>&1', { timeout: 60000 });
    return parseAuditOutput(stdout);
  } catch {
    try {
      const { stdout } = await execAsync(
        '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "clawdbot security audit --deep"',
        { timeout: 60000 }
      );
      return parseAuditOutput(stdout);
    } catch (error) {
      throw new Error(`Deep audit failed: ${error.message}`);
    }
  }
}
