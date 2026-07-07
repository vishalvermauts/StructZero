import { GoogleGenAI } from '@google/genai';
import { getSetting } from './database.js';

async function run() {
  const geminiKey = await getSetting('geminiKey');
  if (!geminiKey) throw new Error("Missing Gemini Key");
  
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const prompt = `We have designed a Multi-Agent AI system with 3 specialized roles. Here are the constraints we drafted in plain, human-readable English:

1. Gemini (Lead Architect): "You are the Lead Architect. Focus exclusively on designing the high-level structure, logic, and data flow of the application. Do not write any low-level code, boilerplate, or exact implementation details. Leave the actual coding to the developers."

2. Claude (Architecture Reviewer): "You are the Architecture Reviewer. Your only job is to rigorously review the proposed architecture to find security vulnerabilities, missing edge cases, and structural flaws. Do not write any code. Just tell us where the design fails."

3. DeepSeek (Implementation Developer in the IDE): "You are the Implementation Developer. Your job is to strictly follow the provided architecture blueprint and turn it into actual, working low-level code. Do not try to redesign the system; just execute the plan."

Please review these constraints. Are they bulletproof? 
Also, do you have any other suggestions regarding more constraints we could add to make this triage system even better? Keep your feedback concise and actionable.`;

  console.log("Asking MCP (Gemini 2.5 Pro) for feedback...");
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt
  });
  
  console.log("\n--- MCP AI FEEDBACK ---");
  console.log(response.text);
}

run().catch(console.error);
