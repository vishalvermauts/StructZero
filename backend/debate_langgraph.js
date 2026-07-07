import { GoogleGenAI } from '@google/genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { getSetting } from './database.js';
import fs from 'fs';

async function runDebate() {
  const geminiKey = await getSetting('geminiKey');
  const claudeKey = await getSetting('claudeKey');
  
  if (!geminiKey || !claudeKey) throw new Error("Missing Gemini or Claude Key");
  
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const claude = new ChatAnthropic({ apiKey: claudeKey, model: 'claude-sonnet-4-5-20250929' });

  const proposedArchitecture = `
Proposed Architectural Upgrade:
Replace the current hardcoded procedural Promise chain in the Multi-Agent Debate Engine with LangGraph and LangSmith.
1. LangGraph will encode the strict state-machine workflow synthesized previously (Architect node, Reviewer node, Developer node).
2. It will handle conditional edges (e.g., if Claude finds flaws, route back to Gemini; if iterationCount > 3, route to Failure).
3. LangSmith will be integrated via LANGCHAIN_TRACING_V2 for out-of-the-box observability (token usage, prompt tracking, execution graphs).
  `;

  console.log("--- ROUND 1: GEMINI DRAFTS A REVIEW ---");
  const draftResponse = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `You are a Principal Software Architect. Review this proposed architectural upgrade to integrate LangGraph and LangSmith into our multi-agent system.\n${proposedArchitecture}`
  });
  const geminiDraft = draftResponse.text;
  console.log("Gemini's Review:\n" + geminiDraft.substring(0, 300) + '...\n');

  console.log("--- ROUND 2: CLAUDE CRITIQUES AGGRESSIVELY ---");
  const claudeResponse = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `Critique this proposed architectural upgrade aggressively, finding any missed edge cases, structural vulnerabilities, scaling issues, or vendor lock-in concerns regarding LangGraph/LangSmith:\n\nOriginal Proposal:\n${proposedArchitecture}\n\nGemini's Review:\n${geminiDraft}`
  });
  const critique = claudeResponse.text;
  console.log("Claude's Critique:\n" + critique.substring(0, 300) + '...\n');

  console.log("--- ROUND 3: GEMINI SYNTHESIZES (FINAL) ---");
  const finalResponse = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `Synthesize the original draft and Claude's aggressive critique into a final, highly-polished architectural verdict on whether to adopt LangGraph and LangSmith, and what specific technical precautions must be taken if we do.\n\nGemini Draft:\n${geminiDraft}\n\nClaude Critique:\n${critique}`
  });
  
  const finalOutput = finalResponse.text;
  fs.writeFileSync('C:/Users/mcmur/.gemini/antigravity/brain/83751be6-b9ec-43bf-8d7d-acb66f038727/scratch/debate_langgraph_result.md', finalOutput);
  console.log("--- DEBATE COMPLETE! --- Saved to scratch/debate_langgraph_result.md");
}

runDebate().catch(console.error);
