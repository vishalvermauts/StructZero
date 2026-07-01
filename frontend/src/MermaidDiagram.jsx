import React, { useEffect, useRef, useId } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
});

const MermaidDiagram = ({ chart, className = '' }) => {
  const containerRef = useRef(null);
  const uniqueId = useId();
  // Ensure the ID is valid for HTML (no colons)
  const safeId = `mermaid-${uniqueId.replace(/:/g, '')}`;
  const idRef = useRef(safeId);
  
  useEffect(() => {
    if (!chart || !containerRef.current) return;
    
    let mounted = true;
    
    const renderDiagram = async () => {
      try {
        const sanitized = DOMPurify.sanitize(chart, { ALLOWED_TAGS: [] });
        
        const { svg } = await mermaid.render(idRef.current, sanitized);
        
        if (mounted && containerRef.current) {
          const cleanSvg = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
          containerRef.current.innerHTML = cleanSvg;
        }
      } catch (error) {
        console.error('Mermaid render failed:', error);
        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = 
            '<div class="text-red-500 p-4 border border-red-500/30 bg-red-500/10 rounded">Invalid diagram syntax or rendering error.</div>';
        }
      }
    };
    
    renderDiagram();
    
    return () => {
      mounted = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [chart]);
  
  return (
    <div 
      ref={containerRef} 
      className={`mermaid-container overflow-auto ${className}`}
      role="img"
      aria-label={chart ? `Architecture diagram` : 'Diagram loading'}
    />
  );
};

export default MermaidDiagram;
