'use client';

import { useState, useEffect } from 'react';

// Dynamic API URL - uses same host as frontend but port 4000
const getApiBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  return `http://${window.location.hostname}:4000`;
};
import { 
  ShieldCheckIcon, 
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  ServerIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
  CommandLineIcon,
  CloudIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface SecurityCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'pass' | 'warning' | 'critical' | 'error' | 'info';
  message: string;
  details: Record<string, unknown>;
  recommendations: Array<{ severity: string; message: string }>;
  fixes: Array<{ 
    id: string; 
    name: string; 
    description: string; 
    autoFix: boolean;
    script?: string;
    command?: string;
    manualSteps?: string[];
  }>;
}

interface SecurityResults {
  timestamp: string;
  overallScore: number;
  totalChecks: number;
  passed: number;
  info: number;
  warnings: number;
  critical: number;
  checks: SecurityCheck[];
}

const categoryIcons: Record<string, React.ElementType> = {
  network: GlobeAltIcon,
  security: LockClosedIcon,
  system: ComputerDesktopIcon,
  application: CommandLineIcon,
  hardware: ServerIcon,
};

const statusColors = {
  pass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  critical: 'text-red-500 bg-red-500/10 border-red-500/20',
  error: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
  info: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
};

const statusIcons = {
  pass: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  critical: XCircleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
};

// Helper to detect if commands are real terminal commands or just suggestions
const isRealCommand = (commands: string[]): boolean => {
  if (!commands || commands.length === 0) return false;
  
  // Common terminal command prefixes
  const terminalPrefixes = [
    'sudo', 'apt', 'apt-get', 'npm', 'yarn', 'pnpm', 'pip', 'pip3',
    'systemctl', 'service', 'docker', 'git', 'cd', 'mkdir', 'rm', 'mv',
    'cp', 'chmod', 'chown', 'cat', 'echo', 'export', 'source', 'curl',
    'wget', 'tar', 'unzip', 'zip', 'grep', 'sed', 'awk', 'find', 'ls',
    'touch', 'nano', 'vim', 'vi', 'code', 'node', 'python', 'python3',
    'brew', 'yum', 'dnf', 'pacman', 'snap', 'flatpak', 'ssh', 'scp',
    'rsync', 'kill', 'pkill', 'ps', 'top', 'htop', 'df', 'du', 'free',
    'ufw', 'iptables', 'firewall-cmd', 'journalctl', 'dmesg', 'tail',
    'head', 'less', 'more', 'wc', 'sort', 'uniq', 'xargs', 'tee',
    'clawdbot', 'clawd', './', '/'
  ];
  
  // Check if first command starts with a terminal prefix
  const firstCmd = commands[0].trim().toLowerCase();
  return terminalPrefixes.some(prefix => 
    firstCmd.startsWith(prefix + ' ') || firstCmd.startsWith(prefix + '\n') || firstCmd === prefix
  );
};

export default function Dashboard() {
  const [results, setResults] = useState<SecurityResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, unknown> | null>(null);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [modalCheck, setModalCheck] = useState<SecurityCheck | null>(null);
  const [detectedOS, setDetectedOS] = useState<'windows' | 'macos' | 'linux'>('linux');
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const fetchSecurityChecks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/checks`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Failed to fetch security checks:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFix = async (fixId: string) => {
    setApplyingFix(fixId);
    try {
      const response = await fetch(`${getApiBase()}/api/fixes/${fixId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      
      if (result.success) {
        // Refresh checks after fix
        await fetchSecurityChecks();
      } else {
        alert(`Fix failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to apply fix:', error);
      alert('Failed to apply fix. Check console for details.');
    } finally {
      setApplyingFix(null);
    }
  };

  const getAISuggestions = async (check: SecurityCheck) => {
    setLoadingAI(check.id);
    setAiSuggestions(null);
    setModalCheck(check);
    setShowAIModal(true);
    try {
      const response = await fetch(`${getApiBase()}/api/ai-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check, platform: detectedOS }),
      });
      const suggestions = await response.json();
      setAiSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
    } finally {
      setLoadingAI(null);
    }
  };

  const downloadScript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchSecurityChecks();
    // Detect OS
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setDetectedOS('windows');
    else if (ua.includes('mac')) setDetectedOS('macos');
    else setDetectedOS('linux');
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-emerald-600';
    if (score >= 60) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
                <ShieldCheckIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
                <p className="text-sm text-slate-400">System Health & Security Monitor</p>
              </div>
            </div>
            
            <button
              onClick={fetchSecurityChecks}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-cyan-500/25"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scanning...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !results ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-slate-700 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-20 h-20 border-4 border-t-cyan-500 rounded-full animate-spin"></div>
            </div>
            <p className="mt-6 text-slate-400 text-lg">Running security checks...</p>
          </div>
        ) : results ? (
          <>
            {/* Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Overall Score */}
              <div className="md:col-span-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Security Score</p>
                    <p className={`text-6xl font-bold mt-2 ${getScoreColor(results.overallScore)}`}>
                      {results.overallScore}
                    </p>
                    <p className="text-slate-500 text-sm mt-2">out of 100</p>
                  </div>
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-slate-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="url(#scoreGradient)"
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${(results.overallScore / 100) * 352} 352`}
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" className={results.overallScore >= 80 ? 'text-emerald-500' : results.overallScore >= 60 ? 'text-amber-500' : 'text-red-500'} stopColor="currentColor" />
                          <stop offset="100%" className={results.overallScore >= 80 ? 'text-emerald-600' : results.overallScore >= 60 ? 'text-amber-600' : 'text-red-600'} stopColor="currentColor" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {results.overallScore >= 80 ? (
                        <ShieldCheckIcon className="w-12 h-12 text-emerald-500" />
                      ) : results.overallScore >= 60 ? (
                        <ExclamationTriangleIcon className="w-12 h-12 text-amber-500" />
                      ) : (
                        <ShieldExclamationIcon className="w-12 h-12 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                  <div>
                    <p className="text-emerald-400 text-sm">Passed</p>
                    <p className="text-3xl font-bold text-white">{results.passed + (results.info || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <ExclamationTriangleIcon className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="text-amber-400 text-sm">Warnings</p>
                    <p className="text-3xl font-bold text-white">{results.warnings}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* WSL2 Info Banner */}
            {results.info > 0 && (
              <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-4">
                <ShieldCheckIcon className="w-10 h-10 text-blue-500 flex-shrink-0" />
                <div>
                  <h3 className="text-blue-400 font-semibold text-lg">WSL2 Environment Detected</h3>
                  <p className="text-blue-300/80">
                    {results.info} check(s) show informational status — not security risks in your isolated WSL2 NAT environment.
                  </p>
                </div>
              </div>
            )}

            {/* Critical Alert */}
            {results.critical > 0 && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-4">
                <ShieldExclamationIcon className="w-10 h-10 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="text-red-400 font-semibold text-lg">Critical Issues Detected!</h3>
                  <p className="text-red-300/80">
                    {results.critical} critical security issue(s) require immediate attention.
                  </p>
                </div>
              </div>
            )}

            {/* Security Checks */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Security Checks</h2>
              
              {results.checks.map((check) => {
                const StatusIcon = statusIcons[check.status];
                const CategoryIcon = categoryIcons[check.category] || ServerIcon;
                const isExpanded = expandedCheck === check.id;
                
                return (
                  <div
                    key={check.id}
                    className={`bg-slate-800/30 rounded-xl border transition-all duration-300 ${
                      isExpanded ? 'border-slate-600' : 'border-slate-700/50'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedCheck(isExpanded ? null : check.id)}
                      className="w-full p-3 sm:p-4 flex items-start sm:items-center gap-3 sm:gap-4 text-left cursor-pointer hover:bg-slate-700/30 transition-all rounded-t-xl"
                    >
                      <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${statusColors[check.status]}`}>
                        <StatusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h3 className="text-white font-medium text-sm sm:text-base">{check.name}</h3>
                          <span className="px-1.5 sm:px-2 py-0.5 bg-slate-700/50 text-slate-400 text-[10px] sm:text-xs rounded-full flex items-center gap-1">
                            <CategoryIcon className="w-3 h-3" />
                            {check.category}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1 line-clamp-2 sm:truncate">{check.message}</p>
                      </div>

                      <div className={`flex-shrink-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium capitalize ${statusColors[check.status]}`}>
                        {check.status}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-700/50 pt-3 sm:pt-4">
                        <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4">{check.description}</p>
                        
                        {/* Recommendations */}
                        {check.recommendations.length > 0 && (
                          <div className="mb-3 sm:mb-4">
                            <h4 className="text-white font-medium text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-2">
                              <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                              Recommendations
                            </h4>
                            <ul className="space-y-1.5 sm:space-y-2">
                              {check.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                  <span className={`flex-shrink-0 px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium capitalize ${
                                    rec.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                    rec.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                    rec.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-slate-500/20 text-slate-400'
                                  }`}>
                                    {rec.severity}
                                  </span>
                                  <span className="text-slate-300 break-words">{rec.message}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Available Fixes */}
                        {check.fixes.length > 0 && (
                          <div>
                            <h4 className="text-white font-medium text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-2">
                              <WrenchScrewdriverIcon className="w-4 h-4 text-cyan-500" />
                              Available Fixes
                            </h4>
                            <div className="space-y-2">
                              {check.fixes.map((fix) => (
                                <div 
                                  key={fix.id}
                                  className="p-2 sm:p-3 bg-slate-900/50 rounded-lg"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-white text-xs sm:text-sm font-medium">{fix.name}</p>
                                      <p className="text-slate-400 text-[10px] sm:text-xs break-words">{fix.description}</p>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                      {fix.autoFix ? (
                                        <button
                                          onClick={() => applyFix(fix.id)}
                                          disabled={applyingFix === fix.id}
                                          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
                                        >
                                          {applyingFix === fix.id ? (
                                            <>
                                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                              Applying...
                                            </>
                                          ) : (
                                            'Apply Fix'
                                          )}
                                        </button>
                                      ) : (
                                        <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-600/20 text-amber-400 text-xs sm:text-sm font-medium rounded-lg border border-amber-600/30 whitespace-nowrap">
                                          Manual Fix
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Manual Steps */}
                                  {fix.manualSteps && fix.manualSteps.length > 0 && (
                                    <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-slate-950 rounded-lg border border-slate-700">
                                      <p className="text-slate-300 text-[10px] sm:text-xs font-semibold mb-1.5 sm:mb-2">📋 Manual Steps:</p>
                                      <ol className="list-decimal list-inside space-y-1">
                                        {fix.manualSteps.map((step, idx) => (
                                          <li key={idx} className="text-slate-400 text-[10px] sm:text-xs break-words">
                                            {step.startsWith('Run:') ? (
                                              <>
                                                Run: <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-400 break-all">{step.replace('Run: ', '')}</code>
                                              </>
                                            ) : (
                                              step
                                            )}
                                          </li>
                                        ))}
                                      </ol>
                                      {fix.command && (
                                        <div className="mt-2 pt-2 border-t border-slate-700">
                                          <p className="text-slate-500 text-[10px] sm:text-xs">Quick command:</p>
                                          <code className="block mt-1 p-1.5 sm:p-2 bg-slate-800 rounded text-cyan-400 text-[10px] sm:text-xs select-all break-all overflow-x-auto">
                                            {fix.command}
                                          </code>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AI Suggestions Button */}
                        {check.status !== 'pass' && (
                          <div className="mt-3 sm:mt-4">
                            <button
                              onClick={() => getAISuggestions(check)}
                              disabled={loadingAI === check.id}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
                            >
                              {loadingAI === check.id ? (
                                <>
                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  🤖 AI Suggest Fix
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* AI Suggestions Display */}
                        {aiSuggestions && (aiSuggestions as { checkId?: string }).checkId === check.id && (
                          <div className="mt-4 p-4 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/30">
                            <h4 className="text-purple-300 text-sm font-semibold mb-3 flex items-center gap-2">
                              🤖 AI Analysis & Suggestions
                            </h4>
                            
                            {/* Analysis */}
                            <div className="mb-4 p-3 bg-slate-950/50 rounded-lg">
                              <p className="text-slate-300 text-xs font-semibold mb-2">📊 Analysis:</p>
                              <pre className="text-slate-400 text-xs whitespace-pre-wrap">
                                {(aiSuggestions as { analysis?: string }).analysis}
                              </pre>
                            </div>
                            
                            {/* Suggested Fixes */}
                            {(aiSuggestions as { suggestedFixes?: Array<{ title: string; description: string; steps: string[]; commands?: string[]; warning?: string; risk?: string }> }).suggestedFixes?.map((fix, idx) => (
                              <div key={idx} className="mb-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-white text-sm font-medium">{fix.title}</p>
                                  {fix.risk && (
                                    <span className={`px-2 py-0.5 text-xs rounded ${
                                      fix.risk === 'high' ? 'bg-red-600/30 text-red-400' :
                                      fix.risk === 'medium' ? 'bg-amber-600/30 text-amber-400' :
                                      'bg-green-600/30 text-green-400'
                                    }`}>
                                      {fix.risk} risk
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-400 text-xs mb-2">{fix.description}</p>
                                
                                {fix.warning && (
                                  <div className="mb-2 p-2 bg-amber-900/30 rounded border border-amber-600/30">
                                    <p className="text-amber-400 text-xs">{fix.warning}</p>
                                  </div>
                                )}
                                
                                <p className="text-slate-300 text-xs font-semibold mb-1">Steps:</p>
                                <ol className="list-decimal list-inside space-y-1 mb-2">
                                  {fix.steps.map((step, stepIdx) => (
                                    <li key={stepIdx} className="text-slate-400 text-xs">{step}</li>
                                  ))}
                                </ol>
                                
                                {fix.commands && fix.commands.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-slate-500 text-xs mb-1">Commands:</p>
                                    <div className="bg-slate-950 p-2 rounded">
                                      {fix.commands.map((cmd, cmdIdx) => (
                                        <code key={cmdIdx} className="block text-cyan-400 text-xs select-all">{cmd}</code>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {/* Generated Script */}
                            {(aiSuggestions as { generatedScript?: { content: string; filename: string } }).generatedScript && (
                              <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-cyan-600/30">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-cyan-300 text-xs font-semibold">📜 Generated Fix Script</p>
                                  <button
                                    onClick={() => {
                                      const script = (aiSuggestions as { generatedScript: { content: string; filename: string } }).generatedScript;
                                      const blob = new Blob([script.content], { type: 'text/plain' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = script.filename;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-all"
                                  >
                                    Download script ⬇️
                                  </button>
                                </div>
                                <pre className="text-slate-400 text-xs overflow-x-auto max-h-40 overflow-y-auto">
                                  {(aiSuggestions as { generatedScript: { content: string } }).generatedScript.content}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Details */}
                        {Object.keys(check.details).length > 0 && (
                          <details className="mt-3 sm:mt-4">
                            <summary className="text-slate-400 text-xs sm:text-sm cursor-pointer hover:text-slate-300">
                              ▶ View Details
                            </summary>
                            <pre className="mt-2 p-2 sm:p-3 bg-slate-950 rounded-lg text-[10px] sm:text-xs text-slate-400 overflow-x-auto max-h-48">
                              {JSON.stringify(check.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI Suggestion Modal */}
            {showAIModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-hidden">
                <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[80vh] overflow-hidden shadow-2xl">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-700 bg-gradient-to-r from-purple-900/50 to-pink-900/50">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl">🤖</span>
                      <div>
                        <h3 className="text-white font-semibold text-sm sm:text-base">AI Fix Suggestions</h3>
                        <p className="text-slate-400 text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none">{modalCheck?.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAIModal(false)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-all"
                    >
                      <XCircleIcon className="w-6 h-6 text-slate-400" />
                    </button>
                  </div>
                  
                  {/* Modal Body */}
                  <div className="p-3 sm:p-4 overflow-y-auto overflow-x-hidden max-h-[80vh] sm:max-h-[60vh]">
                    {loadingAI ? (
                      <div className="flex flex-col items-center py-8 sm:py-12">
                        <ArrowPathIcon className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400 animate-spin" />
                        <p className="mt-3 sm:mt-4 text-slate-400 text-sm sm:text-base">Analyzing issue...</p>
                      </div>
                    ) : aiSuggestions ? (
                      <div className="space-y-3 sm:space-y-4">
                        {/* OS Selector */}
                        <div className="flex items-center gap-2 p-2 sm:p-3 bg-slate-800 rounded-lg">
                          <span className="text-slate-400 text-xs sm:text-sm">Your system:</span>
                          <select
                            value={detectedOS}
                            onChange={(e) => setDetectedOS(e.target.value as 'windows' | 'macos' | 'linux')}
                            className="bg-slate-700 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-lg border border-slate-600"
                          >
                            <option value="windows">🪟 Windows</option>
                            <option value="macos">🍎 macOS</option>
                            <option value="linux">🐧 Linux</option>
                          </select>
                        </div>

                        {/* Analysis - Human readable summary */}
                        <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                          <h4 className="text-purple-300 text-xs sm:text-sm font-semibold mb-2 sm:mb-3">📊 Analysis Summary</h4>
                          
                          {/* Issue Summary */}
                          {/* Issue Summary */}
                          <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
                            {modalCheck?.status === 'critical' && (
                              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-900/30 rounded-lg border border-red-600/30">
                                <span className="text-red-400 text-base sm:text-lg">🔴</span>
                                <div>
                                  <p className="text-red-400 font-semibold text-xs sm:text-sm">Critical Issue</p>
                                  <p className="text-red-300/70 text-[10px] sm:text-xs">Needs immediate attention</p>
                                </div>
                              </div>
                            )}
                            {modalCheck?.status === 'warning' && (
                              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-amber-900/30 rounded-lg border border-amber-600/30">
                                <span className="text-amber-400 text-base sm:text-lg">🟡</span>
                                <div>
                                  <p className="text-amber-400 font-semibold text-xs sm:text-sm">Warning</p>
                                  <p className="text-amber-300/70 text-[10px] sm:text-xs">Should be addressed</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* What's wrong - plain language */}
                          <div className="mb-3 sm:mb-4 overflow-hidden">
                            <p className="text-slate-400 text-[10px] sm:text-xs font-semibold mb-1">What&apos;s wrong:</p>
                            <p className="text-white text-xs sm:text-sm break-words">{modalCheck?.message}</p>
                          </div>

                          {/* Key issues list */}
                          {modalCheck?.recommendations && modalCheck.recommendations.length > 0 && (
                            <div className="mb-3 sm:mb-4">
                              <p className="text-slate-400 text-[10px] sm:text-xs font-semibold mb-1.5 sm:mb-2">Issues found:</p>
                              <ul className="space-y-1 overflow-hidden">
                                {modalCheck.recommendations.slice(0, 5).map((rec, i) => (
                                  <li key={i} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0">
                                    <span className={`flex-shrink-0 ${rec.severity === 'critical' ? 'text-red-400' : rec.severity === 'high' ? 'text-amber-400' : 'text-slate-400'}`}>
                                      {rec.severity === 'critical' ? '🔴' : rec.severity === 'high' ? '🟡' : '🔵'}
                                    </span>
                                    <span className="text-slate-300 break-all">{rec.message.split(']').pop()?.trim() || rec.message}</span>
                                  </li>
                                ))}
                                {modalCheck.recommendations.length > 5 && (
                                  <li className="text-slate-500 text-[10px] sm:text-xs ml-5 sm:ml-6">...and {modalCheck.recommendations.length - 5} more</li>
                                )}
                              </ul>
                            </div>
                          )}

                          {/* Collapsible full details */}
                          <details className="mt-3">
                            <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">📄 See complete technical details</summary>
                            <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-slate-400 text-xs overflow-x-auto max-h-48 overflow-y-auto">
                              {(aiSuggestions as { analysis?: string }).analysis}
                            </pre>
                          </details>
                        </div>

                        {/* Disclaimer - shows once */}
                        {showDisclaimer && (
                          <div className="p-2.5 sm:p-4 bg-blue-900/30 rounded-lg border border-blue-600/30 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <span className="text-base sm:text-xl">📘</span>
                              <div>
                                <p className="text-blue-300 text-xs sm:text-sm font-semibold">Verify with official docs</p>
                                <p className="text-slate-400 text-[10px] sm:text-xs mt-0.5 sm:mt-1">AI suggestions. Double-check before running.</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowDisclaimer(false)}
                              className="text-slate-500 hover:text-slate-300 text-xs flex-shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {/* Suggested Fixes */}
                        {(aiSuggestions as { suggestedFixes?: Array<{ title: string; description: string; steps: string[]; commands?: string[]; warning?: string; risk?: string; docUrl?: string }> }).suggestedFixes?.map((fix, idx) => (
                          <div key={idx} className="p-2.5 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                              <div className="min-w-0">
                                <h4 className="text-white font-semibold text-sm sm:text-base">{fix.title}</h4>
                                <p className="text-slate-400 text-xs sm:text-sm">{fix.description}</p>
                              </div>
                              {fix.risk && (
                                <span className={`flex-shrink-0 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-lg ${
                                  fix.risk === 'high' ? 'bg-red-600/30 text-red-400 border border-red-600/30' :
                                  fix.risk === 'medium' ? 'bg-amber-600/30 text-amber-400 border border-amber-600/30' :
                                  'bg-green-600/30 text-green-400 border border-green-600/30'
                                }`}>
                                  {fix.risk}
                                </span>
                              )}
                            </div>
                            
                            {fix.warning && (
                              <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-amber-900/30 rounded-lg border border-amber-600/30">
                                <p className="text-amber-400 text-xs sm:text-sm">⚠️ {fix.warning}</p>
                              </div>
                            )}
                            
                            {/* Determine fix type and show appropriate label */}
                            {fix.commands && fix.commands.length > 0 ? (
                              /* Has commands - check if real terminal command or suggestion */
                              <div className="p-2 sm:p-3 bg-slate-950 rounded-lg mb-2 sm:mb-3 overflow-x-auto">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                  <p className="text-cyan-400 text-[10px] sm:text-xs font-semibold">
                                    {isRealCommand(fix.commands) ? '⚡ Quick command:' : '💡 Quick suggestion:'}
                                  </p>
                                  <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">🤖 AI</span>
                                </div>
                                {fix.commands.map((cmd, i) => (
                                  <code key={i} className={`block text-[11px] sm:text-sm font-mono select-all py-0.5 break-all ${isRealCommand(fix.commands) ? 'text-cyan-300' : 'text-slate-300'}`}>{cmd}</code>
                                ))}
                              </div>
                            ) : fix.steps && fix.steps.length > 0 ? (
                              /* No commands, has steps = Steps */
                              <div className="mb-2 sm:mb-3">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                  <p className="text-slate-300 text-[10px] sm:text-xs font-semibold">📋 Steps:</p>
                                  <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">🤖 AI</span>
                                </div>
                                <ol className="list-decimal list-inside space-y-1">
                                  {fix.steps.map((step, i) => (
                                    <li key={i} className="text-slate-400 text-xs sm:text-sm">{step}</li>
                                  ))}
                                </ol>
                              </div>
                            ) : null}

                            {/* Reference links - prioritize check-specific docs */}
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                              {/* Clawdbot/Moltbot specific */}
                              {modalCheck?.id === 'clawdbot' && (
                                <>
                                  <a href="https://docs.clawd.bot" target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold">📖 Docs</a>
                                  <a href="https://github.com/clawdbot/clawdbot" target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-cyan-400 hover:text-cyan-300 underline">💻 GitHub</a>
                                  <span className="text-[10px] sm:text-xs text-purple-400">💡 Ask Clawdbot!</span>
                                </>
                              )}
                              {/* OS-specific docs (secondary for Clawdbot) */}
                              {modalCheck?.id !== 'clawdbot' && (
                                <>
                                  {detectedOS === 'linux' && (
                                    <>
                                      <a href={`https://manpages.ubuntu.com/cgi-bin/search.py?q=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-blue-400 hover:text-blue-300 underline">📖 Ubuntu</a>
                                      <a href={`https://wiki.archlinux.org/index.php?search=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-blue-400 hover:text-blue-300 underline">📖 Arch</a>
                                    </>
                                  )}
                                  {detectedOS === 'windows' && (
                                    <a href={`https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-blue-400 hover:text-blue-300 underline">📖 Microsoft</a>
                                  )}
                                  {detectedOS === 'macos' && (
                                    <a href={`https://support.apple.com/en-us/search?q=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-blue-400 hover:text-blue-300 underline">📖 Apple</a>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Script */}
                        {(aiSuggestions as { generatedScript?: { content: string; filename: string } }).generatedScript && (
                          <div className="p-2.5 sm:p-4 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-lg border border-cyan-600/30">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                              <p className="text-cyan-400 text-[10px] sm:text-xs font-semibold">📜 Script:</p>
                              <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">🤖 AI</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-white font-semibold text-sm sm:text-base">Fix Script</h4>
                                <p className="text-slate-400 text-[10px] sm:text-sm">For {detectedOS === 'windows' ? '🪟 Win' : detectedOS === 'macos' ? '🍎 Mac' : '🐧 Linux'}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const script = (aiSuggestions as { generatedScript: { content: string; filename: string } }).generatedScript;
                                  downloadScript(script.content, script.filename);
                                }}
                                className="flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-medium rounded-lg transition-all"
                              >
                                Download script ⬇️
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 sm:py-12 text-slate-400">
                        <p className="text-sm sm:text-base">Failed to load suggestions. Try again.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 text-center text-slate-500 text-sm">
              Last scan: {new Date(results.timestamp).toLocaleString()}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-slate-400">
            <ShieldExclamationIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Failed to load security checks. Make sure the backend is running.</p>
            <button
              onClick={fetchSecurityChecks}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        )}
      </main>

      {/* Floating Refresh Button */}
      <button
        onClick={fetchSecurityChecks}
        disabled={loading}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full shadow-2xl shadow-cyan-500/30 transition-all duration-200 disabled:opacity-50 hover:scale-110 z-50"
        title="Refresh Security Scan"
      >
        <ArrowPathIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

