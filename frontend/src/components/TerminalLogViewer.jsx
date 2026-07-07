import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { z } from 'zod';

const logSchema = z.string().optional().default("");

export default function TerminalLogViewer({ logs, isGenerating }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={`mt-6 bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl transition-all duration-500 ${isGenerating || logs.length > 1 ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0'}`}>
       <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <Terminal className="w-4 h-4 text-[#3fb950]" />
             <span className="text-xs font-mono text-[#8b949e]">mcp-debate-process</span>
          </div>
       </div>
       <div 
         ref={containerRef}
         className="p-4 flex flex-col gap-1 max-h-60 overflow-y-auto custom-scrollbar font-mono text-sm"
       >
          {logs.map((rawLog, i) => {
             // Zod validation to prevent silent UI crashes on undefined logs
             const log = logSchema.parse(rawLog);
             let text = log.replace('> ', '');
             
             let prefix = "[INFO]";
             let colorClass = "text-[#8b949e]";
             
             if (text.includes("Agent A") || text.includes("Architect")) { prefix = "[ARCHITECT]"; colorClass = "text-[#58a6ff]"; }
             else if (text.includes("Agent B") || text.includes("Mobile") || text.includes("Security")) { prefix = "[CRITIC]"; colorClass = "text-[#ff7b72]"; }
             else if (text.includes("Agent C") || text.includes("Backend")) { prefix = "[COMPILER]"; colorClass = "text-[#d2a8ff]"; }
             else if (text.includes("PASS")) { prefix = "[SUCCESS]"; colorClass = "text-[#3fb950]"; }
             else if (text.includes("WARN") || text.includes("Wait")) { prefix = "[WARN]"; colorClass = "text-[#e3b341]"; }
             else if (text.includes("BLOCK")) { prefix = "[FATAL]"; colorClass = "text-[#f85149]"; }

             return (
               <div key={i} className={`flex gap-3 leading-relaxed ${colorClass}`}>
                  <span className="opacity-50 shrink-0">{prefix}</span>
                  <span className="break-all">{text}</span>
               </div>
             );
          })}
       </div>
    </div>
  );
}
