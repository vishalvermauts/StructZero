import { GoogleGenAI } from '@google/genai';
import { getSetting } from './database.js';
import fs from 'fs';

async function runDebate() {
  const geminiKey = await getSetting('geminiKey');
  if (!geminiKey) throw new Error("Missing Gemini Key");
  
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const proposedArchitecture = `
Proposed Architectural Upgrade: "The Zero-Framework Approach"
Instead of adopting heavy multi-agent frameworks like LangGraph or Mastra, we will build a lightweight, custom pipeline in Node.js with the following constraints:
1. Strict Linear Pipeline: Architect -> Reviewer -> Developer. No cyclical loops, to guarantee exactly 1 API call per phase and prevent token explosion.
2. Native Structured Outputs: We will use the native JSON schema capabilities of the LLM providers (Gemini/Claude) to ensure data passed between phases is strictly typed JSON.
3. Custom Checkpointing: We will write a lightweight function to save the JSON state to our existing SQLite database after each phase. If a phase crashes, it loads the state from SQLite and resumes.
4. Telemetry: We will retain the existing Langfuse integration for tracing.
  `;

  console.log("--- ROUND 1: GEMINI DRAFTS A REVIEW ---");
  const draftResponse = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `You are a Principal Software Architect. Review this proposed "Zero-Framework Approach" architectural upgrade for our multi-agent system.\n${proposedArchitecture}`
  });
  const geminiDraft = draftResponse.text;
  console.log("Gemini's Review:\n" + geminiDraft.substring(0, 300) + '...\n');

  console.log("--- ROUND 2: CLAUDE CRITIQUES AGGRESSIVELY ---");
  const claudeResponse = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `You are playing the role of a hyper-critical "Red Team" Reviewer (Claude). Critique this proposed "Zero-Framework Approach" aggressively, finding any missed edge cases, structural vulnerabilities, maintenance issues, or scaling concerns regarding building our own state management and checkpointing instead of using a framework:\n\nOriginal Proposal:\n${proposedArchitecture}\n\nGemini's Review:\n${geminiDraft}`
  });
  const critique = claudeResponse.text;
  console.log("Claude's Critique:\n" + critique.substring(0, 300) + '...\n');

  console.log("--- ROUND 3: GEMINI SYNTHESIZES (FINAL) ---");
  const finalResponse = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Synthesize the original draft and the aggressive critique into a final, highly-polished architectural verdict on whether to adopt the "Zero-Framework Approach" or reconsider a framework, and what specific technical precautions must be taken if we do build it ourselves.\n\nGemini Draft:\n${geminiDraft}\n\nClaude Critique:\n${critique}`
  });
  
  const finalOutput = finalResponse.text;
  fs.writeFileSync('C:/Users/mcmur/.gemini/antigravity/brain/83751be6-b9ec-43bf-8d7d-acb66f038727/scratch/debate_zeroframework_result.md', finalOutput);
  console.log("--- DEBATE COMPLETE! --- Saved to scratch/debate_zeroframework_result.md");
}

runDebate().catch(console.error);
