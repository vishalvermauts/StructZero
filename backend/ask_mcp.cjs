const fs = require('fs');
const path = require('path');

// Try to dynamically import the backend database logic
async function run() {
  const { getSetting } = await import('./database.js');
  const { GoogleGenAI } = await import('@google/genai');

  const planPath = 'C:\\\\Users\\\\mcmur\\\\.gemini\\\\antigravity\\\\brain\\\\83751be6-b9ec-43bf-8d7d-acb66f038727\\\\implementation_plan.md';
  const planContent = fs.readFileSync(planPath, 'utf8');

  const promptText = `
You are the AI brain behind IDE Architect MCP. We are redesigning the Vector Memory and Blueprint Library logic.
Here is the implementation plan:
${planContent}

Please answer the two Open Questions from the plan:
1. Data Migration: Are you okay with clearing old bulky memories manually, or would you prefer an automated database reset? What's the best practice for our users?
2. Skill Granularity: When the AI chops up an architecture into "Skills", how granular should they be? Should "Frontend React Layout" and "Apple Glass CSS" be two different skills, or one combined UI skill?

Provide a concise, expert suggestion on how to proceed.
`;

  const key = await getSetting('geminiKey');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: promptText,
  });
  
  console.log("\\n=== MCP AI Suggestion ===\\n");
  console.log(response.text);
}
run();
