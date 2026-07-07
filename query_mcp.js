import fs from 'fs';

const appCode = fs.readFileSync('frontend/src/App.jsx', 'utf-8');

const prompt = `Attached above is the raw React code for my current App.jsx dashboard. The UI/UX is currently failing several enterprise software design principles and contains major bugs.

Please act as a Principal Frontend Architect and rewrite the necessary React components to fix the following issue:

1. Architect UX: 
- The generated blueprint markdown does not render on the screen because the \`currentArch\` state variable is missing from the component state and rendering logic (even though the backend returns it). Please add \`const [currentArch, setCurrentArch] = useState(null)\` and update the \`executeGeneration\` function to set it so the Markdown viewer displays the output!
- Add a 'Copy Markdown' button to the toolbar that actually copies the \`currentArch\` state to the clipboard.
- Implement caching in \`handleGenerate\`: If the user clicks 'Generate Blueprint' but the \`prompt\` matches the previous prompt, do not re-trigger the API fetch. Use the cached version to save API credits.

Do not write placeholder text. Give me the production-ready React code snippets to replace the specific blocks in App.jsx. Provide the exact code blocks to replace.`;

async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "```jsx\n" + appCode + "\n```\n\n" + prompt,
        uiStyles: ["Enterprise Corporate"],
        leanMode: true
      })
    });
    
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let output = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, {stream: true});
        const lines = chunk.split('\n');
        for (let line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.chunk) { output += data.chunk; }
              if (data.replace_all) { output = data.replace_all; }
            } catch(e) {}
          }
        }
      }
      fs.writeFileSync('mcp_output_task1.md', output);
      console.log("MCP Response saved to mcp_output_task1.md");
    } else {
      const data = await res.json();
      fs.writeFileSync('mcp_output_task1.md', data.architecture || data.replace_all || "No output");
      console.log("MCP Response saved to mcp_output_task1.md");
    }
  } catch(e) {
    console.error("Fetch failed:", e);
  }
}

run();
