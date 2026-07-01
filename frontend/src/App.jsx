import React, { useState, useEffect, useRef, Component } from 'react'
import io from 'socket.io-client'
import { Settings, Play, Database, FileJson, Terminal, Activity, ShieldAlert, Copy, SplitSquareHorizontal, LayoutDashboard, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, DollarSign, HelpCircle, Moon, Sun, Book, FileText, Lock } from 'lucide-react'
import Dashboard from './Dashboard'
import MermaidDiagram from './MermaidDiagram'
import Draggable from 'react-draggable'
import MonacoEditor from '@monaco-editor/react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
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



function AppContent() {
  const [activeTab, setActiveTab] = useState('architect') 
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  
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
  }, [theme, uiStyles, useA11y, zeroBloat, androidOffline]);
  const [chatInput, setChatInput] = useState('')
  
  const [geminiKey, setGeminiKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [activeProvider, setActiveProvider] = useState('Gemini')
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [appStatus, setAppStatus] = useState('normal') 
  
  // Version Tree State
  const [versionTree, setVersionTree] = useState([])
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1)
  
  const [securityAudit, setSecurityAudit] = useState(null)
  const [buildEstimate, setBuildEstimate] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  
  const [memories, setMemories] = useState([])
  const [skills, setSkills] = useState([])
  const [selectedSkill, setSelectedSkill] = useState(null)
  
  const [billingData, setBillingData] = useState([])
  const [billingStartDate, setBillingStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
  })
  const [billingEndDate, setBillingEndDate] = useState(() => new Date().toISOString().split('T')[0])
  
  const [terminalLogs, setTerminalLogs] = useState(['> IDE Architect MCP Link Established...'])
  
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    const socket = io('http://localhost:3001');
    socket.on('status', (data) => {
      setTerminalLogs(prev => [...prev, `> ${data.message}`].slice(-20));
    });
    return () => socket.disconnect();
  }, []);

  useEffect(() => { fetchSettings() }, [])
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
      const res = await fetch('http://localhost:3001/api/settings')
      const data = await res.json()
      if (data.geminiKey) setGeminiKey(data.geminiKey)
      if (data.claudeKey) setClaudeKey(data.claudeKey)
      if (data.deepseekKey) setDeepseekKey(data.deepseekKey)
      if (data.ollamaUrl) setOllamaUrl(data.ollamaUrl)
      if (data.activeProvider) setActiveProvider(data.activeProvider)
    } catch (e) { console.error(e) }
  }

  const saveSettings = async () => {
    try {
      await fetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiKey, claudeKey, deepseekKey, ollamaUrl, activeProvider })
      })
      showToast("Settings saved successfully!")
    } catch (e) { setError("Failed to save settings") }
  }

  const fetchMemories = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/memory')
      setMemories(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchSkills = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/skills')
      setSkills(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchBilling = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/observability/metrics');
      const data = await res.json();
      
      const filtered = data.filter(m => {
         const d = new Date(m.created_at).toISOString().split('T')[0];
         return d >= billingStartDate && d <= billingEndDate;
      });
      setBillingData(filtered);
    } catch(e) {}
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

  const handleAutoSave = async (archContent) => {
    if (!archContent) return;
    try {
      await fetch('http://localhost:3001/api/v1/skills/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `architecture_${Date.now()}.md`, content: archContent })
      });
      showToast("Auto-Saved to disk!");
    } catch(e) {
      console.error(e);
    }
  }

  const handleScaffold = () => {
    showToast("Opening Dry-Run Scaffold Preview...");
  }

  const executeGeneration = async (generationPrompt, isRefinement = false) => {
    setIsGenerating(true)
    setAppStatus('processing')
    setError(null)
    
    try {
      const endpoint = 'http://localhost:3001/api/generate';
      const bodyPayload = { 
        prompt: generationPrompt + (zeroBloat ? '. VERY IMPORTANT: Do NOT generate bloatware. Code must be extremely concise and only include used variables.' : '') + (useA11y ? '. VERY IMPORTANT: Code must adhere to strict WCAG AA accessibility standards.' : '') + (androidOffline ? '. IMPORTANT: Target an Android Offline-First architecture using local SQLite/Room.' : ''), 
        uiStyles: uiStyles, 
        leanMode,
        context: isRefinement ? versionTree[currentVersionIndex] : null
      };

      const res = await fetch(endpoint, {
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
      
      // Handle server streaming
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, {stream: true});
          const lines = chunk.split('\\n');
          for (let line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.error) { setError(data.error); setAppStatus('error'); break; }
                if (data.chunk) { arch += data.chunk; }
                if (data.replace_all) { arch = data.replace_all; }
                if (data.securityAudit) setSecurityAudit(data.securityAudit);
              } catch(e) {}
            }
          }
        }
      } else {
        const data = await res.json();
        arch = data.architecture || data.replace_all || "# Generated Blueprint";
        if (data.securityAudit) setSecurityAudit(data.securityAudit);
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
    setVersionTree([]);
    setCurrentVersionIndex(-1);
    executeGeneration(prompt, false);
  }

  const handleChatRefine = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    executeGeneration(chatInput, true);
  }

  const fetchEstimate = async (archText) => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/estimate-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architecture: archText })
      });
      const data = await res.json();
      setBuildEstimate(data);
    } catch(e) {}
  }

  const TabButton = ({ id, label, icon }) => (
    <button
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
  const currentArch = versionTree[currentVersionIndex];
  if (currentArch) {
    const match = currentArch.match(/```mermaid\n([\s\S]*?)```/);
    if (match) mermaidCode = match[1];
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-main)] text-[var(--text-primary)] overflow-hidden font-sans">
      
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
             <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">IDE Architect</h1>
          </div>
          <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest bg-[var(--bg-main)] px-2 py-1 rounded-md ml-10">v8.0 Edition</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <TabButton id="architect" label="Architect" icon={<Terminal className="w-5 h-5 shrink-0" />} />
          <TabButton id="telemetry" label="Telemetry" icon={<Activity className="w-5 h-5 shrink-0" />} />
          <TabButton id="billing" label="Billing & Costs" icon={<DollarSign className="w-5 h-5 shrink-0" />} />
          <TabButton id="skills" label="Skills Library" icon={<FileJson className="w-5 h-5 shrink-0" />} />
          <TabButton id="security" label="Security Center" icon={<ShieldAlert className="w-5 h-5 shrink-0" />} />
          <TabButton id="memory" label="Memory Bank" icon={<Database className="w-5 h-5 shrink-0" />} />
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
                  <div className="flex items-center justify-between">
                     <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-emerald-500" />
                        Architecture Prompt
                     </h2>
                     <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] cursor-pointer">
                           <input type="checkbox" checked={leanMode} onChange={e => setLeanMode(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                           Use Lean Mode (Cost Saver)
                        </label>
                     </div>
                  </div>
                  
                  <textarea 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe the application you want to build... (e.g. A stock trading platform with WebSocket support)" 
                    className="w-full h-24 px-5 py-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                  />
                  
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
                  </div>

                  {/* Debate Translator Box */}
                  <div className={`mt-6 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl overflow-hidden transition-all duration-500 ${isGenerating || terminalLogs.length > 1 ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0'}`}>
                     <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-4 py-3 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                        <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide">Live AI Debate Engine</span>
                     </div>
                     <div className="p-4 flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {terminalLogs.filter(log => log.includes('Gemini') || log.includes('Claude') || log.includes('DeepSeek') || log.includes('Static Security') || log.includes('Multi-Agent Debate complete')).map((log, i) => {
                           let translated = log.replace('> ', '');
                           let colorClass = "border-slate-400 text-slate-500";
                           
                           if (translated.includes('Initializing 3-Way')) { translated = 'Starting the AI team...'; colorClass = "border-blue-500 text-blue-600"; }
                           if (translated.includes('Gemini 2.5 Pro is drafting')) { translated = 'Gemini is writing the first draft.'; colorClass = "border-purple-500 text-purple-600"; }
                           if (translated.includes('Claude 4.5 Sonnet is critiquing')) { translated = 'Claude is looking for mistakes and critiquing the architecture.'; colorClass = "border-orange-500 text-orange-600"; }
                           if (translated.includes('DeepSeek finalizing')) { translated = 'DeepSeek is combining everything into the final plan.'; colorClass = "border-emerald-500 text-emerald-600"; }
                           if (translated.includes('Static Security Audit')) { translated = 'Checking the code for security holes.'; colorClass = "border-red-500 text-red-600"; }
                           if (translated.includes('complete')) { translated = 'Debate complete. Architecture ready.'; colorClass = "border-emerald-500 text-emerald-600 font-bold"; }
                           
                           return (
                             <div key={i} className={`text-sm bg-[var(--bg-card)] p-3 rounded border-l-4 ${colorClass} shadow-sm animate-fade-in`}>
                                {translated}
                             </div>
                           );
                        })}
                        {isGenerating && (
                           <div className="text-sm text-[var(--text-secondary)] italic animate-pulse p-2">
                              The AI models are currently debating your request...
                           </div>
                        )}
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
                    <div className="p-4 bg-[var(--bg-input)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
                      
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
                        <button onClick={handleScaffold} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"><Play className="w-4 h-4"/> 1-Click Scaffold</button>
                        <button onClick={() => setShowDiff(!showDiff)} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2" title="Diff Viewer"><SplitSquareHorizontal className="w-4 h-4" /> Diff</button>
                        <button onClick={handleCopy} className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-input)] text-[var(--text-primary)] px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"><Copy className="w-4 h-4"/> Copy</button>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex flex-col h-[600px]">
                        {/* Mermaid Overlay if exists */}
                        {mermaidCode && !showDiff && (
                           <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-input)]">
                              <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Architecture Node Graph</h3>
                              <MermaidDiagram chart={mermaidCode} />
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
                            placeholder="Argue with the AI to refine this architecture (e.g., 'Swap SQLite for Postgres')"
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
                <Dashboard />
              </div>
            )}

            {/* Skills Library - Bento Grid Overhaul */}
            {activeTab === 'skills' && (
              <div className="animate-fade-in">
                 <div className="flex items-center justify-between mb-8">
                   <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                     <FileJson className="w-6 h-6 text-emerald-500" />
                     Skills Library
                   </h2>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {skills.map((skill, i) => (
                      <div key={skill.id || i} onClick={() => setSelectedSkill(skill)} className="bento-card cursor-pointer group">
                        <div className="flex justify-between items-start mb-4">
                           <h3 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-emerald-600 transition-colors">{skill.name}</h3>
                           <div className="bg-[var(--bg-input)] p-2 rounded-lg text-[var(--text-secondary)] group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                              <FileJson className="w-5 h-5" />
                           </div>
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm line-clamp-3 mb-4">{skill.description || "Auto-Generated Architecture Skill"}</p>
                        <div className="mt-auto pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)] font-medium">
                           <span>Auto-Saved</span>
                           <span className="flex items-center gap-1 group-hover:text-emerald-500 transition-colors">View Markdown <ChevronRight className="w-4 h-4"/></span>
                        </div>
                      </div>
                    ))}
                    {skills.length === 0 && <div className="col-span-full text-center py-20 text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-sm transition-colors">No skills saved yet. Generate an architecture to auto-save.</div>}
                 </div>
              </div>
            )}

            {/* Markdown Modal for Skills */}
            {selectedSkill && (
              <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in">
                 <div className="bg-[var(--bg-card)] rounded-3xl shadow-2xl w-full max-w-5xl h-full max-h-[85vh] flex flex-col overflow-hidden transition-colors">
                    <div className="p-4 bg-[var(--bg-input)] border-b border-[var(--border-color)] flex justify-between items-center">
                       <h3 className="font-bold text-[var(--text-primary)] text-lg">{selectedSkill.name}</h3>
                       <button onClick={() => setSelectedSkill(null)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg transition-colors">✕</button>
                    </div>
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-grow prose prose-slate max-w-none text-[var(--text-primary)] whitespace-pre-wrap">
                       {selectedSkill.content || selectedSkill.architecture || "(No markdown content available)"}
                    </div>
                 </div>
              </div>
            )}

            {/* Billing Tab (Placeholder for DB logic) */}
            {activeTab === 'billing' && (
              <div className="animate-fade-in max-w-5xl mx-auto space-y-6">
                 <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                      <DollarSign className="w-6 h-6 text-emerald-500" />
                      Detailed Billing Center
                    </h2>
                    <div className="flex items-center gap-3 bg-[var(--bg-input)] p-2 rounded-xl border border-[var(--border-color)]">
                       <label className="text-sm font-bold text-[var(--text-secondary)]">From:</label>
                       <input type="date" value={billingStartDate} onChange={e => setBillingStartDate(e.target.value)} className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg px-2 py-1 outline-none" />
                       <label className="text-sm font-bold text-[var(--text-secondary)] ml-2">To:</label>
                       <input type="date" value={billingEndDate} onChange={e => setBillingEndDate(e.target.value)} className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm rounded-lg px-2 py-1 outline-none" />
                    </div>
                 </div>

                 <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-[var(--bg-input)] border-b border-[var(--border-color)] text-[var(--text-secondary)] text-sm uppercase tracking-wider">
                             <th className="p-4 font-bold">Date</th>
                             <th className="p-4 font-bold">Provider</th>
                             <th className="p-4 font-bold">Latency</th>
                             <th className="p-4 font-bold">Tokens</th>
                             <th className="p-4 font-bold text-right">Cost</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[var(--border-color)]">
                          {billingData.map(row => (
                             <tr key={row.id} className="hover:bg-[var(--bg-input)] transition-colors text-[var(--text-primary)] text-sm">
                                <td className="p-4">{new Date(row.created_at).toLocaleString()}</td>
                                <td className="p-4 font-medium">{row.provider}</td>
                                <td className="p-4">{row.latency_ms} ms</td>
                                <td className="p-4">{row.tokens.toLocaleString()}</td>
                                <td className="p-4 text-right font-bold text-emerald-600">${row.cost.toFixed(4)}</td>
                             </tr>
                          ))}
                          {billingData.length === 0 && (
                             <tr>
                                <td colSpan="5" className="p-8 text-center text-[var(--text-secondary)]">No billing data found for this date range.</td>
                             </tr>
                          )}
                       </tbody>
                       {billingData.length > 0 && (
                         <tfoot className="bg-[var(--bg-input)] border-t border-[var(--border-color)] text-[var(--text-primary)]">
                            <tr>
                               <td colSpan="4" className="p-4 text-right font-bold uppercase">Total Spend:</td>
                               <td className="p-4 text-right font-extrabold text-emerald-600 text-lg">
                                  ${billingData.reduce((sum, r) => sum + r.cost, 0).toFixed(4)}
                               </td>
                            </tr>
                         </tfoot>
                       )}
                    </table>
                 </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="animate-fade-in max-w-4xl mx-auto">
                 <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2 flex items-center gap-3"><ShieldAlert className="text-red-500" /> Security Center</h2>
                 <p className="text-[var(--text-secondary)] text-sm mb-8">Static Application Security Testing (SAST) pipeline for generated architectures.</p>
                 {securityAudit ? (
                   <div className="space-y-6">
                     <div className={`p-6 rounded-3xl border flex items-center justify-between ${securityAudit.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                       <div>
                         <h3 className="font-bold text-xl text-slate-800">Status: {securityAudit.passed ? 'Secure' : 'Vulnerabilities Detected'}</h3>
                         <p className="text-slate-500 text-sm mt-1">Audit run at {new Date(securityAudit.timestamp).toLocaleString()}</p>
                       </div>
                       <div className={`w-12 h-12 rounded-full flex items-center justify-center ${securityAudit.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {securityAudit.passed ? <CheckCircle2 className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                       </div>
                     </div>
                     {securityAudit.vulnerabilities?.map((vuln, idx) => (
                       <div key={idx} className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border-color)] flex items-start gap-4 shadow-sm transition-colors">
                          <div className={`mt-1 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide shrink-0 ${vuln.severity === 'High' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                            {vuln.severity}
                          </div>
                          <div><h4 className="font-bold text-[var(--text-primary)] text-lg">{vuln.type}</h4><p className="text-[var(--text-secondary)] mt-1 text-sm">{vuln.message}</p></div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="space-y-6 opacity-60">
                     <div className="p-6 rounded-3xl border flex items-center justify-between bg-[var(--bg-input)] border-[var(--border-color)]">
                       <div>
                         <h3 className="font-bold text-xl text-[var(--text-primary)]">Status: Awaiting First Scan</h3>
                         <p className="text-[var(--text-secondary)] text-sm mt-1">The SAST pipeline is idle. Generate an architecture to begin.</p>
                       </div>
                       <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                          <ShieldAlert className="w-6 h-6 opacity-50" />
                       </div>
                     </div>
                     <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border-color)] flex items-start gap-4 shadow-sm animate-pulse">
                        <div className="mt-1 w-12 h-6 rounded bg-[var(--border-color)] shrink-0"></div>
                        <div className="w-full">
                           <div className="h-5 bg-[var(--border-color)] rounded w-1/3 mb-2"></div>
                           <div className="h-4 bg-[var(--bg-input)] rounded w-3/4"></div>
                        </div>
                     </div>
                     <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border-color)] flex items-start gap-4 shadow-sm animate-pulse">
                        <div className="mt-1 w-12 h-6 rounded bg-[var(--border-color)] shrink-0"></div>
                        <div className="w-full">
                           <div className="h-5 bg-[var(--border-color)] rounded w-1/4 mb-2"></div>
                           <div className="h-4 bg-[var(--bg-input)] rounded w-2/3"></div>
                        </div>
                     </div>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="animate-fade-in">
                 <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Persistent Memory Bank</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                    {memories.map(m => (
                      <div key={m.id} className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm flex flex-col transition-colors">
                        <h3 className="font-bold text-[var(--text-primary)] text-lg">{m.topic}</h3>
                        <p className="text-[var(--text-secondary)] text-sm flex-grow whitespace-pre-wrap mt-2">{m.details}</p>
                      </div>
                    ))}
                    {memories.length === 0 && (
                      <>
                        <div className="bg-[var(--bg-input)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm flex flex-col transition-colors opacity-50 border-dashed">
                          <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] mb-4 flex items-center justify-center text-[var(--text-secondary)]"><Database className="w-4 h-4" /></div>
                          <h3 className="font-bold text-[var(--text-primary)] text-lg">Memory Node 01 (Empty)</h3>
                          <p className="text-[var(--text-secondary)] text-sm flex-grow mt-2">Awaiting architectural context to be embedded into persistent storage...</p>
                        </div>
                        <div className="bg-[var(--bg-input)] p-6 rounded-3xl border border-[var(--border-color)] shadow-sm flex flex-col transition-colors opacity-50 border-dashed">
                          <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] mb-4 flex items-center justify-center text-[var(--text-secondary)]"><Database className="w-4 h-4" /></div>
                          <h3 className="font-bold text-[var(--text-primary)] text-lg">Memory Node 02 (Empty)</h3>
                          <p className="text-[var(--text-secondary)] text-sm flex-grow mt-2">Awaiting architectural context to be embedded into persistent storage...</p>
                        </div>
                      </>
                    )}
                 </div>
              </div>
            )}
            
            {activeTab === 'how-to-use' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                 <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm transition-colors text-[var(--text-primary)]">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><HelpCircle className="text-emerald-500 w-6 h-6" /> How to Use IDE Architect</h2>
                    
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-bold text-lg mb-2">1. The Debate Engine (Multi-Agent Architecture)</h3>
                        <p className="text-[var(--text-secondary)]">When you submit a prompt in the Architect tab, IDE Architect doesn't just ask a single AI. It employs a 3-way Multi-Agent Debate Engine:</p>
                        <ul className="list-disc ml-6 mt-2 text-[var(--text-secondary)] space-y-1">
                          <li><strong className="text-[var(--text-primary)]">Round 1 (Drafting):</strong> Google Gemini 2.5 Pro drafts the initial architecture.</li>
                          <li><strong className="text-[var(--text-primary)]">Round 2 (Critique):</strong> Claude 4.5 Sonnet aggressively critiques the draft, hunting for missing error handling, bad state management, or security holes.</li>
                          <li><strong className="text-[var(--text-primary)]">Round 3 (Synthesis):</strong> DeepSeek AI synthesizes the draft and critique into the final, battle-tested Markdown blueprint.</li>
                        </ul>
                      </div>

                      <hr className="border-[var(--border-color)]" />

                      <div>
                        <h3 className="font-bold text-lg mb-2">2. Lean Mode (Cost Saving)</h3>
                        <p className="text-[var(--text-secondary)]">Checking the "Use Lean Mode" box in the Architect tab will dynamically swap the expensive AI models (Gemini 2.5 Pro, Claude Sonnet) for cheaper, faster equivalents (Gemini 1.5 Flash, Claude Haiku). Use this for simple boilerplate scripts where you don't need intense critical debate.</p>
                      </div>

                      <hr className="border-[var(--border-color)]" />

                      <div>
                        <h3 className="font-bold text-lg mb-2">3. The Version Tree & Refinement</h3>
                        <p className="text-[var(--text-secondary)]">After generating a blueprint, a chat box appears below it. This isn't a standard chatbot. If you ask it to "Change the database to Postgres", it will re-run the architecture and generate a *new version node* in the Version Tree (`&lt; v2 &gt;`). You can arrow left and right through the tree to instantly rollback to any previous version.</p>
                      </div>

                      <hr className="border-[var(--border-color)]" />

                      <div>
                        <h3 className="font-bold text-lg mb-2">4. Auto-Save & The Skills Library</h3>
                        <p className="text-[var(--text-secondary)]">Every time a generation succeeds, IDE Architect automatically saves the Markdown file directly to your local computer in the `/skills_export/` folder. It will instantly appear in the Skills Library tab as a Bento card for future reference.</p>
                      </div>
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

                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">
                     API & Provider Configuration 
                  </h2>
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">Active AI Provider</label>
                    <select 
                      value={activeProvider}
                      onChange={e => setActiveProvider(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
                    >
                      <option value="Gemini">Google Gemini</option>
                      <option value="Claude">Anthropic Claude</option>
                      <option value="DeepSeek">DeepSeek AI</option>
                      <option value="OpenAI">OpenAI (ChatGPT)</option>
                      <option value="Local (Ollama - Gemma 2B)">Local (Ollama)</option>
                    </select>
                    
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mt-4">API Key</label>
                    <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIzaSy..." className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" />
                  </div>
                  <button onClick={saveSettings} className="w-full mt-6 py-4 bg-emerald-600 rounded-xl font-bold text-white shadow-lg hover:bg-emerald-500 transition-all">
                    Save Settings
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'terms' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                 <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm text-[var(--text-primary)]">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><FileText className="text-emerald-500 w-6 h-6" /> Terms & Conditions</h2>
                    <div className="prose prose-slate max-w-none text-sm text-[var(--text-secondary)]">
                       <p>By using IDE Architect MCP, you agree to generate amazing software architectures responsibly.</p>
                       <p>This software is provided "as is", without warranty of any kind.</p>
                    </div>
                 </div>
              </div>
            )}
            
            {activeTab === 'privacy' && (
              <div className="max-w-3xl mx-auto animate-fade-in">
                 <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-[var(--border-color)] shadow-sm text-[var(--text-primary)]">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Lock className="text-emerald-500 w-6 h-6" /> Privacy Policy</h2>
                    <div className="prose prose-slate max-w-none text-sm text-[var(--text-secondary)]">
                       <p>Your API keys are stored securely in local SQLite (mcp_brain.sqlite) and never sent to our servers.</p>
                       <p>Your generated architectures (Memory Bank) are stored entirely locally on your machine.</p>
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
      </main>
      
      <style>{`
        @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out; }
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
