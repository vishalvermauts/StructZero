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

  const proposedConstraints = `
Proposed Multi-Agent Constraints:
1. Gemini (Lead Architect): "You are the Lead Architect. Focus exclusively on designing the high-level structure, logic, and data flow. Do not write any low-level code or exact implementation details. If the Reviewer finds flaws, you must revise the plan until it passes."
2. Claude (Architecture Reviewer): "You are the Architecture Reviewer. Rigorously review the proposed architecture to find security vulnerabilities and structural flaws. Do not write any code and do not propose solutions. Output flaws in a structured format: {Issue, Impact, Location}."
3. DeepSeek (Implementation Developer): "You are the Implementation Developer. Strictly follow the provided architecture blueprint to write the actual, working low-level code. Do not redesign the system. If the blueprint is ambiguous or technically impossible, halt work and submit a formal 'Request for Clarification'."
  `;

  console.log("--- ROUND 1: GEMINI DRAFTS A REVIEW ---");
  const draftResponse = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `You are a Principal Software Architect. Review these proposed multi-agent system constraints to ensure they are bulletproof for software development triage.\n${proposedConstraints}`
  });
  const geminiDraft = draftResponse.text;
  console.log("Gemini's Review:\n" + geminiDraft.substring(0, 300) + '...\n');

  console.log("--- ROUND 2: CLAUDE CRITIQUES AGGRESSIVELY ---");
  const claudeResponse = await claude.invoke(`Critique this proposed architectural review aggressively, finding any missed edge cases, logical flaws, or process failures in these constraints:\n\nOriginal Rules:\n${proposedConstraints}\n\nGemini's Review:\n${geminiDraft}`);
  const critique = claudeResponse.content;
  console.log("Claude's Critique:\n" + critique.substring(0, 300) + '...\n');

  console.log("--- ROUND 3: GEMINI SYNTHESIZES (FINAL) ---");
  const finalResponse = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `Synthesize the original draft and Claude's aggressive critique into a final, highly-polished set of bulletproof constraints for the 3 agents.\n\nGemini Draft:\n${geminiDraft}\n\nClaude Critique:\n${critique}`
  });
  
  const finalOutput = finalResponse.text;
  fs.writeFileSync('C:/Users/mcmur/.gemini/antigravity/brain/83751be6-b9ec-43bf-8d7d-acb66f038727/scratch/debate_constraints_result.md', finalOutput);
  console.log("--- DEBATE COMPLETE! --- Saved to scratch/debate_constraints_result.md");
}

runDebate().catch(console.error);
