import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import React, { useState, useEffect, useRef, Component, useMemo } from 'react'
import io from 'socket.io-client'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Settings, Play, Database, FileJson, Terminal, Activity, ShieldAlert, Copy, SplitSquareHorizontal, LayoutDashboard, MessageSquare, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, DollarSign, HelpCircle, Moon, Sun, Book, FileText, Lock, AlertTriangle, Cpu, Filter, Plug, Shield, X, Info, Plus, Trash, Maximize2, Download } from 'lucide-react'
import Dashboard from './Dashboard'
import MermaidRenderer from './components/MermaidRenderer';
import TerminalLogViewer from './components/TerminalLogViewer';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import Draggable from 'react-draggable'
import MonacoEditor from '@monaco-editor/react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  
  componentDidCatch(error, errorInfo) {
    // Intercept React render crashes for Playwright tests
    window.__REACT_RENDER_ERRORS__ = window.__REACT_RENDER_ERRORS__ || [];
    window.__REACT_RENDER_ERRORS__.push({
      message: error.message,
      componentStack: errorInfo.componentStack
    });
    window.dispatchEvent(new CustomEvent('react-render-error', { 
      detail: { message: error.message }
    }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center text-slate-800">
          <div className="bg-white p-8 rounded-3xl border border-red-200 shadow-2xl text-center max-w-md">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">System Error</h2>
            <p className="text-slate-500 mb-6">{this.state.error.message || "An unexpected error occurred."}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors">
              Recover
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}




function LoginScreen({ onLogin }) {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.apiKey);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch(err) {
      setError('Connection failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
      <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-700">
        <h1 className="text-2xl font-bold text-emerald-400 mb-6 text-center">StructZero v8.0</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-slate-400 text-sm font-bold mb-1 block">API Key</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 outline-none focus:border-emerald-500"
              placeholder="Enter Access Key..."
            />
          </div>
          {error && <span className="text-red-500 text-sm font-bold">{error}</span>}
          <button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition-colors">
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TestingDashboard({ apiKey }) {
  const [targetUrl, setTargetUrl] = React.useState('http://localhost:5173');
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const runTest = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('http://localhost:3001/api/tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ targetUrl })
      });
      const data = await res.json();
      setResult(data);
    } catch(e) {
      setResult({ success: false, error: e.message });
    }
    setRunning(false);
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
       <div className="flex items-center justify-between mb-8">
         <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight mb-2">MCP Testing Engine</h1>
            <p className="text-[var(--text-secondary)] text-lg">AI-driven E2E Playwright verification</p>
         </div>
       </div>
       <div className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-color)]">
          <div className="flex gap-4">
             <input type="text" value={targetUrl} onChange={e=>setTargetUrl(e.target.value)} className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 text-[var(--text-primary)]" placeholder="Enter Target URL to Test..." />
             <button onClick={runTest} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center min-w-[200px]">
               {running ? 'Running Playwright...' : 'Run E2E Test'}
             </button>
          </div>
          {result && (
             <div className="mt-8">
               <h3 className={`text-xl font-bold flex items-center gap-2 ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                 {result.success ? <CheckCircle2 className="w-6 h-6"/> : <ShieldAlert className="w-6 h-6"/>}
                 {result.success ? 'E2E Validation Passed' : 'E2E Validation Failed'}
               </h3>
               {result.result?.message && (
                 <p className="text-[var(--text-secondary)] mt-2 font-medium">{result.result.message}</p>
               )}
               <div className="bg-slate-950 p-4 rounded-xl mt-4 font-mono text-sm text-slate-300 whitespace-pre-wrap overflow-auto max-h-96 border border-slate-800">
                  {result.rawLogs || result.error || JSON.stringify(result, null, 2)}
               </div>
             </div>
          )}
       </div>
    </div>
  )
}

const explainRule = (text) => {
  const lower = (text || '').toLowerCase();
  if (lower.includes('maintainability') || lower.includes('cleverness')) {
    return 'Favors simple, readable, and maintainable code over complex tricks.';
  }
  if (lower.includes('justify') || lower.includes('trade-off')) {
    return 'Forces the AI to document the trade-offs of design decisions and explain alternatives.';
  }
  if (lower.includes('assumptions')) {
    return 'Ensures project unknowns and scaling requirements are stated transparently.';
  }
  if (lower.includes('solo developer') || lower.includes('ops team')) {
    return 'Limits architecture designs to patterns a single developer can easily manage and operate.';
  }
  if (lower.includes('credential') || lower.includes('api key') || lower.includes('secret')) {
    return 'Enforces secret safety, banning plain-text keys in codes or docs.';
  }
  if (lower.includes('first principles') || lower.includes('ambiguous')) {
    return 'Encourages solution designs based on concrete requirements rather than guesses.';
  }
  if (lower.includes('monolith') || lower.includes('microservices')) {
    return 'Prevents premature scaling into complex multi-service architectures.';
  }
  if (lower.includes('data models') || lower.includes('api contracts')) {
    return 'Requires interfaces, contracts, and database schemas to be defined first.';
  }
  if (lower.includes('failure mode')) {
    return 'Demands resilience planning, explaining what happens if this component crashes.';
  }
  if (lower.includes('boilerplate')) {
    return 'Restricts code outputs to high-level architecture designs rather than implementation details.';
  }
  if (lower.includes('wrong') || lower.includes('traffic')) {
    return 'Audits proposed designs assuming hostile networks, failures, and heavy traffic.';
  }
  if (lower.includes('race') || lower.includes('failure-states') || lower.includes('idempotency')) {
    return 'Validates concurrent routines, duplicate actions, and state consistency.';
  }
  if (lower.includes('severity') || lower.includes('must-fix')) {
    return 'Categorizes findings clearly, separating must-fixes from general ideas.';
  }
  if (lower.includes('conflict') || lower.includes('critique')) {
    return 'Resolves conflicting feedback between architect drafts and critic reviews.';
  }
  if (lower.includes('solid') || lower.includes('dry')) {
    return 'Enforces SOLID coding principles and decouples redundant components.';
  }
  if (lower.includes('mermaid')) {
    return 'Guarantees the visual Mermaid flowchart aligns with the text description.';
  }
  return 'Guides model behavior and defines quality checks.';
};

function VulnerabilityCard({ vuln, theme }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSeverityStyles = (severity, currentTheme) => {
    const s = severity?.toLowerCase();
    const isDark = currentTheme === 'dark';

    if (s === 'critical') return {
      badge: isDark 
        ? 'bg-purple-950/40 text-purple-400 border border-purple-800/60 shadow-sm shadow-purple-950/50' 
        : 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm',
      card: isDark 
        ? 'border border-purple-900/40 bg-purple-950/5 shadow-sm shadow-purple-900/5 hover:border-purple-600/60' 
        : 'border border-purple-200 bg-purple-50/20 hover:border-purple-400 shadow-sm shadow-purple-100/50'
    };
    if (s === 'high') return {
      badge: isDark 
        ? 'bg-red-950/40 text-red-400 border border-red-800/60 shadow-sm shadow-red-950/50' 
        : 'bg-red-50 text-red-700 border border-red-200 shadow-sm',
      card: isDark 
        ? 'border border-red-900/40 bg-red-950/5 shadow-sm shadow-red-900/5 hover:border-red-600/60' 
        : 'border border-red-200 bg-red-50/20 hover:border-red-400 shadow-sm shadow-red-100/50'
    };
    if (s === 'medium') return {
      badge: isDark 
        ? 'bg-amber-950/40 text-amber-400 border border-amber-800/60 shadow-sm shadow-amber-950/50' 
        : 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm',
      card: isDark 
        ? 'border border-amber-900/30 bg-amber-950/5 hover:border-amber-500/50' 
        : 'border border-amber-200 bg-amber-50/10 hover:border-amber-400'
    };
    return {
      badge: isDark 
        ? 'bg-blue-950/40 text-blue-400 border border-blue-800/60 shadow-sm shadow-blue-950/50' 
        : 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm',
      card: 'border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-gray-500'
    };
  };

  const hasCodePatch = vuln.originalCode || vuln.correctedCode;
  const styles = getSeverityStyles(vuln.severity, theme);

  return (
    <div className={`p-6 rounded-3xl transition-all duration-300 flex flex-col gap-4 ${styles.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles.badge}`}>
            {vuln.severity || 'Low'}
          </span>
          <h4 className="font-bold text-[var(--text-primary)] text-lg leading-snug">{vuln.type}</h4>
        </div>
        {hasCodePatch && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-input)] transition-all shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
            {isExpanded ? 'Hide Patch' : 'Compare Code'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {vuln.location && (
          <p className="text-xs font-mono text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">Location:</span> {vuln.location}
          </p>
        )}
        <p className="text-[var(--text-secondary)] text-sm whitespace-pre-wrap leading-relaxed">
          {vuln.description || vuln.message}
        </p>
        {vuln.correction && (
          <div className="bg-[var(--bg-input)]/70 p-4 rounded-2xl border border-[var(--border-color)]">
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              How to Correct:
            </span>
            <p className="text-[var(--text-primary)] text-sm whitespace-pre-wrap leading-relaxed font-medium">
              {vuln.correction}
            </p>
          </div>
        )}
      </div>

      {hasCodePatch && isExpanded && (
        <div className="mt-2 border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-md animate-fade-in">
          <div className="bg-[var(--bg-input)] px-4 py-2 border-b border-[var(--border-color)] flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
            <span>Remediation Patch Comparison</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border-color)] font-mono text-xs">
            <div className={`${theme === 'dark' ? 'bg-red-950/10' : 'bg-red-50/40'} p-4`}>
              <div className="text-red-500 font-bold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                INSECURE CODE
              </div>
              <pre className={`overflow-x-auto whitespace-pre scrollbar-thin ${theme === 'dark' ? 'text-red-200' : 'text-red-800'}`}>
                {vuln.originalCode || '// No code block provided'}
              </pre>
            </div>
            <div className={`${theme === 'dark' ? 'bg-emerald-950/10' : 'bg-emerald-50/40'} p-4`}>
              <div className="text-emerald-600 font-bold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                SECURE CORRECTION
              </div>
              <pre className={`overflow-x-auto whitespace-pre scrollbar-thin ${theme === 'dark' ? 'text-emerald-200' : 'text-emerald-800'}`}>
                {vuln.correctedCode || '// No code block provided'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityScannerLoader() {
  const [step, setStep] = useState(0);
  const steps = [
    "Initializing SAST Security Engine...",
    "Retrieving active blueprint layout...",
    "Parsing system modules and microservices...",
    "Auditing REST controllers for missing authorization...",
    "Analyzing database schemas for SQL Injection vulnerability...",
    "Evaluating Cross-Site Scripting (XSS) attack vectors...",
    "Verifying API gateway CORS configurations...",
    "Checking transport layer encryption settings...",
    "Aggregating vulnerability records...",
    "Claude Sonnet generating remediation patches..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden p-12 rounded-3xl border border-red-900/30 bg-red-950/5 max-w-2xl mx-auto shadow-xl my-12 flex flex-col items-center justify-center min-h-[350px]">
      {/* Laser Sweep Line */}
      <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_12px_#ef4444] animate-[laser-sweep_3s_linear_infinite]" />

      <style>{`
        @keyframes radar-pulse {
          0% { transform: scale(0.6); opacity: 0.8; }
          50% { opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes laser-sweep {
          0% { top: 0%; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>

      {/* Out-of-space Sonar scan */}
      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
        <div className="absolute inset-0 rounded-full border border-red-500/30 animate-[radar-pulse_3s_linear_infinite]" style={{ animationDelay: '0s' }} />
        <div className="absolute inset-0 rounded-full border border-red-500/20 animate-[radar-pulse_3s_linear_infinite]" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 rounded-full border border-red-500/10 animate-[radar-pulse_3s_linear_infinite]" style={{ animationDelay: '2s' }} />
        
        {/* Core Shield */}
        <div className="w-16 h-16 rounded-full bg-red-950/30 border border-red-500/40 flex items-center justify-center z-10 shadow-lg shadow-red-900/20 animate-pulse">
          <Shield className="w-8 h-8 text-red-500" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wide">Security Audit In Progress</h3>
      
      {/* Stepper Log */}
      <div className="h-6 flex items-center justify-center mb-6">
        <p className="text-red-400 font-mono text-sm tracking-wide animate-pulse">
          &gt;_ {steps[step]}
        </p>
      </div>

      {/* Infinite Cyber Scan Track */}
      <div className="w-72 bg-red-950/40 border border-red-900/30 h-1 rounded-full overflow-hidden relative shadow-inner">
        <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-[loading-slide_2s_linear_infinite]" />
      </div>
    </div>
  );
}

function AppContent({ apiKey }) {

  const fetchWithAuth = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'x-api-key': apiKey,
    };
    if (!options.headers || !options.headers['Content-Type']) {
       if (options.method === 'POST' || options.method === 'PUT') {
           headers['Content-Type'] = 'application/json';
       }
    }
    return fetch(url, { ...options, headers });
  };

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'architect') 
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [showFullscreenDiagram, setShowFullscreenDiagram] = useState(false)
  const [pastedImages, setPastedImages] = useState([])
  
  const [prompt, setPrompt] = useState('')
  const [leanMode, setLeanMode] = useState(false)
  const [uiStyles, setUiStyles] = useState(() => {
    try {
      const stored = localStorage.getItem('uiStyles');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })
  const [useA11y, setUseA11y] = useState(() => localStorage.getItem('useA11y') === 'true')
  const [zeroBloat, setZeroBloat] = useState(() => localStorage.getItem('zeroBloat') === 'true')
  const [androidOffline, setAndroidOffline] = useState(() => localStorage.getItem('androidOffline') === 'true')

  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('uiStyles', JSON.stringify(uiStyles));
    localStorage.setItem('useA11y', useA11y);
    localStorage.setItem('zeroBloat', zeroBloat);
    localStorage.setItem('androidOffline', androidOffline);
    localStorage.setItem('activeTab', activeTab);
  }, [theme, uiStyles, useA11y, zeroBloat, androidOffline, activeTab]);
  const [chatInput, setChatInput] = useState('')
  
  const [geminiKey, setGeminiKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [activeProvider, setActiveProvider] = useState('Gemini')
  const [modelConstraints, setModelConstraints] = useState({ Global: '', Architect: '', Reviewer: '', Compiler: '' })
  const [activeUser, setActiveUser] = useState('global')
  const [userProfiles, setUserProfiles] = useState({ global: '' })
  const [editingProfileUser, setEditingProfileUser] = useState('global')
  const [newProfileName, setNewProfileName] = useState('')
  const [activeConstraintDrawer, setActiveConstraintDrawer] = useState(null);
  const [tempRules, setTempRules] = useState([]);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);
  const [knowledgeSources, setKnowledgeSources] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [enableGoogleSearch, setEnableGoogleSearch] = useState(false);
  const [projectName, setProjectName] = useState('Workspace');

  useEffect(() => {
    setPendingDeleteIndex(null);
    if (activeConstraintDrawer) {
      const raw = modelConstraints[activeConstraintDrawer] || '';
      let lines = raw.split('\n').filter(line => line.trim() !== '');
      if (lines.length === 1 && lines[0].includes('. ')) {
        lines = lines[0].split(/\.\s+/).map(s => {
          let trimmed = s.trim();
          if (!trimmed) return '';
          return trimmed.endsWith('.') ? trimmed : trimmed + '.';
        }).filter(Boolean);
      }
      setTempRules(lines.length > 0 ? lines : ['']);
    } else {
      setTempRules([]);
    }
  }, [activeConstraintDrawer, modelConstraints]);

  // Plugin Generation State
  const [pluginPrompt, setPluginPrompt] = useState('');
  const [isGeneratingPlugin, setIsGeneratingPlugin] = useState(false);
  const [pluginsList, setPluginsList] = useState([]);
  const [selectedPluginCode, setSelectedPluginCode] = useState(null);
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [appStatus, setAppStatus] = useState('normal') 

  const generateAggregatedReport = (audit) => {
    if (!audit || !audit.vulnerabilities) return '';
    return `# Security Audit Report: ${projectName || 'Project'}
**Date:** ${new Date(audit.timestamp).toLocaleString()}
**Status:** ${audit.passed ? 'SECURE' : 'VULNERABILITIES DETECTED'}

---

${audit.vulnerabilities.map((vuln, idx) => `
## ${idx + 1}. [${vuln.severity}] ${vuln.type}
* **Location:** ${vuln.location || 'N/A'}
* **Description:** ${vuln.description || vuln.message}
* **How to Correct:** ${vuln.correction || 'N/A'}

${vuln.originalCode ? `### Insecure Code
\`\`\`javascript
${vuln.originalCode}
\`\`\`

### Corrected Code
\`\`\`javascript
${vuln.correctedCode}
\`\`\`
` : ''}
`).join('\n\n')}
`;
  };

  const downloadAllPatches = () => {
    const content = generateAggregatedReport(securityAudit);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sast_security_report_${(projectName || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded security report!");
  };

  const copyAllPatches = () => {
    const content = generateAggregatedReport(securityAudit);
    navigator.clipboard.writeText(content);
    showToast("Security report copied!");
  };

  const handleStartScan = async () => {
    setSastLoading(true);
    showToast('Running SAST Scan...');
    try {
       const res = await fetchWithAuth('http://localhost:3001/api/security/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
             codeSnippet: currentArch || "No architecture generated yet.",
             projectName: projectName || "Unknown"
          })
       });
       const data = await res.json();
       if (data.scanResult) {
          setSecurityAudit({
             passed: data.scanResult.passed,
             timestamp: Date.now(),
             vulnerabilities: data.scanResult.vulnerabilities || []
          });
          showToast('SAST Scan Complete');
       } else if (data.error) {
          showToast(data.error);
       }
    } catch(e) {
       showToast('Scan Failed');
    } finally {
       setSastLoading(false);
    }
  };

  const applySecurityFixes = () => {
    if (!securityAudit || !securityAudit.vulnerabilities || securityAudit.vulnerabilities.length === 0) return;
    
    let fixPrompt = "Optimize and refine the architecture to fix the following security vulnerabilities identified in the audit:\n\n";
    securityAudit.vulnerabilities.forEach((vuln, i) => {
      fixPrompt += `${i + 1}. [${vuln.severity}] ${vuln.type} in ${vuln.location || 'system'}:\n`;
      fixPrompt += `   Issue: ${vuln.description || vuln.message}\n`;
      fixPrompt += `   Correction: ${vuln.correction}\n\n`;
    });
    fixPrompt += "Please apply all the above security corrections and regenerate the updated secure architecture.";
    
    setActiveTab('architect');
    executeGeneration(fixPrompt, true);
  };
  
  // Version Tree State
  const [versionTree, setVersionTree] = useState(() => {
    try {
      const stored = localStorage.getItem('versionTree');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })
  const [currentVersionIndex, setCurrentVersionIndex] = useState(() => {
    try {
      const stored = localStorage.getItem('currentVersionIndex');
      return stored ? parseInt(stored) : -1;
    } catch {
      return -1;
    }
  })

  useEffect(() => {
    localStorage.setItem('versionTree', JSON.stringify(versionTree));
    localStorage.setItem('currentVersionIndex', currentVersionIndex.toString());
  }, [versionTree, currentVersionIndex]);

  const currentArch = versionTree.length > 0 && currentVersionIndex >= 0 ? versionTree[currentVersionIndex] : null;
  const [lastPrompt, setLastPrompt] = useState(null)
  
  const [securityAudit, setSecurityAudit] = useState(null)
  const [sastLoading, setSastLoading] = useState(false)
  const [adkResult, setAdkResult] = useState(null)
  const [adkLoading, setAdkLoading] = useState(false)
  const [diffSummary, setDiffSummary] = useState(null)
  const [buildEstimate, setBuildEstimate] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  
  const [memories, setMemories] = useState([])
  const [skills, setSkills] = useState([])
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [selectedMemory, setSelectedMemory] = useState(null)
  const [memoryFilterUser, setMemoryFilterUser] = useState('All')
  
  const [billingData, setBillingData] = useState([])
  const [billingStartDate, setBillingStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 30);
    return today.toISOString().split('T')[0];
  })
  const [billingEndDate, setBillingEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  })
  const [appliedStartDate, setAppliedStartDate] = useState(billingStartDate)
  const [appliedEndDate, setAppliedEndDate] = useState(billingEndDate)
  
  const [terminalLogs, setTerminalLogs] = useState(['> StructZero MCP Link Established...'])
  
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    const socket = io('http://localhost:3001');
    socket.on('status', (data) => {
      setTerminalLogs(prev => [...prev, `> ${data.message}`].slice(-20));
    });
    socket.on('architecture_update', (data) => {
      if (data.architecture) {
        setVersionTree(prev => {
          if (prev.length > 0 && prev[prev.length - 1] === data.architecture) return prev;
          const newTree = [...prev, data.architecture];
          setCurrentVersionIndex(newTree.length - 1);
          return newTree;
        });
        if (data.securityAudit) setSecurityAudit(data.securityAudit);
        if (data.projectName) setProjectName(data.projectName);
        if (data.diffSummary) setDiffSummary(data.diffSummary);
        setTimeout(() => {
          fetchEstimate(data.architecture);
        }, 100);
        showToast("Architecture updated from IDE!");
      }
    });
    socket.on('architecture_cleared', (data) => {
      setVersionTree([]);
      setCurrentVersionIndex(-1);
      setProjectName('');
      setSecurityAudit(null);
      setAdkResult(null);
      setBuildEstimate(null);
      setDiffSummary(null);
      localStorage.removeItem('versionTree');
      localStorage.removeItem('currentVersionIndex');
      showToast("Workspace cleared — ready for new blueprint!");
    });
    socket.on('adk_result', (data) => {
      setAdkResult(data);
      showToast(`ADK Production Check: ${data.score}/100 ${data.ready ? '✅ Ready' : '⚠️ Needs Work'}`);
    });
    return () => socket.disconnect();
  }, []);

  const [selectedSkillTag, setSelectedSkillTag] = useState('All')

  useEffect(() => { 
    fetchSettings();
    fetchCurrentArchitecture();
  }, []);
  useEffect(() => {
    if (activeTab === 'memory') fetchMemories()
    if (activeTab === 'skills') fetchSkills()
  }, [activeTab])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchSettings = async () => {
    try {
      const res = await fetchWithAuth('http://localhost:3001/api/settings')
      const data = await res.json()
      if (data.geminiKey) setGeminiKey(data.geminiKey)
      if (data.claudeKey) setClaudeKey(data.claudeKey)
      if (data.deepseekKey) setDeepseekKey(data.deepseekKey)
      if (data.ollamaUrl) setOllamaUrl(data.ollamaUrl)
      if (data.activeProvider) setActiveProvider(data.activeProvider)
      if (data.userProfiles) setUserProfiles(data.userProfiles)
      if (data.activeUser) setActiveUser(data.activeUser)
      if (data.knowledgeSources) setKnowledgeSources(data.knowledgeSources)
      if (data.enableGoogleSearch !== undefined) setEnableGoogleSearch(data.enableGoogleSearch)
      if (data.modelConstraints) {
        try {
          const parsed = typeof data.modelConstraints === 'string'
            ? JSON.parse(data.modelConstraints)
            : data.modelConstraints;
          setModelConstraints(parsed);
        } catch(e) {
          console.error("Failed to parse modelConstraints", e);
        }
      }
    } catch (e) {
      console.error("Settings load error:", e)
    }
  }

  const fetchCurrentArchitecture = async () => {
    try {
      const res = await fetchWithAuth('http://localhost:3001/api/architecture');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.architecture) {
          setVersionTree([data.architecture]);
          setCurrentVersionIndex(0);
          setProjectName(data.projectName || 'Unknown');
          if (data.securityAudit) setSecurityAudit(data.securityAudit);
          setTimeout(() => {
            fetchEstimate(data.architecture);
          }, 100);
        }
      }
    } catch (e) {
      console.error("Failed to fetch initial architecture", e);
    }
  };

  const saveApiConfig = async () => {
    try {
      await fetchWithAuth('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey, claudeKey, deepseekKey, ollamaUrl, activeProvider, modelConstraints: JSON.stringify(modelConstraints), knowledgeSources, enableGoogleSearch })
      })
      showToast("API Configuration saved successfully!")
    } catch (e) { setError("Failed to save API Configuration") }
  }

  const saveProfiles = async () => {
    try {
      await fetchWithAuth('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userProfiles })
      })
      showToast("User Profiles saved successfully!")
    } catch (e) { setError("Failed to save User Profiles") }
  }

  const fetchMemories = async () => {
    try {
      const res = await fetchWithAuth('http://localhost:3001/api/memory')
      const data = await res.json()
      setMemories(Array.isArray(data) ? data : [])
    } catch (e) { 
      console.error(e)
      setMemories([])
    }
  }

  const fetchSkills = async () => {
    try {
      const res = await fetchWithAuth('http://localhost:3001/api/skills')
      const data = await res.json()
      setSkills(Array.isArray(data) ? data : [])
    } catch (e) { 
      console.error(e)
      setSkills([])
    }
  }

  const fetchBilling = async () => {
    // MOCK FOR DEMO VIDEO
    if (localStorage.getItem('ide_api_key') === 'test-key') {
      const today = new Date().toISOString().split('T')[0];
      setBillingData([
        { model: 'gemini-1.5-pro', latency: 450, total_tokens: 3450, cost: 0.0431, created_at: today },
        { model: 'claude-3-opus', latency: 890, total_tokens: 4120, cost: 0.0618, created_at: today },
        { model: 'gemini-1.5-pro', latency: 320, total_tokens: 1250, cost: 0.0156, created_at: today },
        { model: 'claude-3-sonnet', latency: 510, total_tokens: 2100, cost: 0.0063, created_at: today }
      ]);
      return;
    }

    try {
      const res = await fetchWithAuth('http://localhost:3001/api/observability/metrics');
      const data = await res.json();
      if (Array.isArray(data)) {
        const filtered = data.filter(m => {
           const d = new Date(m.created_at).toISOString().split('T')[0];
           return d >= billingStartDate && d <= billingEndDate;
        });
        setBillingData(filtered);
      } else {
        setBillingData([]);
      }
    } catch(e) {
      setBillingData([]);
    }
  }
  
  useEffect(() => {
    if (activeTab === 'billing') fetchBilling();
  }, [activeTab, billingStartDate, billingEndDate]);

  const handleCopy = () => {
    const arch = versionTree[currentVersionIndex];
    if (arch) {
      navigator.clipboard.writeText(arch);
      showToast("Architecture copied to clipboard!");
    }
  }

  const handleDownload = () => {
    const arch = versionTree[currentVersionIndex];
    if (arch) {
      const element = document.createElement("a");
      const file = new Blob([arch], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `architecture_v${currentVersionIndex + 1}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      showToast("Markdown downloaded successfully!");
    }
  }

  const handleNewBlueprint = async () => {
    if (versionTree.length > 0) {
      const confirmed = window.confirm(
        "Start a new blueprint?\n\nThis will clear the current workspace for all connected IDEs and the dashboard. Your saved blueprints in the Skills Library are safe."
      );
      if (!confirmed) return;
    }
    try {
      await fetchWithAuth('http://localhost:3001/api/architecture', { method: 'DELETE' });
      // Local state is cleared by the 'architecture_cleared' socket event broadcast from the server
    } catch (e) {
      // Clear locally even if server call fails
      setVersionTree([]);
      setCurrentVersionIndex(-1);
      setProjectName('');
      setSecurityAudit(null);
      setBuildEstimate(null);
      setDiffSummary(null);
      localStorage.removeItem('versionTree');
      localStorage.removeItem('currentVersionIndex');
      showToast("Workspace cleared locally.");
    }
  }

  const handleAutoSave = async (archContent) => {
    if (!archContent) return;
    try {
      const generatedName = `${projectName || 'Architecture'} Blueprint v${versionTree.length + 1}`;
      const cleanPrompt = lastPrompt ? (lastPrompt.length > 70 ? lastPrompt.substring(0, 70) + '...' : lastPrompt) : 'Custom refinement';
      const generatedDesc = `Auto-saved version. Prompt: "${cleanPrompt}"`;

      await fetchWithAuth('http://localhost:3001/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: generatedName, 
          description: generatedDesc, 
          architectureContent: archContent,
          projectName: projectName || 'Unknown'
        })
      });
      showToast("Auto-Saved to disk!");
    } catch(e) {
      console.error(e);
    }
  };

  const handleAdkCheck = async () => {
    const arch = versionTree[currentVersionIndex];
    if (!arch) { showToast("Generate a blueprint first!"); return; }
    setAdkLoading(true);
    setAdkResult(null);

    // MOCK FOR DEMO VIDEO
    if (localStorage.getItem('ide_api_key') === 'test-key') {
      let step = 0;
      const fakeAdkLogs = [
        "> Initializing Google ADK Production Checker...",
        "> [INFO] Scanning architecture for security vulnerabilities...",
        "> [INFO] Evaluating data compliance...",
        "> ADK Security: Checking HTTPS/REST encryption... PASS",
        "> ADK Database: Evaluating SQLite for backend scalability... WARN",
        "> [INFO] Finalizing production score...",
        "> Google ADK Check Complete."
      ];
      
      setTerminalLogs([]);
      
      const interval = setInterval(() => {
        if (step < fakeAdkLogs.length) {
          setTerminalLogs(prev => [...prev, fakeAdkLogs[step]].slice(-20));
          step++;
        } else {
          clearInterval(interval);
          setAdkResult({
            score: 75,
            ready: false,
            summary: "Architecture is functional but missing critical production elements.",
            checklist: [
              { dimension: "Database", status: "BLOCK", note: "SQLite on Android is not scalable for the entire backend." },
              { dimension: "Security", status: "PASS", note: "HTTPS/REST properly encrypted." }
            ],
            blockers: ["SQLite is not recommended for production backends."]
          });
          setAdkLoading(false);
          setTimeout(() => {
             setTerminalLogs(['> StructZero MCP Link Established...']);
          }, 1000);
        }
      }, 1200);
      return;
    }

    try {
      const res = await fetchWithAuth('http://localhost:3001/api/adk/production-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architecture: arch, geminiKey })
      });
      const data = await res.json();
      if (data.error) { showToast(`ADK Error: ${data.error}`); }
      else { setAdkResult(data); }
    } catch(e) {
      showToast("ADK check failed — check server logs.");
    } finally {
      setAdkLoading(false);
    }
  };

  const handleAdkImprove = () => {
    if (!adkResult || !lastPrompt) {
      showToast("Run a production check first, then improve.");
      return;
    }
    // Build constraint list from all WARN and BLOCK items
    const gaps = (adkResult.checklist || [])
      .filter(item => item.status !== 'PASS')
      .map(item => `- ${item.dimension}: ${item.note}`);

    if (gaps.length === 0) {
      showToast("Blueprint already passes all production checks! ✅");
      return;
    }

    const adkConstraintPrompt =
      `${lastPrompt}\n\n` +
      `MANDATORY PRODUCTION REQUIREMENTS (flagged by Google ADK Production Advisor — ALL must be addressed):\n` +
      gaps.join('\n') +
      `\n\nThe new blueprint MUST explicitly document solutions for every requirement above. ` +
      `Do not skip any. This is a production hardening pass.`;

    showToast("Re-running debate with ADK constraints injected…");
    setAdkResult(null);
    executeGeneration(adkConstraintPrompt, true);
  };

  const executeGeneration = async (generationPrompt, isRefinement = false) => {
    setIsGenerating(true)
    setAppStatus('processing')
    setError(null)
    
    // MOCK FOR DEMO VIDEO
    if (localStorage.getItem('ide_api_key') === 'test-key') {
      let step = 0;
      const fakeLogs = isRefinement ? [
        "> Initializing Refinement Agent...",
        "> [INFO] Loading context: 'Switch the database to a Postgres instance'",
        "> Agent A (Database): Replacing SQLite Sync with PostgreSQL backend connection.",
        "> Agent B (Security): Reviewing TLS requirements for Postgres connections...",
        "> [INFO] Security check passed.",
        "> StructZero MCP: Merging new components into architecture...",
        "> Finalizing diagram..."
      ] : [
        "> StructZero MCP Link Established...",
        "> Initializing Agent Swarm...",
        "> [INFO] Parsing requirements: Offline-first Android weather app.",
        "> Agent A (Architect): Proposing Android App -> API Gateway -> Load Balancer.",
        "> Agent B (Mobile): Wait, offline-first requires local storage. Add SQLite Sync.",
        "> Agent C (Backend): Approved. We also need gRPC for internal microservices.",
        "> Agent B (Mobile): Adding Weather Data Service and Auth Service.",
        "> [INFO] Validating component connections...",
        "> Agent A (Architect): Diagram generated successfully."
      ];
      
      setTerminalLogs([]);
      
      const interval = setInterval(() => {
        if (step < fakeLogs.length) {
          setTerminalLogs(prev => [...prev, fakeLogs[step]].slice(-20));
          step++;
        } else {
          clearInterval(interval);
          let arch = "```mermaid\nflowchart TD\n    A[\"Mobile App (Android)\"] -->|HTTPS/REST| B(API Gateway)\n    A -->|SQLite Sync| A\n    B --> C{Load Balancer}\n    C -->|gRPC| D[Auth Service]\n    C -->|gRPC| E[Weather Data Service]\n    D --> F[(\"User DB Postgres\")]\n    E --> G[(\"Weather DB PostgreSQL\")]\n    E -->|Fetch| H[External Weather API]\n```";
          if (isRefinement) {
             arch = "```mermaid\nflowchart TD\n    A[\"Mobile App (Android)\"] -->|HTTPS/REST| B(API Gateway)\n    B --> C{Load Balancer}\n    C -->|gRPC| D[Auth Service]\n    C -->|gRPC| E[Weather Data Service]\n    D --> F[(\"User DB Postgres\")]\n    E --> G[(\"Weather DB PostgreSQL\")]\n    E -->|Fetch| H[External Weather API]\n    F -.-> I[Security Audit Passed]\n```";
          }
          const nextVersionIndex = currentVersionIndex + 1;
          const newTree = [...versionTree.slice(0, nextVersionIndex), arch];
          setVersionTree(newTree);
          setCurrentVersionIndex(nextVersionIndex);
          setAppStatus('normal');
          setIsGenerating(false);
          setLastPrompt(generationPrompt);
          setTerminalLogs(['> StructZero MCP Link Established...']);
        }
      }, 1000); // Push a log every 1s
      return;
    }

    try {
      const endpoint = 'http://localhost:3001/api/generate';
      const bodyPayload = { 
        prompt: generationPrompt + (zeroBloat ? '. VERY IMPORTANT: Do NOT generate bloatware. Code must be extremely concise and only include used variables.' : '') + (useA11y ? '. VERY IMPORTANT: Code must adhere to strict WCAG AA accessibility standards.' : '') + (androidOffline ? '. IMPORTANT: Target an Android Offline-First architecture using local SQLite/Room.' : ''), 
        uiStyles: uiStyles, 
        leanMode,
        activeUser: activeUser,
        context: isRefinement ? versionTree[currentVersionIndex] : null
      };

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      
      if (!res.ok) {
         const errData = await res.json().catch(()=>({error: 'Unknown error'}));
         setError(errData.error || 'Server error');
         setAppStatus('error');
         return;
      }

      let arch = "";
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream') && res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, {stream: true});
          const lines = chunk.split('\n');
          for (let line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.error) { setError(data.error); setAppStatus('error'); break; }
                if (data.chunk) { arch += data.chunk; }
                if (data.replace_all) { arch = data.replace_all; }
                if (data.securityAudit) setSecurityAudit(data.securityAudit);
                if (data.diffSummary) setDiffSummary(data.diffSummary);
                if (data.projectName) setProjectName(data.projectName);
              } catch(e) {}
            }
          }
        }
      } else {
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
          setAppStatus('error');
        } else if (data.architecture) {
          setVersionTree(prev => [...prev, data.architecture]);
          setCurrentVersionIndex(prev => prev + 1);
          setAppStatus('normal');
          
          if (data.securityAudit) {
            setSecurityAudit(data.securityAudit);
          }
          if (data.diffSummary) setDiffSummary(data.diffSummary);
          if (data.projectName) setProjectName(data.projectName);
          
          fetchEstimate(data.architecture);
          handleAutoSave(data.architecture);
        }
      }

      if (arch && !error) {
        const newTree = [...versionTree.slice(0, currentVersionIndex + 1), arch];
        setVersionTree(newTree);
        setCurrentVersionIndex(newTree.length - 1);
        
        setAppStatus('normal');
        fetchEstimate(arch);
        handleAutoSave(arch);
      }
      
    } catch (err) {
      setError("Failed to connect to the backend server.");
      setAppStatus('error');
    } finally { 
      setIsGenerating(false);
      setChatInput('');
    }
  }

  const handleGenerate = () => {
    if (!prompt) { setError("Please provide a prompt."); return }
    if (prompt === lastPrompt && versionTree.length > 0) {
      showToast("Using cached architecture for this prompt.");
      return;
    }
    setLastPrompt(prompt);
    setVersionTree([]);
    setCurrentVersionIndex(-1);
    setSecurityAudit(null);
    setDiffSummary(null);
    executeGeneration(prompt, false);
  }

  const handleChatRefine = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    executeGeneration(chatInput, true);
  }

  const fetchEstimate = async (archText) => {
    try {
      const res = await fetchWithAuth('http://localhost:3001/api/v1/estimate-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architecture: archText })
      });
      const data = await res.json();
      setBuildEstimate(data);
    } catch(e) {}
  }

  const fetchPlugins = async () => {
    try {
      const res = await fetchWithAuth('http://localhost:3001/api/plugins');
      const data = await res.json();
      if (data.plugins) setPluginsList(data.plugins);
    } catch(e) {
      console.error("Failed to fetch plugins", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'plugins') fetchPlugins();
  }, [activeTab]);

  const handleGeneratePlugin = async () => {
    if (!pluginPrompt) {
      showToast("Please enter a plugin prompt.");
      return;
    }
    setIsGeneratingPlugin(true);
    try {
      const res = await fetchWithAuth('http://localhost:3001/api/plugins/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: pluginPrompt })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Plugin generated and sandboxed!");
        setPluginPrompt('');
        fetchPlugins(); // Refresh the list
      } else {
        showToast(data.error || "Failed to generate plugin.");
      }
    } catch (err) {
      showToast("Error connecting to server.");
    } finally {
      setIsGeneratingPlugin(false);
    }
  };

  const handlePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target.result;
          setPastedImages(prev => [...prev, base64]);
          showToast("Image pasted to clipboard memory!");
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const TabButton = ({ id, label, icon }) => (
    <button
      data-testid={`tab-${id}`}
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl font-medium transition-all ${
        activeTab === id 
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-main)] hover:text-[var(--text-primary)]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )

  const bgClass = appStatus === 'processing' ? 'bg-status-processing' : appStatus === 'error' ? 'bg-status-error' : 'bg-status-normal';

  let mermaidCode = null;
  if (currentArch) {
    const match = currentArch.match(/```mermaid[\s\S]*?\n([\s\S]*?)```/);
    if (match) mermaidCode = match[1];
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-main)] text-[var(--text-primary)] overflow-hidden font-sans">
      
      {/* FULLSCREEN DIAGRAM MODAL */}
      {showFullscreenDiagram && mermaidCode && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowFullscreenDiagram(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-6xl h-[85vh] rounded-3xl p-6 relative flex flex-col shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
               {/* Modal Header */}
               <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
                  <div>
                     <h3 className="font-bold text-lg text-[var(--text-primary)]">Architecture Node Graph</h3>
                     <p className="text-xs text-[var(--text-secondary)]">Zoom/pan or view in high detail</p>
                  </div>
                  <button 
                     onClick={() => setShowFullscreenDiagram(false)}
                     className="p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] transition-all cursor-pointer"
                  >
                     <X className="w-5 h-5" />
                  </button>
               </div>
               {/* Modal Content */}
               <div className="flex-1 overflow-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] p-8 flex items-center justify-center min-h-0 [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-[95%] [&_svg]:max-h-[90%] select-none">
                  <ReactErrorBoundary fallback={<div className="text-red-500 p-4 border border-red-500/30 bg-red-500/10 rounded-lg text-sm">Mermaid crashed!</div>}><MermaidRenderer chart={mermaidCode} /></ReactErrorBoundary>
               </div>
            </div>
         </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-[var(--bg-card)] border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="p-6 border-b border-[var(--border-color)] flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-lg text-[var(--text-primary)]">Confirm Deletion</h3>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">Are you sure you want to delete this {deleteConfirm.type}?</p>
                      </div>
                  </div>
                  <div className="p-6 bg-[var(--bg-input)]">
                      <p className="text-[var(--text-primary)] font-medium mb-1">Target:</p>
                      <div className="p-3 bg-[var(--bg-card)] rounded-lg text-sm text-[var(--text-secondary)] border border-[var(--border-color)]">
                          {deleteConfirm.name}
                      </div>
                      <p className="text-xs text-red-400 mt-4 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> This action is permanent and cannot be undone.</p>
                  </div>
                  <div className="p-4 border-t border-[var(--border-color)] flex justify-end gap-3 bg-[var(--bg-card)]">
                      <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                       <button onClick={async () => {
                           try {
                               let endpoint = `http://localhost:3001/api/${deleteConfirm.type === 'skill' ? 'skills' : 'memory'}/${deleteConfirm.id}`;
                               if (deleteConfirm.type === 'plugin') {
                                   endpoint = `http://localhost:3001/api/plugins/${deleteConfirm.id}`;
                               }
                               await fetchWithAuth(endpoint, { method: 'DELETE' });
                               setToast(`${deleteConfirm.type === 'skill' ? 'Blueprint' : deleteConfirm.type === 'plugin' ? 'Plugin' : 'Memory'} deleted successfully!`);
                               
                               if (activeTab === 'skills') fetchSkills();
                               if (activeTab === 'memory') fetchMemories();
                               if (activeTab === 'plugins') fetchPlugins();
                           } catch (e) {
                               setToast('Failed to delete.');
                           } finally {
                               setDeleteConfirm(null);
                           }
                       }} className="px-6 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all">Yes, Delete</button>
                  </div>
              </div>
          </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in-down">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <span className="font-medium">{toast}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-colors">
        <div className="p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Terminal className="w-5 h-5 text-white" />
             </div>
             <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">StructZero</h1>
          </div>
          <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest bg-[var(--bg-main)] px-2 py-1 rounded-md ml-10">v8.0 Edition</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <TabButton id="architect" label="Architect" icon={<Terminal className="w-5 h-5 shrink-0" />} />
          <TabButton id="telemetry" label="Telemetry" icon={<Activity className="w-5 h-5 shrink-0" />} />
          <TabButton id="testing" label="Testing" icon={<CheckCircle2 className="w-5 h-5 shrink-0" />} />
          <TabButton id="memory" label="Memory Context" icon={<Database className="w-5 h-5 shrink-0" />} />
          <TabButton id="skills" label="Skills Library" icon={<SplitSquareHorizontal className="w-5 h-5 shrink-0" />} />
          <TabButton id="plugins" label="Plugin Directory" icon={<Plug className="w-5 h-5 shrink-0" />} />
          <TabButton id="security" label="Security Center" icon={<Shield className="w-5 h-5 shrink-0" />} />
          <TabButton id="billing" label="Billing & Usage" icon={<DollarSign className="w-5 h-5 shrink-0" />} />
        </nav>
        <div className="p-4 border-t border-[var(--border-color)] space-y-1">
          <TabButton id="how-to-use" label="How to Use" icon={<HelpCircle className="w-5 h-5 shrink-0" />} />
          <TabButton id="terms" label="Terms & Conditions" icon={<FileText className="w-5 h-5 shrink-0" />} />
          <TabButton id="privacy" label="Privacy Policy" icon={<Lock className="w-5 h-5 shrink-0" />} />
          <TabButton id="settings" label="Settings" icon={<Settings className="w-5 h-5 shrink-0" />} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col relative overflow-hidden transition-colors duration-1000 ${bgClass}`}>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-16">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* ARCHITECT TAB */}
            {activeTab === 'architect' && (
              <div className="animate-fade-in flex flex-col gap-8">
                
                {/* Unified Prompt Input & Advanced Controls */}
                <div className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm flex flex-col gap-4 transition-colors">
                  
                  {/* Active profile banner removed so it does not imply constraints are applied to generation */}

                  <div className="relative">
                    <textarea 
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onPaste={handlePaste}
                      placeholder="Describe the application you want to build... (e.g. A stock trading platform with WebSocket support). You can also paste an image (Ctrl+V)!" 
                      className="w-full h-24 px-5 py-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                    />
                    {pastedImages.length > 0 && (
                      <div className="absolute bottom-2 right-4 flex gap-2">
                        {pastedImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img} alt={`Pasted ${idx}`} className="h-10 w-10 object-cover rounded shadow-md border border-slate-600 cursor-pointer hover:scale-150 origin-bottom-right transition-transform" />
                            <button onClick={() => setPastedImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-4 bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-color)] mt-2">
                     <div className="flex-1">
                        <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">UI Style Templates (Multi-Select)</label>
                        <div className="flex flex-wrap gap-2">
                           {[
                             "Modern SaaS (Dark)", "Clean Light Dashboard", "Brutalist", "Glassmorphism", 
                             "Neumorphism", "Material You", "Cyberpunk / Neon", "Minimalist Monochrome", 
                             "Retro / 8-bit", "Enterprise Corporate"
                           ].map(style => (
                             <button
                               key={style}
                               onClick={() => setUiStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style])}
                               className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                 uiStyles.includes(style) 
                                   ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/50' 
                                   : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-emerald-500/30'
                               }`}
                             >
                               {style}
                             </button>
                           ))}
                        </div>
                     </div>
                     <div className="flex-1 flex flex-col justify-center gap-3 mt-4 md:mt-0 md:pl-4 md:border-l md:border-[var(--border-color)]">
                        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] cursor-pointer">
                           <input type="checkbox" checked={useA11y} onChange={e => setUseA11y(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                           Strict WCAG Accessibility
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] cursor-pointer">
                           <input type="checkbox" checked={zeroBloat} onChange={e => setZeroBloat(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                           Zero-Bloatware Code
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] cursor-pointer">
                           <input type="checkbox" checked={androidOffline} onChange={e => setAndroidOffline(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                           Offline-First (Android / SQLite)
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] cursor-pointer">
                           <input type="checkbox" checked={leanMode} onChange={e => setLeanMode(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                           Lean Mode (Cost Saver)
                        </label>
                     </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                     {error ? <span className="text-red-500 text-sm font-medium">{error}</span> : <div></div>}
                     <button 
                       onClick={handleGenerate}
                       disabled={isGenerating}
                       className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                     >
                       {isGenerating && versionTree.length === 0 ? 'Architecting...' : 'Generate Blueprint'}
                     </button>
                     
                     {/* Debate Translator Box (Hacker Terminal Aesthetic) */}
                     <div className="flex-1 ml-4">
                        <ReactErrorBoundary fallback={<div className="p-4 text-red-500">Terminal crashed</div>}>
                           <TerminalLogViewer logs={terminalLogs} isGenerating={isGenerating} />
                        </ReactErrorBoundary>
                     </div>
                  </div>
                </div>

                {/* Build Estimator Widget */}
                {buildEstimate && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    <div className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm transition-colors">
                      <div className="text-sm font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Estimated Time-To-Value</div>
                      <div className="text-3xl font-bold text-[var(--text-primary)]">{buildEstimate.estimate.p50}</div>
                    </div>
                    <div className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm transition-colors">
                      <div className="text-sm font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Estimated API Cost</div>
                      <div className="text-3xl font-bold text-emerald-600">{buildEstimate.apiCost}</div>
                    </div>
                  </div>
                )}

                {/* Output Panel & Version Tree */}
                {currentArch && (
                  <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] flex flex-col overflow-hidden shadow-sm animate-fade-in transition-colors">
                    
                    {/* Toolbar & Version Controls */}
                    <div className="p-4 bg-[var(--bg-input)] border-b border-slate-300 dark:border-slate-700/60 flex items-center justify-between shrink-0">
                      
                      {/* Version Tree Navigator */}
                      <div className="flex items-center gap-3">
                         <span className="text-[var(--text-secondary)] text-sm font-semibold uppercase tracking-widest">Version Tree:</span>
                         <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-1 shadow-sm">
                            <button 
                              onClick={() => setCurrentVersionIndex(Math.max(0, currentVersionIndex - 1))}
                              disabled={currentVersionIndex === 0}
                              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                            >
                               <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-bold text-[var(--text-primary)] px-3 py-1 bg-[var(--bg-input)] rounded text-sm">v{currentVersionIndex + 1}</span>
                            <button 
                              onClick={() => setCurrentVersionIndex(Math.min(versionTree.length - 1, currentVersionIndex + 1))}
                              disabled={currentVersionIndex === versionTree.length - 1}
                              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
                            >
                               <ChevronRight className="w-5 h-5" />
                            </button>
                         </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={handleNewBlueprint} 
                          className="bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 font-semibold" 
                          title="Clear workspace and start a new blueprint"
                        >
                          <Plus className="w-4 h-4"/> New
                        </button>
                        <div className="w-px bg-[var(--border-color)] mx-1 self-stretch" />
                        <button onClick={() => setShowDiff(!showDiff)} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2" title="Diff Viewer"><SplitSquareHorizontal className="w-4 h-4" /> Diff</button>
                        <button onClick={handleCopy} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2" title="Copy Content"><Copy className="w-4 h-4"/> Copy</button>
                        <button onClick={handleDownload} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2" title="Download Markdown"><Download className="w-4 h-4"/> Download</button>
                        <button onClick={() => setIsMaximized(true)} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2" title="Maximize View"><Maximize2 className="w-4 h-4"/> Maximize</button>
                      </div>
                    </div>

                    {/* Debate Highlights Summary */}
                    {diffSummary && (
                       <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-4">
                          <h4 className="text-emerald-400 font-bold text-sm mb-2 flex items-center gap-2"><SplitSquareHorizontal className="w-4 h-4"/> Debate Highlights</h4>
                          <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{diffSummary}</div>
                       </div>
                    )}

                    {/* ADK Production Readiness Panel */}
                    <div className="border-b border-[var(--border-color)] bg-[var(--bg-input)]/40">
                      {/* Header Row */}
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                          <span className="text-sm font-bold text-violet-400 uppercase tracking-widest">Google ADK Production Advisor</span>
                          {adkResult && (
                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${adkResult.ready ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                              {adkResult.score}/100 {adkResult.ready ? '✅ Production Ready' : '⚠️ Needs Work'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={handleAdkCheck}
                          disabled={adkLoading || !currentArch}
                          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 transition-all font-semibold"
                        >
                          {adkLoading ? (
                            <><Activity className="w-4 h-4 animate-spin" /> Running ADK Agent...</>
                          ) : (
                            <><Shield className="w-4 h-4" /> Run Production Check</>
                          )}
                        </button>
                      </div>

                      {/* Results */}
                      {adkResult && (
                        <div className="px-4 pb-4 space-y-3">
                          {/* Summary */}
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed border-l-2 border-violet-500/40 pl-3">
                            {adkResult.summary}
                          </p>

                          {/* Checklist — full-width stacked cards */}
                          <div className="grid grid-cols-1 gap-2">
                            {(adkResult.checklist || []).map((item, i) => {
                              const isPass  = item.status === 'PASS';
                              const isBlock = item.status === 'BLOCK';
                              return (
                                <div key={i} className={`flex gap-3 p-3 rounded-xl border ${
                                  isPass  ? 'bg-emerald-500/8 border-emerald-500/25' :
                                  isBlock ? 'bg-rose-500/8 border-rose-500/25' :
                                            'bg-amber-500/8 border-amber-500/25'
                                }`}>
                                  {/* Status icon */}
                                  <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-black text-sm ${
                                    isPass  ? 'bg-emerald-500/20 text-emerald-400' :
                                    isBlock ? 'bg-rose-500/20 text-rose-400' :
                                              'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {isPass ? '✓' : isBlock ? '✗' : '!'}
                                  </div>
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-bold mb-0.5 ${
                                      isPass  ? 'text-emerald-400' :
                                      isBlock ? 'text-rose-400' :
                                                'text-amber-400'
                                    }`}>
                                      {item.dimension}
                                    </div>
                                    <div className="text-sm text-[var(--text-secondary)] leading-snug">
                                      {item.note}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Blockers */}
                          {(adkResult.blockers || []).length > 0 && (
                            <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3">
                              <p className="text-sm font-bold text-rose-400 mb-2">🚫 Blockers — Must Fix Before Production</p>
                              {adkResult.blockers.map((b, i) => (
                                <p key={i} className="text-sm text-rose-300 leading-snug">• {b}</p>
                              ))}
                            </div>
                          )}

                          {/* Improve button — only shown when there are gaps */}
                          {(adkResult.checklist || []).some(i => i.status !== 'PASS') && (
                            <button
                              onClick={handleAdkImprove}
                              disabled={isGenerating}
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/40 text-violet-300 hover:from-violet-600/50 hover:to-indigo-600/50 hover:text-white transition-all font-semibold text-sm disabled:opacity-40"
                            >
                              <Activity className="w-4 h-4" />
                              🔧 Improve Blueprint with ADK Findings
                              <span className="text-xs opacity-70 ml-1">(re-runs full debate with gaps as constraints)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content Area */}
                    <div className="flex flex-col h-[600px]">
                        {/* Mermaid preview thumbnail */}
                        {mermaidCode && !showDiff && (
                           <div 
                              onClick={() => setShowFullscreenDiagram(true)}
                              className="relative group border-b border-[var(--border-color)] bg-[var(--bg-input)] h-[200px] overflow-hidden cursor-pointer"
                           >
                              <div className="px-4 pt-3 pb-0 select-none">
                                 <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Architecture Diagram
                                 </h3>
                              </div>
                              <div className="scale-[0.55] origin-top-left overflow-hidden pointer-events-none opacity-90 h-[160px] group-hover:opacity-100 transition-all px-4">
                                 <ReactErrorBoundary fallback={<div className="text-red-500 p-4 border border-red-500/30 bg-red-500/10 rounded-lg text-sm">Mermaid crashed!</div>}><MermaidRenderer chart={mermaidCode} /></ReactErrorBoundary>
                              </div>
                              {/* Gradient overlay with CTA */}
                              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-input)] via-transparent to-transparent flex items-end justify-center pb-3 group-hover:from-[var(--bg-input)]/70 transition-all duration-300">
                                 <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl transition-all shadow-md group-hover:scale-105">
                                    <Maximize2 className="w-3.5 h-3.5 text-emerald-500" /> Click to expand fullscreen
                                 </span>
                              </div>
                           </div>
                        )}

                        {showDiff ? (
                          <div className="flex-grow">
                             <MonacoEditor
                                language="markdown"
                                original={currentVersionIndex > 0 ? versionTree[currentVersionIndex - 1] : "# Initial Version\nNo previous history."}
                                modified={currentArch}
                                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                                options={{ readOnly: true, minimap: { enabled: false } }}
                             />
                          </div>
                        ) : (
                          <div className="p-8 overflow-y-auto custom-scrollbar flex-grow prose prose-slate max-w-none text-[var(--text-primary)] text-sm whitespace-pre-wrap">
                            {currentArch}
                          </div>
                        )}
                    </div>

                    {/* Interactive Chat Refinement */}
                    <div className="p-4 bg-[var(--bg-input)] border-t border-[var(--border-color)]">
                       <form onSubmit={handleChatRefine} className="flex gap-3 relative">
                          <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onPaste={handlePaste}
                            placeholder="Argue with the AI to refine this architecture (e.g., 'Swap SQLite for Postgres'). You can also paste images."
                            className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-5 py-3 text-sm text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                            disabled={isGenerating}
                          />
                          <button 
                            type="submit" 
                            disabled={isGenerating || !chatInput.trim()}
                            className="bg-emerald-600 text-white px-6 rounded-xl font-bold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2 transition-all"
                          >
                             {isGenerating ? 'Refining...' : <><MessageSquare className="w-4 h-4"/> Refine</>}
                          </button>
                       </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TELEMETRY DASHBOARD TAB */}
            {activeTab === 'telemetry' && (
              <div className="animate-fade-in flex flex-col gap-8">
                <Dashboard apiKey={apiKey} />
              </div>
            )}

            {/* Skills Library - Bento Grid Overhaul */}
            {activeTab === 'skills' && (
              <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
                 {(() => {
                   const parseSkillTags = (desc) => {
                      if (!desc) return { cleanDesc: '', tags: [] };
                      const tagMatch = desc.match(/\[TAGS:\s*(.*?)\]/i);
                      if (tagMatch) {
                          const tagsStr = tagMatch[1];
                          const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
                          const cleanDesc = desc.replace(tagMatch[0], '').trim();
                          return { cleanDesc, tags };
                      }
                      return { cleanDesc: desc, tags: [] };
                   };

                   const allTags = new Set();
                   skills.forEach(s => {
                      const { tags } = parseSkillTags(s.description);
                      tags.forEach(t => allTags.add(t));
                   });
                   const tagOptions = ['All', ...Array.from(allTags)];
                   
                   const filteredSkills = selectedSkillTag === 'All' ? skills : skills.filter(s => {
                      const { tags } = parseSkillTags(s.description);
                      return tags.includes(selectedSkillTag);
                   });

                   return (
                     <>
                       <div className="flex items-center justify-between mb-8">
                         <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                           <Book className="w-6 h-6 text-emerald-500" />
                           Skills Library
                         </h2>
                         {tagOptions.length > 1 && (
                           <select 
                              value={selectedSkillTag} 
                              onChange={(e) => setSelectedSkillTag(e.target.value)}
                              className="bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                           >
                              {tagOptions.map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                         )}
                       </div>
                       
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {filteredSkills.map((skill) => {
                             const { cleanDesc, tags } = parseSkillTags(skill.description);
                             const isAutoSave = skill.project_name || skill.description.includes('Auto-saved');
                             const formattedDate = skill.created_at ? new Date(skill.created_at.replace(' ', 'T')).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                             }) : 'Date Unknown';

                             return (
                             <div key={skill.id} onClick={() => setSelectedSkill(skill)} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[200px]">
                               <div>
                                  <div className="flex justify-between items-start gap-3 mb-2">
                                     <h3 className="font-bold text-base text-[var(--text-primary)] group-hover:text-emerald-500 transition-colors leading-snug line-clamp-2">{skill.name}</h3>
                                     <div className={`p-1.5 rounded-lg text-xs ${isAutoSave ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'} shrink-0`}>
                                        {isAutoSave ? <FileText className="w-4 h-4" /> : <Book className="w-4 h-4" />}
                                     </div>
                                  </div>
                                  
                                  {/* Subtitle / Metadata */}
                                  <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-mono mb-3">
                                     <span>{formattedDate}</span>
                                     {skill.project_name && <span className="text-blue-400 font-semibold truncate max-w-[120px]">{skill.project_name}</span>}
                                  </div>

                                  <p className="text-[var(--text-secondary)] text-xs line-clamp-3 mb-4 leading-relaxed">{cleanDesc || "Auto-Generated Reusable Skill"}</p>
                                  
                                  <div className="flex flex-wrap gap-1.5 mb-4">
                                     {isAutoSave && <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md">Blueprint</span>}
                                     {tags.map(t => <span key={t} className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md">{t}</span>)}
                                  </div>
                               </div>

                               <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs font-medium mt-auto">
                                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'skill', id: skill.id, name: skill.name }); }} className="text-red-400 hover:text-red-500 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors text-xs">
                                     Delete
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(skill.architecture_content); showToast('Blueprint Copied!'); }} className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-emerald-500 bg-[var(--bg-input)] hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg transition-colors text-xs">
                                     <Copy className="w-3 h-3"/> Copy Content
                                  </button>
                                </div>
                             </div>
                             );
                           })}
                           {filteredSkills.length === 0 && (
                             <div className="col-span-full py-12 text-center text-[var(--text-secondary)]">No skills found for this tag.</div>
                           )}
                        </div>
                     </>
                   );
                 })()}
              </div>
            )}
            
            {activeTab === 'billing' && (
              <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
                 <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                      <DollarSign className="w-6 h-6 text-emerald-500" />
                      Platform Cost & Usage
                    </h2>
                    <div className="flex items-center gap-3 bg-[var(--bg-input)] p-2 rounded-xl border border-[var(--border-color)]">
                       <label className="text-sm font-bold text-[var(--text-secondary)]">From:</label>
                       <input type="date" value={billingStartDate} onChange={e => setBillingStartDate(e.target.value)} style={{colorScheme: 'dark'}} className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg px-2 py-1 outline-none focus:border-emerald-500" />
                       <label className="text-sm font-bold text-[var(--text-secondary)] ml-2">To:</label>
                       <input type="date" value={billingEndDate} onChange={e => setBillingEndDate(e.target.value)} style={{colorScheme: 'dark'}} className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg px-2 py-1 outline-none focus:border-emerald-500" />
                       <button onClick={() => fetchBilling()} className="ml-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold py-1.5 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2"><Filter className="w-4 h-4"/> Apply</button>
                    </div>
                 </div>
                 
                 {/* KPI Cards */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
                       <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Total Period Spend</h3>
                       <div className="text-4xl font-extrabold text-emerald-500">
                          ${(billingData.reduce((acc, row) => acc + row.cost, 0)).toFixed(4)}
                       </div>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
                       <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Total Tokens Generated</h3>
                       <div className="text-4xl font-extrabold text-[var(--text-primary)]">
                          {(billingData.reduce((acc, row) => acc + row.tokens, 0)).toLocaleString()}
                       </div>
                    </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
                       <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Total API Calls</h3>
                       <div className="text-4xl font-extrabold text-[var(--text-primary)]">
                          {billingData.length}
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Usage Chart */}
                     <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm h-80 flex flex-col">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Daily Token Usage</h3>
                        <div className="flex-1 w-full min-h-0">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={billingData}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                                 <XAxis dataKey="provider" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                 <YAxis stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                 <Tooltip contentStyle={{backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9', borderRadius: '8px'}} itemStyle={{color: '#3fb950'}} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                 <Bar dataKey="tokens" fill="#10b981" radius={[4, 4, 0, 0]} />
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                     
                     {/* Spend Chart */}
                     <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm h-80 flex flex-col">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">Cumulative Spend ($)</h3>
                        <div className="flex-1 w-full min-h-0">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={billingData}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                                 <XAxis dataKey="provider" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                 <YAxis stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 12}} />
                                 <Tooltip contentStyle={{backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9', borderRadius: '8px'}} itemStyle={{color: '#3fb950'}} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                                 <Area type="monotone" dataKey="cost" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                 </div>

                 {/* Flattened Data Table */}
                 <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-input)] flex items-center justify-between">
                       <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Detailed Request Logs</h3>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm text-[var(--text-primary)]">
                          <thead className="bg-[var(--bg-input)]/50 text-xs uppercase text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                             <tr>
                                <th scope="col" className="px-6 py-4 font-bold">Timestamp</th>
                                <th scope="col" className="px-6 py-4 font-bold">Project Name</th>
                                <th scope="col" className="px-6 py-4 font-bold">Provider</th>
                                <th scope="col" className="px-6 py-4 font-bold">Latency (ms)</th>
                                <th scope="col" className="px-6 py-4 font-bold text-right">Tokens</th>
                                <th scope="col" className="px-6 py-4 font-bold text-right">Cost</th>
                             </tr>
                          </thead>
                          <tbody>
                             {billingData.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-[var(--text-secondary)]">No billing records found.</td></tr>
                             ) : (
                                billingData.slice().reverse().map((m) => (
                                    <tr key={m.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-input)]/50 transition-colors">
                                       <td className="px-6 py-4 whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                                       <td className="px-6 py-4 font-bold text-emerald-400">{m.project_name || 'Unknown'}</td>
                                       <td className="px-6 py-4 font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-slate-500" /> {m.provider}</td>
                                       <td className="px-6 py-4 text-amber-400 font-mono text-xs">{m.latency_ms.toLocaleString()} ms</td>
                                       <td className="px-6 py-4 text-right font-mono text-xs">{m.tokens.toLocaleString()}</td>
                                       <td className="px-6 py-4 text-emerald-500 font-bold text-right whitespace-nowrap">${(m.cost || 0).toFixed(5)}</td>
                                    </tr>
                                ))
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
            )}
            {activeTab === 'security' && (
              <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
                  {/* Header Bar */}
                  <div className="border-b border-[var(--border-color)] pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                     <div>
                        <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                           <Shield className="text-red-500 w-7 h-7" /> Security Center
                        </h2>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">
                           Static Application Security Testing (SAST) pipeline for generated architectures. Hooked into the Debate Engine.
                        </p>
                     </div>
                     {securityAudit && !sastLoading && (
                        <button 
                           disabled={sastLoading}
                           onClick={async () => {
                              setSastLoading(true);
                              showToast('Running SAST Scan...');
                              try {
                                 const res = await fetchWithAuth('http://localhost:3001/api/security/scan', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                       codeSnippet: currentArch || "No architecture generated yet.",
                                       projectName: projectName || "Unknown"
                                     })
                                 });
                                 const data = await res.json();
                                 if (data.scanResult) {
                                    setSecurityAudit({
                                       passed: data.scanResult.passed,
                                       timestamp: Date.now(),
                                       vulnerabilities: data.scanResult.vulnerabilities || []
                                    });
                                    showToast('SAST Scan Complete');
                                 } else if (data.error) {
                                    showToast(data.error);
                                 }
                              } catch(e) {
                                 showToast('Scan Failed');
                              } finally {
                                 setSastLoading(false);
                              }
                           }}
                           className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm shrink-0"
                        >
                           <Terminal className="w-4 h-4"/> Re-Run Security Scan
                        </button>
                     )}
                  </div>
                  
                  {/* Content Area */}
                  {sastLoading ? (
                     <SecurityScannerLoader />
                  ) : securityAudit ? (
                    <div className="space-y-6">
                      {/* Premium Status Bar */}
                      <div className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all duration-300 ${
                        securityAudit.passed 
                          ? (theme === 'dark' ? 'bg-emerald-950/10 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') 
                          : (theme === 'dark' ? 'bg-red-950/10 border-red-800/40 text-red-300' : 'bg-red-50 border-red-200 text-red-800')
                      }`}>
                        <div>
                          <h3 className="font-bold text-xl flex items-center gap-2">
                            {securityAudit.passed ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <ShieldAlert className="w-6 h-6 text-red-400" />}
                            Status: {securityAudit.passed ? 'Secure (No Vulnerabilities)' : 'Vulnerabilities Detected'}
                          </h3>
                          <p className="opacity-70 text-xs mt-1">Audit run at {new Date(securityAudit.timestamp).toLocaleString()}</p>
                        </div>
                        {!securityAudit.passed && securityAudit.vulnerabilities && securityAudit.vulnerabilities.length > 0 && (
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={applySecurityFixes} 
                              className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-md transition-all shrink-0"
                            >
                              <Cpu className="w-3.5 h-3.5" /> Auto-Fix with Debate Engine
                            </button>
                            <button 
                              onClick={copyAllPatches} 
                              className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-input)] transition-all shadow-sm shrink-0"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Report
                            </button>
                            <button 
                              onClick={downloadAllPatches} 
                              className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" /> Download Report (.md)
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Vulnerability Grid */}
                      <div className="grid grid-cols-1 gap-6">
                        {securityAudit.vulnerabilities?.map((vuln, idx) => (
                          <VulnerabilityCard vuln={vuln} key={idx} theme={theme} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Centered Welcome Hero (Pending Scan) */
                    <div className="flex flex-col items-center justify-center text-center p-12 rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] max-w-2xl mx-auto shadow-sm my-12">
                       <div className="relative mb-6">
                          <div className="absolute inset-0 bg-red-500/10 rounded-full blur-xl scale-125 animate-pulse"></div>
                          <div className="w-20 h-20 rounded-full bg-red-950/20 border border-red-500/30 flex items-center justify-center relative z-10">
                             <Shield className="w-10 h-10 text-red-500 animate-pulse" />
                          </div>
                       </div>
                       <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Static Security Testing (SAST)</h3>
                       <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed max-w-md">
                          Audit your active blueprint for OWASP Top 10 vulnerabilities (specifically XSS, SQLi, Auth bypass, or missing rate limiting/security headers/CORS). Claude will scan the architecture and provide interactive secure code patches.
                       </p>
                       <button 
                          disabled={sastLoading}
                          onClick={async () => {
                             setSastLoading(true);
                             showToast('Running SAST Scan...');
                             try {
                                const res = await fetchWithAuth('http://localhost:3001/api/security/scan', {
                                   method: 'POST',
                                   headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({ 
                                      codeSnippet: currentArch || "No architecture generated yet.",
                                      projectName: projectName || "Unknown"
                                    })
                                });
                                const data = await res.json();
                                if (data.scanResult) {
                                   setSecurityAudit({
                                      passed: data.scanResult.passed,
                                      timestamp: Date.now(),
                                      vulnerabilities: data.scanResult.vulnerabilities || []
                                   });
                                   showToast('SAST Scan Complete');
                                } else if (data.error) {
                                   showToast(data.error);
                                }
                             } catch(e) {
                                showToast('Scan Failed');
                             } finally {
                                setSastLoading(false);
                             }
                          }}
                          className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center gap-3 text-base font-semibold transform hover:scale-[1.02] active:scale-[0.98]"
                       >
                          <Terminal className="w-5 h-5"/> Run Static Security Audit
                       </button>
                    </div>
                  )}
              </div>
            )}
            
            {activeTab === 'memory' && (
              <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
                 <div className="flex items-center justify-between mb-8">
                   <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                     <Database className="w-6 h-6 text-emerald-500" />
                     Vector Memory Bank
                   </h2>
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-[var(--text-secondary)]">Filter by User:</span>
                     <select 
                       value={memoryFilterUser}
                       onChange={e => setMemoryFilterUser(e.target.value)}
                       className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
                     >
                       <option value="All">All Users</option>
                       {Object.keys(userProfiles).map(user => (
                         <option key={user} value={user}>{user === 'global' ? 'Global Default' : user}</option>
                       ))}
                     </select>
                   </div>
                 </div>
                 <p className="text-[var(--text-secondary)] text-sm mb-6">Persistent context layer for the AI engine. Auto-saves architectural drafts and system rules.</p>
                 
                 <div className="flex flex-col gap-4">
                    {(memories || []).filter(m => memoryFilterUser === 'All' || m.username === memoryFilterUser).map((mem) => (
                      <div key={mem.id} onClick={() => setSelectedMemory(mem)} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl cursor-pointer hover:border-emerald-500/50 transition-colors p-4 group">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-4">
                             <div className="bg-[var(--bg-input)] p-2 rounded-lg text-emerald-500">
                                <Database className="w-4 h-4" />
                             </div>
                             <div>
                               <h3 className="font-bold text-base text-[var(--text-primary)]">{mem.topic}</h3>
                               <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">{mem.username || 'global'}</span>
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                             <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm({ type: 'memory', id: mem.id, name: mem.topic }); }} className="text-red-400 hover:text-red-500 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors text-xs font-bold">
                                Delete
                             </button>
                             <ChevronDown className="w-5 h-5 text-[var(--text-secondary)] -rotate-90" />
                           </div>
                        </div>
                      </div>
                    ))}
                    {memories.length === 0 && (
                      <div className="py-12 text-center text-[var(--text-secondary)] border border-dashed border-[var(--border-color)] rounded-2xl">No memories recorded yet.</div>
                    )}
                 </div>
              </div>
            )}
            
            
            {activeTab === 'plugins' && (
              <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
                 <div className="flex items-center justify-between mb-8">
                   <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                     <Plug className="w-6 h-6 text-emerald-500" />
                     Plugin Directory (Self-Improvement)
                   </h2>
                 </div>
                 
                 <div className="flex flex-col gap-4 mb-8 bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)]">
                   <p className="text-[var(--text-secondary)] text-sm">Manage MCP connectors and AI-generated skills. Enter a prompt below to have the StructZero autonomously write a new plugin into your sandbox.</p>
                   <div className="flex gap-4">
                     <input
                       type="text"
                       value={pluginPrompt}
                       onChange={(e) => setPluginPrompt(e.target.value)}
                       placeholder="e.g., Create an MCP plugin that reads a local Postgres database..."
                       className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                       onKeyDown={(e) => e.key === 'Enter' && handleGeneratePlugin()}
                     />
                     <button 
                       onClick={handleGeneratePlugin}
                       disabled={isGeneratingPlugin}
                       className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl shadow-md transition-colors flex items-center gap-2 shrink-0">
                        <Terminal className="w-4 h-4"/> {isGeneratingPlugin ? 'Generating...' : 'Create New Plugin'}
                     </button>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pluginsList.map((plugin) => (
                      <div key={plugin.id} className="bg-[var(--bg-card)] border border-emerald-500/30 rounded-2xl p-6 shadow-sm flex flex-col h-full relative">
                          <div className="flex justify-between items-start mb-4">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                   <Activity className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                   <h3 className="font-bold text-lg text-[var(--text-primary)]">{plugin.name}</h3>
                                   <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div> {plugin.status || 'Sandboxed'}
                                   </span>
                                </div>
                             </div>
                          </div>
                          <p className="text-[var(--text-secondary)] text-sm line-clamp-3 mb-2 flex-grow">{plugin.description}</p>
                          <p className="text-[var(--text-secondary)] opacity-50 text-[10px] font-mono mb-4">{plugin.filename}</p>
                          <div className="mt-auto pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-xs font-medium">
                             <button onClick={() => setSelectedPluginCode(plugin)} className="text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-input)] px-4 py-2 rounded-lg transition-colors">
                                View Sandbox Code
                             </button>
                             <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm({ type: 'plugin', id: plugin.id, name: plugin.name })} className="text-red-400 hover:text-red-500 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors font-bold">
                                   Delete
                                </button>
                                <button className="text-emerald-500 hover:text-emerald-400 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors font-bold flex items-center gap-1">
                                   <CheckCircle2 className="w-4 h-4"/> Approve
                                </button>
                             </div>
                          </div>
                      </div>
                    ))}
                    {pluginsList.length === 0 && (
                      <div className="col-span-full py-12 text-center text-[var(--text-secondary)]">No plugins in sandbox yet.</div>
                    )}
                 </div>
                 
                 {selectedPluginCode && (
                   <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                     <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                       <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
                         <div>
                           <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                              <Terminal className="w-6 h-6 text-emerald-500"/>
                              {selectedPluginCode.name}
                           </h2>
                           <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedPluginCode.description}</p>
                         </div>
                         <button onClick={() => setSelectedPluginCode(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            <span className="text-3xl leading-none">&times;</span>
                         </button>
                       </div>
                       <div className="p-6 overflow-y-auto bg-[#1e1e1e] flex-1">
                         <pre className="text-emerald-400 font-mono text-sm whitespace-pre-wrap">{selectedPluginCode.code}</pre>
                       </div>
                       <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex justify-end gap-4">
                          <button onClick={() => setSelectedPluginCode(null)} className="px-6 py-2 rounded-xl font-bold border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors">
                            Close
                          </button>
                          <button onClick={() => { showToast("Plugin approved for deployment!", "success"); setSelectedPluginCode(null); }} className="px-6 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5"/> Approve & Deploy
                          </button>
                       </div>
                     </div>
                   </div>
                 )}
                 
              </div>
            )}
            
            {activeTab === 'testing' && (
               <TestingDashboard apiKey={apiKey} />
            )}
            
            {activeTab === 'how-to-use' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                 <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm transition-colors text-[var(--text-primary)]">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><HelpCircle className="text-emerald-500 w-6 h-6" /> How to Use StructZero</h2>
                    <div className="space-y-8">
                      
                      <section>
                        <h3 className="font-bold text-xl mb-3 text-emerald-400 border-b border-[var(--border-color)] pb-2">1. The Multi-Agent Debate Engine</h3>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                          Welcome to StructZero! If you're a non-coder, don't worry. This tool allows you to type out your software ideas in plain English (e.g., "Build an Android app for tracking fitness") and automatically generates professional software blueprints and architectures.
                          <br/><br/>
                          When you submit a prompt in the <strong>Architect</strong> tab, StructZero doesn't just ask a single AI. It employs a rigorous 3-way Multi-Agent Debate Engine:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-color)]">
                             <h4 className="font-bold text-[var(--text-primary)] mb-1">Round 1: Drafting</h4>
                             <p className="text-sm text-[var(--text-secondary)]">Google Gemini 2.5 Pro drafts the initial architecture and technical specifications.</p>
                          </div>
                          <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-color)]">
                             <h4 className="font-bold text-[var(--text-primary)] mb-1">Round 2: Critique</h4>
                             <p className="text-sm text-[var(--text-secondary)]">Claude 4.5 Sonnet aggressively critiques the draft, hunting for missing error handling, bad state management, or security holes.</p>
                          </div>
                          <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-color)]">
                             <h4 className="font-bold text-[var(--text-primary)] mb-1">Round 3: Synthesis</h4>
                             <p className="text-sm text-[var(--text-secondary)]">DeepSeek AI synthesizes the draft and critique into the final, battle-tested Markdown blueprint.</p>
                          </div>
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-xl mb-3 text-emerald-400 border-b border-[var(--border-color)] pb-2">1. The Absolute Basics</h3>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                          Welcome! You don't need to be a programmer to use this tool. Think of StructZero as your personal team of software engineers. You just tell them what you want to build in plain English, and they figure out how to build it.
                        </p>
                      </section>

                      <section>
                        <h3 className="font-bold text-xl mb-3 text-emerald-400 border-b border-[var(--border-color)] pb-2">2. How the Modules Work</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-[var(--text-secondary)]">
                           <div className="p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)]">
                              <h4 className="font-bold text-lg text-[var(--text-primary)]">The Architect (Main Tab)</h4>
                              <p className="text-sm mt-1">This is where you type what you want (e.g., "Make me a fitness app"). Our Debate Engine uses multiple AIs to discuss your idea and write a perfect blueprint.</p>
                           </div>
                           <div className="p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)]">
                              <h4 className="font-bold text-lg text-[var(--text-primary)]">Vector Memory</h4>
                              <p className="text-sm mt-1">This is the "Brain" of the AI. If you tell it "I always want my apps to be blue," it saves that rule here and remembers it automatically forever.</p>
                           </div>
                           <div className="p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)]">
                              <h4 className="font-bold text-lg text-[var(--text-primary)]">Skills Library</h4>
                              <p className="text-sm mt-1">When an AI builds something cool (like an Apple Glass UI), it chops it up into a "Skill" and saves it here to easily reuse later.</p>
                           </div>
                           <div className="p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)]">
                              <h4 className="font-bold text-lg text-[var(--text-primary)]">Security Center</h4>
                              <p className="text-sm mt-1">The AI automatically checks the code it wrote to make sure there are no hackers or security bugs before you use it.</p>
                           </div>
                        </div>
                      </section>

                      <section>
                        <h3 className="font-bold text-xl mb-3 text-emerald-400 border-b border-[var(--border-color)] pb-2">3. Getting Started</h3>
                        <ol className="list-decimal ml-6 mt-2 text-[var(--text-secondary)] space-y-3">
                          <li><strong>Step 1: Setup</strong><br/>Go to the <strong>Settings</strong> tab and add an API Key (like Google Gemini). This turns the AI on.</li>
                          <li><strong>Step 2: Dream it up</strong><br/>Go to the <strong>Architect</strong> tab and type your idea into the big text box. Example: "Project Apollo: Build me a weather app with a neon aesthetic."</li>
                          <li><strong>Step 3: Generate</strong><br/>Click "Generate Blueprint" and watch the AIs work. When they finish, they'll show you exactly how to build your app!</li>
                        </ol>
                      </section>
                    </div>
                 </div>
              </div>
            )}
            
            {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm transition-colors">
                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center justify-between">
                     App Preferences
                  </h2>
                  <div className="flex items-center justify-between p-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)] mb-8">
                     <div>
                       <h3 className="font-bold text-[var(--text-primary)]">Theme Mode</h3>
                       <p className="text-sm text-[var(--text-secondary)]">Toggle between Light and Dark aesthetics.</p>
                     </div>
                     <div className="flex bg-[var(--bg-card)] rounded-lg p-1 border border-[var(--border-color)] shadow-sm">
                        <button onClick={() => setTheme('light')} className={`p-2 rounded-md flex items-center gap-2 text-sm font-bold transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>
                           <Sun className="w-4 h-4" /> Light
                        </button>
                        <button onClick={() => setTheme('dark')} className={`p-2 rounded-md flex items-center gap-2 text-sm font-bold transition-all ${theme === 'dark' ? 'bg-slate-800 text-white shadow' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                           <Moon className="w-4 h-4" /> Dark
                        </button>
                     </div>
                  </div>

                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6 mt-8 border-t border-[var(--border-color)] pt-8">
                     API & Provider Configuration 
                  </h2>
                  <div className="space-y-4 bg-[var(--bg-input)] border border-[var(--border-color)] p-6 rounded-2xl">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">Active AI Provider</label>
                    <select 
                      value={activeProvider}
                      onChange={e => setActiveProvider(e.target.value)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
                    >
                      <option value="Gemini">Google Gemini</option>
                      <option value="Claude">Anthropic Claude</option>
                      <option value="DeepSeek">DeepSeek AI</option>
                      <option value="OpenAI">OpenAI (ChatGPT)</option>
                      <option value="Local (Ollama - Gemma 2B)">Local (Ollama)</option>
                    </select>
                    
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mt-4">API Key</label>
                    <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIzaSy..." className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" />
                    
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mt-4">Hidden Brain RAG: Research Knowledge Sources (Comma-separated)</label>
                    <textarea value={knowledgeSources} onChange={e => setKnowledgeSources(e.target.value)} placeholder="e.g. GitHub repos, React 19 Docs, Tailwind v4, Node native vm..." className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] font-mono min-h-[60px]" />
                    
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] cursor-pointer mt-4">
                       <input type="checkbox" checked={enableGoogleSearch} onChange={e => setEnableGoogleSearch(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                       Enable Live Google Search (Gemini Grounding) - *Adds minor search grounding fee*
                    </label>
                    
                    <button onClick={saveApiConfig} className="mt-4 w-full sm:w-auto px-6 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500 rounded-xl font-bold text-[var(--text-primary)] transition-all">
                      Save API Configuration
                    </button>
                  </div>

                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6 mt-8 border-t border-[var(--border-color)] pt-8">
                     Debate Engine: Model Constraints
                  </h2>
                  <div className="space-y-4 bg-[var(--bg-input)] border border-[var(--border-color)] p-6 rounded-2xl">
                    <p className="text-sm text-[var(--text-secondary)] mb-4">Manage instructions and behavior profiles for the debate pipeline. Click a role card to edit its guidelines line-by-line.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: 'Global', label: 'Global Constraints', desc: 'Applies to all debate rounds and LangGraph nodes.', color: 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/5' },
                        { key: 'Architect', label: 'Architect Node', desc: 'Guidelines for Gemini Principal Architect.', color: 'border-blue-500/20 hover:border-blue-500/50 bg-blue-500/5' },
                        { key: 'Reviewer', label: 'Reviewer Node', desc: 'Guidelines for Claude Principal Reviewer.', color: 'border-purple-500/20 hover:border-purple-500/50 bg-purple-500/5' },
                        { key: 'Compiler', label: 'Compiler Node', desc: 'Guidelines for DeepSeek/Gemini Compiler.', color: 'border-orange-500/20 hover:border-orange-500/50 bg-orange-500/5' }
                      ].map((item) => {
                        const ruleCount = (modelConstraints[item.key] || '').split('\n').filter(line => line.trim() !== '').length;
                        return (
                          <div 
                            key={item.key} 
                            onClick={() => setActiveConstraintDrawer(item.key)}
                            className={`p-5 border rounded-2xl shadow-sm transition-all cursor-pointer select-none flex flex-col justify-between ${item.color}`}
                          >
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-base text-[var(--text-primary)]">{item.label}</h3>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                                  {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">{item.desc}</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:text-emerald-400">
                              Configure Rules &rarr;
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6 mt-8 border-t border-[var(--border-color)] pt-8">
                     User Profiles & Identity
                  </h2>
                  <div className="space-y-4 bg-[var(--bg-input)] border border-[var(--border-color)] p-6 rounded-2xl">
                    <p className="text-sm text-[var(--text-secondary)] mb-4">Create profiles to define your identity and global rules. The MCP server will dynamically load these rules into context when you log in.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <select 
                        value={editingProfileUser}
                        onChange={e => setEditingProfileUser(e.target.value)}
                        className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
                      >
                        {Object.keys(userProfiles).map(user => (
                          <option key={user} value={user}>{user === 'global' ? 'Global Default' : `User: ${user}`}</option>
                        ))}
                      </select>
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="New Username..." 
                          value={newProfileName}
                          onChange={e => setNewProfileName(e.target.value)}
                          className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none w-40"
                        />
                        <button 
                          onClick={() => {
                            if (newProfileName.trim() && !userProfiles[newProfileName.trim()]) {
                              setUserProfiles(prev => ({...prev, [newProfileName.trim()]: ''}))
                              setEditingProfileUser(newProfileName.trim())
                              setNewProfileName('')
                            }
                          }}
                          className="px-4 py-2 bg-emerald-500/20 text-emerald-500 rounded-xl font-bold hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <label className="block text-sm font-medium text-[var(--text-secondary)]">Profile Rules for {editingProfileUser}</label>
                    <textarea 
                      value={userProfiles[editingProfileUser] || ''} 
                      onChange={e => setUserProfiles(prev => ({...prev, [editingProfileUser]: e.target.value}))} 
                      placeholder="e.g. I am Vishal. Always default to Next.js and Tailwind." 
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none transition-colors min-h-[120px]" 
                    />
                    
                    <button onClick={saveProfiles} className="mt-4 w-full sm:w-auto px-6 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500 rounded-xl font-bold text-[var(--text-primary)] transition-all">
                      Save Profiles
                    </button>
                  </div>
                  
                </div>
              </div>
            )}
            
            {activeTab === 'terms' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                 <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm text-[var(--text-primary)]">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><FileText className="text-emerald-500 w-6 h-6" /> Terms & Conditions (Enterprise)</h2>
                    <div className="prose prose-slate max-w-none text-sm text-[var(--text-secondary)] space-y-6">
                       <p className="text-base text-[var(--text-primary)] border-b border-[var(--border-color)] pb-4"><strong>Effective Date:</strong> July 8, 2026<br/>These Enterprise Terms of Service ("Agreement") govern your access to and use of the StructZero MCP (the "Software"), a multi-agent architectural debate engine.</p>
                       
                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">1. Software License & Usage</h3>
                       <p>StructZero MCP grants you a limited, non-exclusive, non-transferable, revocable license to use the Software solely for internal business operations and software architecture generation. You may not decompile, reverse engineer, or create derivative works from the core Debate Engine proprietary algorithms.</p>
                       
                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">2. Intellectual Property Rights</h3>
                       <p><strong>2.1 AI-Generated Output:</strong> You retain all ownership, copyrights, and intellectual property rights to the output generated by the Software, including Mermaid.js diagrams, architecture blueprints, and code snippets. We claim no ownership over the output.</p>
                       <p><strong>2.2 Feedback:</strong> Any feedback, suggestions, or ideas you provide regarding the Software are voluntary, and we may use them without obligation or compensation to you.</p>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">3. API Usage, Quotas & Financial Responsibility</h3>
                       <p><strong>3.1 Third-Party Cloud Providers:</strong> The Software acts as an orchestrator for third-party LLMs (e.g., Google Vertex AI, Anthropic, DeepSeek). You are entirely responsible for providing valid API keys and monitoring your usage quotas with these external providers.</p>
                       <p><strong>3.2 Cost Estimation:</strong> The Telemetry and Billing features within the Software provide heuristic approximations of token usage and API costs. We are not liable for any discrepancies between our estimates and your actual cloud provider invoices.</p>
                       <p><strong>3.3 Zero-Cost Mode:</strong> By utilizing the Local (Ollama) provider, you acknowledge that generation quality may vary based on your local hardware specifications. We do not guarantee parity between cloud and local models.</p>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">4. No Warranties & Limitation of Liability</h3>
                       <p><strong>4.1 "AS-IS" Delivery:</strong> THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE". WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.</p>
                       <p><strong>4.2 Deployment Risk:</strong> The multi-agent debate engine generates experimental software architectures. You are strictly responsible for conducting rigorous code reviews, security audits, and functional testing before deploying any AI-generated architecture into production.</p>
                       <p><strong>4.3 Liability Cap:</strong> IN NO EVENT SHALL OUR TOTAL LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT EXCEED THE AMOUNT PAID BY YOU FOR THE SOFTWARE IN THE TWELVE (12) MONTHS PRECEDING THE INCIDENT.</p>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">5. Termination</h3>
                       <p>We reserve the right to terminate or suspend your access to the Software immediately, without prior notice, if you breach any of the terms outlined in this Agreement. Upon termination, the license granted herein shall cease, and you must destroy all copies of the Software.</p>
                    </div>
                 </div>
              </div>
            )}
            
            {activeTab === 'privacy' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                 <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm text-[var(--text-primary)]">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Lock className="text-emerald-500 w-6 h-6" /> Enterprise Privacy & Data Security</h2>
                    <div className="prose prose-slate max-w-none text-sm text-[var(--text-secondary)] space-y-6">
                       <p className="text-base text-[var(--text-primary)] border-b border-[var(--border-color)] pb-4"><strong>Effective Date:</strong> July 8, 2026<br/>At StructZero, we respect the extreme confidentiality of your enterprise codebase and architectural trade secrets. This Enterprise Privacy Policy details our <strong>Zero-Egress Data Philosophy</strong>.</p>
                       
                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">1. Information We Collect (Local-First)</h3>
                       <p>We collect and process the following categories of information strictly on your local machine:</p>
                       <ul className="list-disc pl-5 space-y-2">
                           <li><strong>Configuration Data:</strong> API keys for Google Gemini, Anthropic Claude, DeepSeek, and OpenAI, stored securely in your browser's `localStorage`.</li>
                           <li><strong>Architectural Data:</strong> Prompts, system contexts, generated blueprints, and Mermaid diagrams are saved locally in your SQLite `mcp_brain.sqlite` database.</li>
                           <li><strong>Telemetry Data:</strong> System latency, token counts, and cost estimations for your interactions are stored in the local SQLite database to populate your Billing Dashboard.</li>
                       </ul>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">2. Zero-Egress Guarantee</h3>
                       <p>StructZero MCP does not maintain a centralized telemetry server. <strong>Your data is never transmitted to our infrastructure.</strong> The software operates entirely within your environment as a Model Context Protocol (MCP) server. We cannot view, access, or analyze your API keys, prompts, or generated architectures.</p>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">3. Third-Party Sub-processors (Cloud LLMs)</h3>
                       <p>When you utilize cloud-based models for the multi-agent debate, your data is transmitted directly from your local machine to the respective provider's API endpoints. You are subject to their respective Enterprise Data Processing Agreements (DPAs):</p>
                       <ul className="list-disc pl-5 space-y-2">
                           <li><strong>Google Cloud (Gemini):</strong> Customer data sent to the Vertex AI API is not used to train Google's foundation models by default.</li>
                           <li><strong>Anthropic (Claude):</strong> Anthropic's Commercial Terms stipulate that API inputs and outputs are not used to train their models without explicit opt-in.</li>
                           <li><strong>OpenAI:</strong> OpenAI's Enterprise privacy policy states that API data is not used for model training.</li>
                       </ul>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">4. Absolute Air-Gapped Mode</h3>
                       <p>For organizations with strict compliance requirements (e.g., defense, healthcare, finance), selecting the "Local (Ollama)" provider severs all external HTTP egress. All generation, multi-agent debate, and embedding extraction for the Vector Memory Bank will occur entirely on your local GPU/CPU. In this mode, no data leaves your physical machine.</p>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">5. Data Subject Rights & Deletion</h3>
                       <p>Because all data is stored locally, you have absolute control over your data. You may exercise your right to erasure by utilizing the "Delete" functions within the Memory Bank and Blueprint Library UI, or by physically deleting the `mcp_brain.sqlite` file from your filesystem.</p>

                       <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-xs">6. Changes to this Policy</h3>
                       <p>We may update this Enterprise Privacy Policy periodically to reflect changes in our software architecture or regulatory requirements. We will notify you of any material changes via a notification within the StructZero MCP software update notes.</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Telemetry Ticker */}
        <div className="absolute bottom-0 left-0 w-full h-8 bg-[var(--bg-card)] border-t border-[var(--border-color)] flex items-center px-4 overflow-hidden z-20 transition-colors">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-3 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
           <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)] truncate">
              {terminalLogs[terminalLogs.length - 1] || '> Waiting for telemetry...'}
           </div>
        </div>
        
        {/* Detail Modals */}
        {selectedSkill && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
               <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-input)] rounded-t-2xl">
                 <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Book className="w-5 h-5 text-emerald-500"/> {selectedSkill.name}</h3>
                    {(() => {
                       const tagMatch = selectedSkill.description?.match(/\[TAGS:\s*(.*?)\]/i);
                       if (tagMatch) {
                          const tags = tagMatch[1].split(',').map(t => t.trim());
                          return <div className="flex gap-2 mt-2">{tags.map(t => <span key={t} className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">{t}</span>)}</div>
                       }
                    })()}
                 </div>
                 <button onClick={() => setSelectedSkill(null)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-lg transition-colors"><X className="w-6 h-6"/></button>
               </div>
               <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
                  <p className="text-[var(--text-secondary)] text-sm mb-6 pb-6 border-b border-[var(--border-color)] whitespace-pre-wrap leading-relaxed">
                     {selectedSkill.description?.replace(/\[TAGS:\s*(.*?)\]/i, '').trim()}
                  </p>
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Terminal className="w-4 h-4"/> Architecture Blueprint</h4>
                     <button onClick={() => { navigator.clipboard.writeText(selectedSkill.architecture_content); showToast("Blueprint Copied!"); }} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--border-color)] text-[var(--text-primary)] rounded-lg transition-colors"><Copy className="w-3.5 h-3.5"/> Copy Markdown</button>
                  </div>
                  <div className="h-[400px] border border-[var(--border-color)] rounded-xl overflow-hidden">
                     <MonacoEditor
                        language="markdown"
                        value={selectedSkill.architecture_content}
                        theme={theme === 'dark' ? 'vs-dark' : 'light'}
                        options={{ readOnly: true, minimap: { enabled: false } }}
                     />
                  </div>
               </div>
            </div>
          </div>
        )}

        {selectedMemory && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
               <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-input)]">
                 <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Database className="w-5 h-5 text-emerald-500"/> {selectedMemory.topic}</h3>
                 <button onClick={() => setSelectedMemory(null)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-lg transition-colors"><X className="w-6 h-6"/></button>
               </div>
               <div className="p-6">
                  <div className="bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-color)]">
                     <p className="text-[var(--text-secondary)] text-sm whitespace-pre-wrap leading-relaxed">{selectedMemory.details}</p>
                  </div>
                  <div className="mt-6 flex justify-end">
                     <button onClick={() => { navigator.clipboard.writeText(selectedMemory.details); showToast("Memory Copied!"); }} className="flex items-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl transition-colors shadow"><Copy className="w-4 h-4"/> Copy Context Rule</button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeConstraintDrawer && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div 
              onClick={() => setActiveConstraintDrawer(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
            />
            <div className="relative w-full max-w-2xl h-full bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl flex flex-col animate-slide-in overflow-hidden z-10">
              <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-input)]">
                <div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)]">
                    Configure {activeConstraintDrawer === 'Global' ? 'Global Constraints' : `${activeConstraintDrawer} Node`}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Configure each operational rule on its own line below.</p>
                </div>
                <button 
                  onClick={() => setActiveConstraintDrawer(null)}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-lg transition-colors"
                >
                  <X className="w-6 h-6"/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {tempRules.map((rule, idx) => (
                  <div key={idx} className="bg-[var(--bg-input)] border border-[var(--border-color)] p-4 pr-14 rounded-2xl relative group flex flex-col transition-all duration-200 hover:border-[var(--border-color)]/80 focus-within:border-emerald-500/40 focus-within:bg-[var(--bg-card)] focus-within:shadow-md">
                    <div className="flex gap-4 items-start w-full">
                      {/* Number Badge */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-sm font-mono font-bold text-emerald-500 select-none shadow-sm self-start mt-0.5 group-focus-within:border-emerald-500/30">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      
                      {/* Textarea */}
                      <textarea
                        value={rule}
                        onChange={(e) => {
                          const next = [...tempRules];
                          next[idx] = e.target.value;
                          setTempRules(next);
                        }}
                        placeholder="Enter rule detail..."
                        rows={Math.max(1, Math.ceil((rule || '').length / 65))}
                        className="flex-1 bg-transparent border-0 focus:ring-0 outline-none text-base text-[var(--text-primary)] leading-relaxed resize-none font-sans overflow-hidden py-1 px-0 pr-6"
                      />
                      
                      {/* Actions Wrapper (Absolute Position prevents layout shifting and removes horizontal padding gap) */}
                      <div className="absolute top-4 right-4 h-8 flex items-center justify-end">
                        {pendingDeleteIndex === idx ? (
                          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-xl animate-fade-in shadow-sm">
                            <span className="text-[9px] font-bold text-red-400 select-none">Delete?</span>
                            <button
                              onClick={() => {
                                const next = tempRules.filter((_, i) => i !== idx);
                                setTempRules(next.length > 0 ? next : ['']);
                                setPendingDeleteIndex(null);
                              }}
                              className="p-0.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                              title="Confirm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setPendingDeleteIndex(null)}
                              className="p-0.5 bg-[var(--bg-card)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] rounded transition-colors border border-[var(--border-color)]"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPendingDeleteIndex(idx)}
                            className="text-slate-400 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Rule Line"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Hover Rule Analyzer Explanation */}
                    <div className="max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-all duration-300 text-[10px] text-[var(--text-secondary)] mt-0 group-hover:mt-3 group-hover:pt-2.5 group-hover:border-t border-[var(--border-color)]/30 font-mono leading-relaxed overflow-hidden select-none flex items-center gap-1.5 pl-12">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      <span className="text-emerald-500/80 font-bold uppercase tracking-wider text-[9px]">Enforces:</span> 
                      <span className="text-[var(--text-primary)]/80">{explainRule(rule)}</span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setTempRules([...tempRules, ''])}
                  className="w-full py-3 bg-[var(--bg-input)] hover:bg-emerald-500/5 text-emerald-500 border border-dashed border-emerald-500/20 hover:border-emerald-500/40 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4"/> Add New Rule Line
                </button>
              </div>

              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-input)] flex justify-end gap-3">
                <button 
                  onClick={() => setActiveConstraintDrawer(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    const joined = tempRules.filter(r => r.trim() !== '').join('\n');
                    const updatedConstraints = { ...modelConstraints, [activeConstraintDrawer]: joined };
                    setModelConstraints(updatedConstraints);
                    
                    try {
                      await fetchWithAuth('http://localhost:3001/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ modelConstraints: JSON.stringify(updatedConstraints) })
                      });
                      showToast("Rules updated and saved successfully!");
                    } catch (e) {
                      showToast("Failed to save rules to server.");
                    }
                    
                    setActiveConstraintDrawer(null);
                  }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4"/> Apply Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {isMaximized && (
        <div className="fixed inset-0 z-50 bg-[#0d1117]/95 backdrop-blur-md flex flex-col p-6 md:p-12 overflow-hidden animate-fade-in">
          <div className="flex justify-between items-center mb-6 max-w-7xl w-full mx-auto shrink-0">
            <div>
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Full Document View</span>
              <h2 className="text-2xl font-bold text-white mt-1">{projectName} Blueprint</h2>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleDownload}
                className="bg-[#161b22] border border-[#30363d] hover:bg-[#30363d] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download MD
              </button>
              <button 
                onClick={() => setIsMaximized(false)}
                className="bg-red-600/10 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Close
              </button>
            </div>
          </div>
          <div className="flex-grow max-w-7xl w-full mx-auto overflow-y-auto bg-[var(--bg-card)] border border-[var(--border-color)] p-8 md:p-12 rounded-3xl custom-scrollbar prose prose-invert max-w-none text-[#c9d1d9] text-base whitespace-pre-wrap selection:bg-emerald-500/30">
            {currentArch}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out; }
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        @keyframes slide-in { 0% { transform: translateX(100%); } 100% { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  )
}

export default function App() {
  const [apiKey, setApiKey] = React.useState(() => localStorage.getItem('ide_api_key'));

  const handleLogin = (key) => {
    localStorage.setItem('ide_api_key', key);
    setApiKey(key);
  };

  if (!apiKey) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <AppContent apiKey={apiKey} />
    </ErrorBoundary>
  );
}
