import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { z } from 'zod';
import gsap from 'gsap';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  themeVariables: {
    fontFamily: 'Inter, system-ui, sans-serif',
    primaryColor: '#10b981',
    primaryTextColor: '#fff',
    primaryBorderColor: '#059669',
    lineColor: '#3fb950',
    secondaryColor: '#1f2937',
    tertiaryColor: '#111827'
  }
});

// Zod validation to ensure the input is always a string
const schema = z.string().default("");

export default function MermaidRenderer({ chart, className }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && chart) {
      // 1. Zod Validation
      let safeChart = schema.parse(chart);

      // 2. Input Sanitization (Fix for Debate Engine Finding: Unquoted Parentheses)
      // We safely wrap any unquoted parenthesis nodes in quotes to prevent parser crashes.
      safeChart = safeChart.replace(/\[([^"\]]+\([^\]]+\)[^"\]]+)\]/g, '["$1"]');

      try {
        ref.current.removeAttribute('data-processed');
        ref.current.innerHTML = safeChart;
        mermaid.init(undefined, ref.current);

        // 3. GSAP Animation for Premium UI effects
        // Select all the SVG nodes rendered by Mermaid and animate them in!
        const nodes = ref.current.querySelectorAll('.node');
        if (nodes.length > 0) {
          gsap.fromTo(nodes, 
            { scale: 0, opacity: 0, rotation: -10 },
            { scale: 1, opacity: 1, rotation: 0, duration: 0.6, stagger: 0.05, ease: "back.out(1.7)" }
          );
        }
      } catch (error) {
        console.error("Mermaid Render Error:", error);
        ref.current.innerHTML = `<div class="text-red-500 p-4 border border-red-500/30 bg-red-500/10 rounded-lg text-sm">Failed to render diagram. Architecture syntax error.</div>`;
      }
    }
  }, [chart]);

  return <div className={`mermaid animated-mermaid ${className || ''}`} ref={ref} />;
}
