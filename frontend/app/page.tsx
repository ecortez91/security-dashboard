'use client';

import { useState, useEffect } from 'react';
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
      const response = await fetch('http://localhost:4000/api/checks');
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
      const response = await fetch(`http://localhost:4000/api/fixes/${fixId}`, {
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
      const response = await fetch('http://localhost:4000/api/ai-fix', {
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
                      className="w-full p-4 flex items-center gap-4 text-left cursor-pointer hover:bg-slate-700/30 transition-all rounded-t-xl"
                    >
                      <div className={`p-2 rounded-lg ${statusColors[check.status]}`}>
                        <StatusIcon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium">{check.name}</h3>
                          <span className="px-2 py-0.5 bg-slate-700/50 text-slate-400 text-xs rounded-full flex items-center gap-1">
                            <CategoryIcon className="w-3 h-3" />
                            {check.category}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm mt-1 truncate">{check.message}</p>
                      </div>

                      <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColors[check.status]}`}>
                        {check.status}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-700/50 pt-4">
                        <p className="text-slate-400 text-sm mb-4">{check.description}</p>
                        
                        {/* Recommendations */}
                        {check.recommendations.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                              <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                              Recommendations
                            </h4>
                            <ul className="space-y-2">
                              {check.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${
                                    rec.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                    rec.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                    rec.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-slate-500/20 text-slate-400'
                                  }`}>
                                    {rec.severity}
                                  </span>
                                  <span className="text-slate-300">{rec.message}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Available Fixes */}
                        {check.fixes.length > 0 && (
                          <div>
                            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                              <WrenchScrewdriverIcon className="w-4 h-4 text-cyan-500" />
                              Available Fixes
                            </h4>
                            <div className="space-y-2">
                              {check.fixes.map((fix) => (
                                <div 
                                  key={fix.id}
                                  className="p-3 bg-slate-900/50 rounded-lg"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-white text-sm font-medium">{fix.name}</p>
                                      <p className="text-slate-400 text-xs">{fix.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      {fix.script && (
                                        <a
                                          href={`http://localhost:4000/scripts/linux/${fix.script}.sh`}
                                          download
                                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all whitespace-nowrap"
                                        >
                                          📥
                                        </a>
                                      )}
                                      {fix.autoFix ? (
                                        <button
                                          onClick={() => applyFix(fix.id)}
                                          disabled={applyingFix === fix.id}
                                          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
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
                                        <span className="px-4 py-2 bg-amber-600/20 text-amber-400 text-sm font-medium rounded-lg border border-amber-600/30 whitespace-nowrap">
                                          Manual Fix
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Manual Steps */}
                                  {fix.manualSteps && fix.manualSteps.length > 0 && (
                                    <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-700">
                                      <p className="text-slate-300 text-xs font-semibold mb-2">📋 Manual Steps:</p>
                                      <ol className="list-decimal list-inside space-y-1">
                                        {fix.manualSteps.map((step, idx) => (
                                          <li key={idx} className="text-slate-400 text-xs">
                                            {step.startsWith('Run:') ? (
                                              <>
                                                Run: <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-400">{step.replace('Run: ', '')}</code>
                                              </>
                                            ) : (
                                              step
                                            )}
                                          </li>
                                        ))}
                                      </ol>
                                      {fix.command && (
                                        <div className="mt-2 pt-2 border-t border-slate-700">
                                          <p className="text-slate-500 text-xs">Quick command:</p>
                                          <code className="block mt-1 p-2 bg-slate-800 rounded text-cyan-400 text-xs select-all">
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
                          <div className="mt-4">
                            <button
                              onClick={() => getAISuggestions(check)}
                              disabled={loadingAI === check.id}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
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
                                    📥 Download Script
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
                          <details className="mt-4">
                            <summary className="text-slate-400 text-sm cursor-pointer hover:text-slate-300">
                              View Details
                            </summary>
                            <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-xs text-slate-400 overflow-x-auto">
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
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-purple-900/50 to-pink-900/50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🤖</span>
                      <div>
                        <h3 className="text-white font-semibold">AI Fix Suggestions</h3>
                        <p className="text-slate-400 text-sm">{modalCheck?.name}</p>
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
                  <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {loadingAI ? (
                      <div className="flex flex-col items-center py-12">
                        <ArrowPathIcon className="w-12 h-12 text-purple-400 animate-spin" />
                        <p className="mt-4 text-slate-400">Analyzing issue & searching for solutions...</p>
                      </div>
                    ) : aiSuggestions ? (
                      <div className="space-y-4">
                        {/* OS Selector */}
                        <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg">
                          <span className="text-slate-400 text-sm">Your system:</span>
                          <select
                            value={detectedOS}
                            onChange={(e) => setDetectedOS(e.target.value as 'windows' | 'macos' | 'linux')}
                            className="bg-slate-700 text-white text-sm px-3 py-1 rounded-lg border border-slate-600"
                          >
                            <option value="windows">🪟 Windows</option>
                            <option value="macos">🍎 macOS</option>
                            <option value="linux">🐧 Linux</option>
                          </select>
                        </div>

                        {/* Analysis */}
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                          <h4 className="text-purple-300 text-sm font-semibold mb-2">📊 Analysis</h4>
                          <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono">
                            {(aiSuggestions as { analysis?: string }).analysis}
                          </pre>
                        </div>

                        {/* Disclaimer - shows once */}
                        {showDisclaimer && (
                          <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-600/30 flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <span className="text-xl">📘</span>
                              <div>
                                <p className="text-blue-300 text-sm font-semibold">Always verify with official documentation</p>
                                <p className="text-slate-400 text-xs mt-1">These are AI suggestions. Double-check commands before running them on your system.</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowDisclaimer(false)}
                              className="text-slate-500 hover:text-slate-300 text-xs"
                            >
                              ✕ Got it
                            </button>
                          </div>
                        )}

                        {/* Suggested Fixes */}
                        {(aiSuggestions as { suggestedFixes?: Array<{ title: string; description: string; steps: string[]; commands?: string[]; warning?: string; risk?: string; docUrl?: string }> }).suggestedFixes?.map((fix, idx) => (
                          <div key={idx} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="text-white font-semibold">{fix.title}</h4>
                                <p className="text-slate-400 text-sm">{fix.description}</p>
                              </div>
                              {fix.risk && (
                                <span className={`px-2 py-1 text-xs rounded-lg ${
                                  fix.risk === 'high' ? 'bg-red-600/30 text-red-400 border border-red-600/30' :
                                  fix.risk === 'medium' ? 'bg-amber-600/30 text-amber-400 border border-amber-600/30' :
                                  'bg-green-600/30 text-green-400 border border-green-600/30'
                                }`}>
                                  {fix.risk} risk
                                </span>
                              )}
                            </div>
                            
                            {fix.warning && (
                              <div className="mb-3 p-3 bg-amber-900/30 rounded-lg border border-amber-600/30">
                                <p className="text-amber-400 text-sm">⚠️ {fix.warning}</p>
                              </div>
                            )}
                            
                            {/* Determine fix type and show appropriate label */}
                            {fix.commands && fix.commands.length > 0 ? (
                              /* Has commands = Quick Command */
                              <div className="p-3 bg-slate-950 rounded-lg mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="text-cyan-400 text-xs font-semibold">⚡ Quick Command:</p>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">🤖 AI Generated</span>
                                </div>
                                {fix.commands.map((cmd, i) => (
                                  <code key={i} className="block text-cyan-300 text-sm font-mono select-all py-0.5">{cmd}</code>
                                ))}
                              </div>
                            ) : fix.steps && fix.steps.length > 0 ? (
                              /* No commands, has steps = Steps */
                              <div className="mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="text-slate-300 text-xs font-semibold">📋 Steps:</p>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">🤖 AI Generated</span>
                                </div>
                                <ol className="list-decimal list-inside space-y-1">
                                  {fix.steps.map((step, i) => (
                                    <li key={i} className="text-slate-400 text-sm">{step}</li>
                                  ))}
                                </ol>
                              </div>
                            ) : null}

                            {/* Reference links - prioritize check-specific docs */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {/* Clawdbot/Moltbot specific */}
                              {modalCheck?.id === 'clawdbot' && (
                                <>
                                  <a href="https://docs.clawd.bot" target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold">📖 Clawdbot Docs</a>
                                  <a href="https://github.com/clawdbot/clawdbot" target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 underline">💻 GitHub</a>
                                  <span className="text-xs text-purple-400">💡 Tip: Ask Clawdbot to fix this for you!</span>
                                </>
                              )}
                              {/* OS-specific docs (secondary for Clawdbot) */}
                              {modalCheck?.id !== 'clawdbot' && (
                                <>
                                  {detectedOS === 'linux' && (
                                    <>
                                      <a href={`https://manpages.ubuntu.com/cgi-bin/search.py?q=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">📖 Ubuntu Docs</a>
                                      <a href={`https://wiki.archlinux.org/index.php?search=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">📖 Arch Wiki</a>
                                    </>
                                  )}
                                  {detectedOS === 'windows' && (
                                    <a href={`https://learn.microsoft.com/en-us/search/?terms=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">📖 Microsoft Docs</a>
                                  )}
                                  {detectedOS === 'macos' && (
                                    <a href={`https://support.apple.com/en-us/search?q=${encodeURIComponent(fix.title)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">📖 Apple Support</a>
                                  )}
                                </>
                              )}
                              <a href={`https://www.google.com/search?q=${encodeURIComponent(fix.title + ' ' + detectedOS + ' official documentation')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-400 underline">🔍 Search more</a>
                            </div>
                          </div>
                        ))}

                        {/* Script */}
                        {(aiSuggestions as { generatedScript?: { content: string; filename: string } }).generatedScript && (
                          <div className="p-4 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-lg border border-cyan-600/30">
                            <div className="flex items-center gap-2 mb-3">
                              <p className="text-cyan-400 text-xs font-semibold">📜 Script:</p>
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">🤖 AI Generated</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-white font-semibold">Automated Fix Script</h4>
                                <p className="text-slate-400 text-sm">Ready to run on {detectedOS === 'windows' ? '🪟 Windows' : detectedOS === 'macos' ? '🍎 macOS' : '🐧 Linux'}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const script = (aiSuggestions as { generatedScript: { content: string; filename: string } }).generatedScript;
                                  downloadScript(script.content, script.filename);
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                              >
                                📥 Download
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <p>Failed to load suggestions. Try again.</p>
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

