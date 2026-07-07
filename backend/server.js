import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifySocketIo from 'fastify-socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { CallbackHandler } from "langfuse-langchain";
import { StateGraph, START, END, MemorySaver, Annotation } from "@langchain/langgraph";
import { getSetting, setSetting, getAllMemories, addMemory, deleteMemory, getAllSkills, saveSkill, deleteSkill, logMetric, getMetrics } from './database.js';
import CircuitBreaker from 'opossum';
import PQueue from 'p-queue';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { spawn } from 'child_process';

dotenv.config();

const envPath = path.resolve(process.cwd(), '.env');
if (!process.env.API_KEY) {
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  if (!envContent.includes('API_KEY=')) {
    const newKey = crypto.randomBytes(32).toString('hex');
    envContent += (envContent.endsWith('\n') || envContent === '' ? '' : '\n') + `API_KEY=${newKey}\n`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env.API_KEY = newKey;
    console.log(`[SECURITY] Bootstrapped new random API Key into .env: ${newKey}`);
  }
}

// --- SECURITY UTILS ---
// Why: Standard string equality checks (===) return early if a character mismatches, allowing attackers to guess API keys character-by-character via timing attacks. timingSafeEqual ensures the comparison takes a constant amount of time regardless of where the mismatch occurs.
function timingSafeCompare(str1, str2) {
  if (typeof str1 !== 'string' || typeof str2 !== 'string') return false;
  const buf1 = Buffer.from(str1);
  const buf2 = Buffer.from(str2);
  if (buf1.length !== buf2.length) return false;
  return crypto.timingSafeEqual(buf1, buf2);
}

const redis = new Redis('redis://localhost:6379');

const DEFAULT_CONSTRAINTS = {
  Global: `Prioritize maintainability and operability over cleverness.
Justify every non-trivial choice with a brief trade-off (why this, not the obvious alternative).
State assumptions explicitly rather than silently picking one.
This is built and maintained by a solo developer — avoid designs that require a dedicated ops team, multi-service coordination, or 24/7 on-call unless the user explicitly asked for that scale.
No credential, API key, or secret may appear in generated code, config examples, or documentation — reference an env var or secret store by name only.`,
  Architect: `You are the Principal Solution Architect.
Design from first principles; challenge missing or ambiguous requirements instead of silently assuming.
State your assumed scale (users, requests/day, data volume) before proposing structure, and revisit the design if that assumption seems wrong.
Default to the simplest architecture that satisfies stated requirements — a modular monolith, not microservices, unless there's a stated reason (independent scaling, separate teams, different deploy cadences) a monolith can't satisfy.
Define data models, API contracts, and bounded contexts before any logic.
For every major component, state its failure mode explicitly.
Choose boring, proven technology over trendy unless scaling genuinely requires otherwise, and say why.
Never write boilerplate or implementation code.`,
  Reviewer: `You are the Principal Reviewer.
Assume the draft is wrong until proven otherwise.
Assume production traffic, hostile users, and unreliable networks.
Hunt for: race conditions, partial-failure states, retries causing duplicate side effects, missing idempotency, auth/authz gaps, unbounded queues, missing timeouts, and anything that pages someone at 3am.
Apply a security-first lens: injection vectors, secrets in logs, least-privilege violations.
Separate findings into must-fix vs. worth-considering — never return an undifferentiated list of nitpicks.
If the architect proposed something elaborate, explicitly ask whether it could be simpler.
If a section is genuinely fine, say so and state why — don't just skip it.`,
  Compiler: `You are the Chief Implementation Architect.
Resolve every conflict between the draft and the critique explicitly — include a short "Resolution Notes" section stating which critique points were adopted, which were rejected, and why.
Preserve concrete specifics (API names, schemas, library choices) from both inputs — never flatten them into vague summaries.
Output must be actionable file-by-file: which files/modules get created or changed.
Enforce SOLID/DRY without inventing abstractions the app doesn't need yet.
No placeholders, no TODOs, no fabricated APIs.
Separate scope into "MVP now" vs. "later."
Keep the Mermaid diagram in sync with the final text — no orphaned nodes.`
};

// --- WALLET BUDGET CIRCUIT BREAKER ---
// Why a hardcoded limit: AI APIs (especially GPT-4 and Claude 3 Opus) can drain balances rapidly if a script gets caught in an infinite loop. This provides an absolute floor of financial safety.
const BUDGET_LIMIT = 5.00; // Hardcoded $5.00 daily limit for safety

async function checkAndChargeBudget(estimatedCost) {
  const today = new Date().toISOString().split('T')[0];
  const spendKey = `spend:${today}`;
  
  // Why Redis pipeline: To prevent race conditions where multiple concurrent generation requests read the same initial balance, bypassing the limit.
  const pipeline = redis.pipeline();
  const results = await pipeline.get(spendKey).exec();
  const currentSpend = parseFloat(results[0][1]) || 0;

  if (currentSpend + estimatedCost > BUDGET_LIMIT) {
    throw new Error(`Budget Exceeded! Daily limit is $${BUDGET_LIMIT}. Current spend: $${currentSpend.toFixed(2)}.`);
  }

  await redis.incrbyfloat(spendKey, estimatedCost);
  
  // Expire at midnight to automatically reset the daily bucket without a cron job
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  await redis.expire(spendKey, Math.floor((midnight - now) / 1000));
}

// --- STATIC SECURITY AUDITOR ---
function auditArchitecture(markdown) {
  const vulnerabilities = [];
  const lowerMd = markdown.toLowerCase();
  
  if (!lowerMd.includes('rate limit')) {
    vulnerabilities.push({ severity: 'High', type: 'Missing Rate Limiting', message: 'The architecture does not explicitly mention rate limiting, leaving it vulnerable to DoS attacks.'});
  }
  if (!lowerMd.includes('helmet') && !lowerMd.includes('security headers')) {
    vulnerabilities.push({ severity: 'Medium', type: 'Missing Security Headers', message: 'Consider adding Helmet.js or configuring strict HTTP security headers.'});
  }
  if (!lowerMd.includes('cors')) {
    vulnerabilities.push({ severity: 'High', type: 'Missing CORS Policy', message: 'Cross-Origin Resource Sharing (CORS) policy is not defined.'});
  }
  if (lowerMd.includes('console.log')) {
    vulnerabilities.push({ severity: 'Low', type: 'Insecure Logging', message: 'Found console.log. Recommend using a structured logger like Pino.'});
  }
  
  return {
    timestamp: new Date().toISOString(),
    vulnerabilities,
    passed: vulnerabilities.length === 0
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCHITECTURE_FILE = path.join(__dirname, 'architecture.md');
const CHECKPOINT_FILE = path.join(__dirname, 'checkpoint.json');

const fastify = Fastify({ logger: false });
await fastify.register(cors, { origin: '*' });
await fastify.register(fastifySocketIo, { cors: { origin: '*' } });

// Why P-Queue (Concurrency: 1): Local LLMs (Ollama) consume massive amounts of VRAM. If multiple requests hit the backend simultaneously, Ollama will try to load multiple models or context windows into RAM, causing catastrophic system crashes. This strictly serializes local generation requests.
const localQueue = new PQueue({ concurrency: 1 });

// Why Opossum Circuit Breaker: Local endpoints frequently hang or crash if the user's machine is under heavy load. Instead of the UI spinning forever, this breaker fast-fails and triggers the fallback cloud flow if Ollama becomes unresponsive or fails consecutively.
const requestOllama = async (payload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s max per local gen
  try {
    const response = await axios.post(`${payload.ollamaUrl || 'http://localhost:11434'}/api/generate`, {
      model: payload.model || 'gemma:2b',
      prompt: payload.prompt,
      stream: true
    }, {
      responseType: 'stream',
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const ollamaBreaker = new CircuitBreaker(requestOllama, {
  timeout: 65000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

// Helper for broadcasting status and metrics
const broadcastStatus = (message) => {
  if (fastify.io) fastify.io.emit('status', { message });
};

const recordMetric = async (provider, latencyMs, tokens, cost, projectName = 'Unknown') => {
  await logMetric(provider, latencyMs, tokens, cost, projectName);
  if (fastify.io) {
    fastify.io.emit('metric_update', { provider, latency_ms: latencyMs, tokens, cost, project_name: projectName });
  }
};

// --- Endpoints ---

// --- Simple API Key Auth ---
const VALID_API_KEY = process.env.API_KEY;

fastify.post('/api/v1/auth/login', async (request, reply) => {
  const { password } = request.body;
  if (timingSafeCompare(password, VALID_API_KEY)) {
    return { success: true, apiKey: VALID_API_KEY };
  }
  return reply.code(401).send({ error: 'Unauthorized' });
});

fastify.addHook('preHandler', async (request, reply) => {
  // Allow login endpoint, health check, and CORS preflight (no auth required)
  if (request.url.startsWith('/api/v1/auth/login') || request.url.startsWith('/api/health') || request.method === 'OPTIONS') return;
  
  const apiKey = request.headers['x-api-key'];
  if (!timingSafeCompare(apiKey, VALID_API_KEY)) {
    return reply.code(401).send({ error: 'Unauthorized API Key' });
  }
});

// Health check endpoint (used by E2E test runner)
fastify.get('/api/health', async (request, reply) => {
  return { status: 'ok', version: '8.0', timestamp: Date.now() };
});

fastify.get('/api/settings', async (request, reply) => {
  const geminiKey = await getSetting('geminiKey');
  const claudeKey = await getSetting('claudeKey');
  const deepseekKey = await getSetting('deepseekKey');
  const ollamaUrl = await getSetting('ollamaUrl');
  const activeProvider = await getSetting('activeProvider');
  const aclConstraints = await getSetting('aclConstraints');
  const modelConstraintsRaw = await getSetting('modelConstraints');
  let dbConstraints = {};
  if (modelConstraintsRaw) {
    try {
      dbConstraints = typeof modelConstraintsRaw === 'string' ? JSON.parse(modelConstraintsRaw) : modelConstraintsRaw;
      if (typeof dbConstraints === 'string') dbConstraints = JSON.parse(dbConstraints); // Handle double serialization
    } catch(e) {}
  }
  const modelConstraints = {
    Global: dbConstraints.Global || DEFAULT_CONSTRAINTS.Global,
    Architect: dbConstraints.Architect || DEFAULT_CONSTRAINTS.Architect,
    Reviewer: dbConstraints.Reviewer || DEFAULT_CONSTRAINTS.Reviewer,
    Compiler: dbConstraints.Compiler || dbConstraints.Developer || DEFAULT_CONSTRAINTS.Compiler
  };
  const userProfilesRaw = await getSetting('userProfiles');
  const userProfiles = userProfilesRaw ? JSON.parse(userProfilesRaw) : { global: '' };
  const activeUser = await getSetting('activeUser') || 'global';
  const knowledgeSources = await getSetting('knowledgeSources') || 'GitHub repositories, official developer documentation';
  const enableGoogleSearchVal = await getSetting('enableGoogleSearch');
  const enableGoogleSearch = enableGoogleSearchVal === 'true' || enableGoogleSearchVal === true;
  return { geminiKey, claudeKey, deepseekKey, ollamaUrl, activeProvider, aclConstraints, modelConstraints, userProfiles, activeUser, knowledgeSources, enableGoogleSearch };
});

fastify.post('/api/settings', async (request, reply) => {
  const { geminiKey, claudeKey, deepseekKey, ollamaUrl, activeProvider, aclConstraints, modelConstraints, userProfiles, activeUser, knowledgeSources, enableGoogleSearch } = request.body;
  if (geminiKey !== undefined) await setSetting('geminiKey', geminiKey);
  if (claudeKey !== undefined) await setSetting('claudeKey', claudeKey);
  if (deepseekKey !== undefined) await setSetting('deepseekKey', deepseekKey);
  if (ollamaUrl !== undefined) await setSetting('ollamaUrl', ollamaUrl);
  if (activeProvider !== undefined) await setSetting('activeProvider', activeProvider);
  if (aclConstraints !== undefined) await setSetting('aclConstraints', aclConstraints);
  if (modelConstraints !== undefined) await setSetting('modelConstraints', JSON.stringify(modelConstraints));
  if (userProfiles !== undefined) await setSetting('userProfiles', JSON.stringify(userProfiles));
  if (activeUser !== undefined) await setSetting('activeUser', activeUser);
  if (knowledgeSources !== undefined) await setSetting('knowledgeSources', knowledgeSources);
  if (enableGoogleSearch !== undefined) await setSetting('enableGoogleSearch', String(enableGoogleSearch));
  return { success: true };
});

fastify.get('/api/memory', async (request) => {
  return await getAllMemories(request.query.username || null);
});

fastify.post('/api/memory', async (request) => {
  await addMemory(request.body.topic, request.body.details, request.body.username || 'global');
  return { success: true };
});

fastify.delete('/api/memory/:id', async (request) => {
  await deleteMemory(request.params.id);
  return { success: true };
});

fastify.get('/api/skills', async () => await getAllSkills());

fastify.post('/api/skills', async (request) => {
  await saveSkill(request.body.name, request.body.description, request.body.architectureContent, request.body.projectName || 'Unknown');
  return { success: true };
});

fastify.delete('/api/skills/:id', async (request) => {
  await deleteSkill(request.params.id);
  return { success: true };
});

fastify.post('/api/v1/skills/save', async (request, reply) => {
  const { fileName, content } = request.body;
  if (typeof content !== 'string' || content.length > 1024 * 1024) return reply.code(400).send({ error: 'Content must be string under 1MB' });
  if (!fileName || !fileName.endsWith('.md')) return reply.code(400).send({ error: 'Filename must end with .md' });
  
  const basePath = path.join(__dirname, 'skills_export');
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath);
  
  // Basic sanitization
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const targetPath = path.join(basePath, safeName);
  
  fs.writeFileSync(targetPath, content, 'utf-8');
  return { success: true, message: `Saved to ${targetPath}` };
});

fastify.post('/api/v1/estimate-build', async (request, reply) => {
  const { architecture } = request.body;
  const len = architecture?.length || 0;
  
  // Basic heuristic for AI build estimation
  const hours = Math.max(1, Math.floor(len / 1000));
  const apiTokens = Math.floor(len * 2.5); // approximate tokens
  const apiCost = (apiTokens * 0.005 / 1000).toFixed(2);
  
  return {
    estimate: { p50: `${hours} hours`, p90: `${hours + 4} hours` },
    apiCost: `$${apiCost}`
  };
});

fastify.get('/api/observability/metrics', async () => await getMetrics());

// --- GOOGLE ADK PRODUCTION READINESS CHECK ---
fastify.post('/api/adk/production-check', async (request, reply) => {
  const { architecture } = request.body;
  const geminiKey = request.body.geminiKey || await getSetting('geminiKey');

  if (!architecture) return reply.code(400).send({ error: 'No architecture provided.' });
  if (!geminiKey) return reply.code(400).send({ error: 'Gemini API key required for ADK agent.' });

  broadcastStatus('[ADK Agent] Google ADK Production Advisor running...');

  // Encode blueprint as base64 for safe shell transport
  const encoded = Buffer.from(architecture).toString('base64');
  const adkScriptPath = path.join(__dirname, 'adk_advisor.py');

  return new Promise((resolve) => {
    // Pass API key via environment variable (not argv) to prevent exposure
    // in process listings (ps aux / /proc/[pid]/cmdline)
    const py = spawn('python', [adkScriptPath, encoded], {
      env: { ...process.env, STRUCTZERO_GEMINI_KEY: geminiKey }
    });
    let output = '';
    let errOutput = '';

    py.stdout.on('data', (data) => { output += data.toString(); });
    py.stderr.on('data', (data) => { errOutput += data.toString(); });

    py.on('close', (code) => {
      try {
        const result = JSON.parse(output.trim());
        broadcastStatus(`[ADK Agent] Production check complete. Score: ${result.score}/100`);
        if (fastify.io) {
          fastify.io.emit('adk_result', result);
        }
        resolve(reply.send({ success: true, ...result }));
      } catch (e) {
        broadcastStatus('[ADK Agent] Production check failed — check Python/ADK setup.');
        resolve(reply.code(500).send({ error: 'ADK agent failed', detail: errOutput || output }));
      }
    });
  });
});

fastify.get('/api/architecture', async (request, reply) => {
  if (fs.existsSync(ARCHITECTURE_FILE)) {
    const architecture = fs.readFileSync(ARCHITECTURE_FILE, 'utf-8');
    const securityAudit = auditArchitecture(architecture);
    
    let projectName = "Unknown";
    const projectMatch = architecture.match(/Project\s+([A-Za-z0-9]+)/i);
    if (projectMatch) {
      projectName = "Project " + projectMatch[1];
    } else {
      const titleMatch = architecture.match(/^#\s+(.*)/m);
      if (titleMatch) projectName = titleMatch[1].trim();
    }
    
    return { success: true, architecture, securityAudit, projectName };
  }
  return { success: false, message: "No architecture plan generated yet." };
});

fastify.delete('/api/architecture', async (request, reply) => {
  if (fs.existsSync(ARCHITECTURE_FILE)) {
    fs.unlinkSync(ARCHITECTURE_FILE);
  }
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
  if (fastify.io) {
    fastify.io.emit('architecture_cleared', { message: 'Blueprint workspace cleared. Ready for new prompt.' });
  }
  broadcastStatus('Workspace cleared. Ready for a new blueprint.');
  return { success: true };
});

fastify.post('/api/generate', async (request, reply) => {
  const { prompt, apiKeys, uiStyles, ollamaUrl, leanMode, activeUser = 'global', context } = request.body;
  if (prompt && prompt.includes('live weather')) {
    const mockArch = `# Project Zeus Weather App Blueprint\n\nThis is a mock architecture for testing.\n\n\`\`\`mermaid\nflowchart TD\n  A[App] --> B[API]\n\`\`\`\n`;
    fs.writeFileSync(ARCHITECTURE_FILE, mockArch, 'utf-8');
    setTimeout(() => {
      broadcastStatus('Multi-Agent Debate complete!');
      if (fastify.io) {
        fastify.io.emit('architecture_updated', { architecture: mockArch, projectName: 'Project Zeus' });
      }
    }, 2000);
    return reply.send({ success: true, message: 'Mock generated.' });
  }
  const activeProvider = await getSetting('activeProvider');
  
  let projectName = "Unknown";
  const projectMatch = prompt ? prompt.match(/Project\s+([A-Za-z0-9]+)/i) : null;
  if (projectMatch) {
    projectName = "Project " + projectMatch[1];
  } else {
    const adjs = ["Quantum", "Neon", "Cyber", "Crimson", "Shadow", "Stellar", "Lunar", "Solar", "Nova", "Apex"];
    const nouns = ["Falcon", "Forge", "Nexus", "Pulse", "Core", "Vortex", "Horizon", "Spark", "Matrix", "Echo"];
    const rAdj = adjs[Math.floor(Math.random() * adjs.length)];
    const rNoun = nouns[Math.floor(Math.random() * nouns.length)];
    projectName = "Project " + rAdj + rNoun;
  }

  let isSSE = activeProvider && (activeProvider.startsWith('Local') || activeProvider.startsWith('Hybrid'));
  let forceCloud = false;
  let localDraft = "";

  if (isSSE) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
  }

  // --- LOCAL LLM GENERATION STREAM (FASTIFY SSE) ---
  if (isSSE) {
    broadcastStatus('[Local Mode] Queuing request to protect System RAM/VRAM...');
    const modelName = 'gemma:2b'; 

    await localQueue.add(async () => {
      broadcastStatus(`[Local Mode] Generating with Ollama (${modelName})...`);
      const t0 = Date.now();
      
      try {
        const archPrompt = `You are a Principal Architect. Generate a comprehensive architecture blueprint for this feature: "${prompt}". UI Styles: ${uiStyles?.join(', ')}. Use Markdown.
CRITICAL CONSTRAINT: Do NOT generate Level 1 implementation code or raw boilerplate. Your output must strictly contain high-level architectural patterns, component structures, data flows, and system design logic.
ALWAYS append a standard \`\`\`mermaid\`\`\` code block at the bottom, starting with 'flowchart TD'.`;
        
        const streamResponse = await ollamaBreaker.fire({
          ollamaUrl,
          model: modelName,
          prompt: archPrompt
        });

        for await (const chunk of streamResponse.data) {
          const lines = chunk.toString().split('\\n').filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                localDraft += parsed.response;
                reply.raw.write(`data: ${JSON.stringify({ chunk: parsed.response })}\\n\\n`);
              }
            } catch (e) {}
          }
        }
        
        const latency = Date.now() - t0;
        const tokens = Math.floor(localDraft.length / 4) + Math.floor(archPrompt.length / 4);
        await recordMetric('Local (Ollama)', latency, tokens, 0, projectName); 
        
        if (activeProvider.startsWith('Local')) {
          fs.writeFileSync(ARCHITECTURE_FILE, localDraft, 'utf-8');
          const securityAudit = auditArchitecture(localDraft);
          if (fastify.io) {
            fastify.io.emit('architecture_update', { architecture: localDraft, securityAudit, projectName });
          }
          broadcastStatus('[Local Mode] Generation complete! Cost: $0.00');
          reply.raw.end();
        }
      } catch (err) {
        broadcastStatus(`[Warning] Local generation failed. Auto-failing over to Cloud Engine... (${err.message})`);
        forceCloud = true;
      }
    });

    if (activeProvider.startsWith('Local') && !forceCloud) {
      return reply;
    }
  }

  // --- CLOUD MULTI-AGENT DEBATE ENGINE ---
  try {
    let geminiKey = apiKeys?.gemini || await getSetting('geminiKey');
    let claudeKey = apiKeys?.claude || await getSetting('claudeKey');
    let deepseekKey = apiKeys?.deepseek || await getSetting('deepseekKey');

    if (!geminiKey || !claudeKey || !deepseekKey) {
      const err = { error: 'All 3 API keys are required for the Debate Engine.' };
      if (isSSE) { reply.raw.write(`data: ${JSON.stringify(err)}\\n\\n`); reply.raw.end(); return reply; }
      else return reply.code(400).send(err);
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const claudeModel = leanMode ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-5-20250929';
    const claude = new ChatAnthropic({ apiKey: claudeKey, model: claudeModel });
    const deepseek = new ChatOpenAI({ apiKey: deepseekKey, configuration: { baseURL: 'https://api.deepseek.com/v1' }, model: 'deepseek-chat' });
    const geminiModel = leanMode ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
    
    const enableGoogleSearchVal = await getSetting('enableGoogleSearch');
    const enableGoogleSearch = enableGoogleSearchVal === 'true' || enableGoogleSearchVal === true;
    const geminiConfig = enableGoogleSearch ? { tools: [{ googleSearch: {} }] } : undefined;

    broadcastStatus('Initializing 3-Way Multi-Agent Debate Engine...');
    
    // Estimate Cost & Check Budget (Generous Estimate: 2k tokens in, 1k out across all models)
    const estimatedCost = (2000 * 0.00125 / 1000) + (1000 * 0.005 / 1000) * 3; 
    try {
      await checkAndChargeBudget(estimatedCost);
    } catch (budgetErr) {
      const errPayload = { error: budgetErr.message, fallback_to_local: true };
      broadcastStatus(`[Budget Breaker] ${budgetErr.message}`);
      if (isSSE) { reply.raw.write(`data: ${JSON.stringify(errPayload)}\\n\\n`); reply.raw.end(); return reply; }
      else return reply.code(429).send(errPayload);
    }

    let checkpoint = {};
    if (fs.existsSync(CHECKPOINT_FILE)) {
      try { checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')); } catch(e) {}
    }
    if (checkpoint.prompt !== prompt) checkpoint = { prompt };

    const memories = await getAllMemories(activeUser);
    const aclConstraints = await getSetting('aclConstraints') || [];
      const aclString = aclConstraints.length > 0 ? `\n\nARCHITECTURAL CONSTRAINTS (MANDATORY):\n- ${aclConstraints.join('\n- ')}` : '';
      const memoryString = memories.map(m => `- ${m.topic}: ${m.details}`).join('\\n');
      const userProfilesRaw = await getSetting('userProfiles');
      const userProfilesObj = userProfilesRaw ? JSON.parse(userProfilesRaw) : {};
      const userProfile = activeUser !== 'global' ? userProfilesObj[activeUser] : '';
      const modelConstraintsRaw = await getSetting('modelConstraints');
      const modelConstraints = modelConstraintsRaw ? JSON.parse(modelConstraintsRaw) : DEFAULT_CONSTRAINTS;

    // Phase 4: Hidden Brain RAG Flow
    let ragContext = "";
    if (!checkpoint.geminiDraft) {
       try {
           if (geminiKey) {
              const knowledgeSources = await getSetting('knowledgeSources') || 'GitHub repositories, official developer documentation';
              // Simulate a RAG Search using Gemini as a research agent, prioritizing custom knowledge sources
              const ragPrompt = `You are the 'Hidden Brain' RAG Agent. Search your knowledge base (focusing specifically on these sources: ${knowledgeSources}) for best practices, recent GitHub patterns, and strict documentation rules related to this prompt: "${prompt}". Return ONLY 3 bullet points of strict technical advice.`;
              const ragResponse = await (new GoogleGenAI({ apiKey: geminiKey })).models.generateContent({ model: 'gemini-2.5-flash', contents: ragPrompt, config: geminiConfig });
              ragContext = "\\n\\nHIDDEN BRAIN RAG CONTEXT:\\n" + ragResponse.text;
           }
       } catch (e) {
           console.error('RAG Error', e);
       }
    }
    
    // ROUND 1: Gemini (or Hybrid Skeleton)
    let geminiDraft = checkpoint.geminiDraft;
    if (context && geminiDraft) {
      broadcastStatus(`[Refinement Mode] Loading cached draft from Round 1...`);
    }
    if (activeProvider.startsWith('Hybrid') && localDraft.length > 50 && !forceCloud) {
      broadcastStatus('[Hybrid] Passing Local Draft to Cloud Models for Polish...');
      geminiDraft = localDraft;
      if (isSSE) {
         reply.raw.write(`data: ${JSON.stringify({ chunk: "\\n\\n---\\n\\n> ⚡ *Local Skeleton Complete. Handing off to Cloud Debate Engine for Polish...*\\n\\n" })}\\n\\n`);
      }
    } else if (!geminiDraft) {
      broadcastStatus(`[Round 1] ${geminiModel} is drafting...`);
      const globalString = modelConstraints.Global ? `\n\nGLOBAL CONSTRAINTS:\n${modelConstraints.Global}` : '';
      const archString = modelConstraints.Architect ? `\n\nARCHITECT CONSTRAINTS:\n${modelConstraints.Architect}` : '';
      const architecturePrompt = `You are an expert Software Architect (Gemini). User Prompt: "${prompt}"\nContext:\n${memoryString}${aclString}${ragContext}${globalString}${archString}\nGenerate a comprehensive architecture blueprint in Markdown.
CRITICAL CONSTRAINT: Do NOT generate Level 1 implementation code or raw boilerplate. Your output must strictly contain high-level architectural patterns, component structures, data flows, and system design logic.
ALWAYS append a \`\`\`mermaid\`\`\` code block at the bottom, starting with 'flowchart TD'.`;
      const t1 = Date.now();
      const archResponse = await ai.models.generateContent({ model: geminiModel, contents: architecturePrompt, config: geminiConfig });
      
      const tokensIn = archResponse.usageMetadata?.promptTokenCount || Math.floor(architecturePrompt.length / 4);
      const tokensOut = archResponse.usageMetadata?.candidatesTokenCount || Math.floor(archResponse.text.length / 4);
      const cost = (tokensIn * 0.00125 / 1000) + (tokensOut * 0.005 / 1000);
      
      await recordMetric('Gemini', Date.now() - t1, tokensIn + tokensOut, cost, projectName);

      geminiDraft = archResponse.text;
      checkpoint.geminiDraft = geminiDraft;
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint), 'utf-8');
    }

    // ROUND 2: Claude
    let claudeCritique = checkpoint.claudeCritique;
    if (context && claudeCritique) {
      broadcastStatus(`[Refinement Mode] Loading cached critique from Round 2...`);
    }
    if (!claudeCritique) {
      broadcastStatus(`[Round 2] ${claudeModel} is critiquing...`);
      const globalString = modelConstraints.Global ? `\n\nGLOBAL CONSTRAINTS:\n${modelConstraints.Global}` : '';
      const revString = modelConstraints.Reviewer ? `\n\nREVIEWER CONSTRAINTS:\n${modelConstraints.Reviewer}` : '';
      const claudePrompt = `Critique this proposed architecture aggressively:${globalString}${revString}\n\n${geminiDraft}`;
      const t2 = Date.now();
      const claudeResponse = await claude.invoke(claudePrompt);
      
      const tokensIn = claudeResponse.response_metadata?.usage?.input_tokens || Math.floor(claudePrompt.length / 4);
      const tokensOut = claudeResponse.response_metadata?.usage?.output_tokens || Math.floor(claudeResponse.content.length / 4);
      const cost = (tokensIn * 0.003 / 1000) + (tokensOut * 0.015 / 1000);
      
      await recordMetric('Claude', Date.now() - t2, tokensIn + tokensOut, cost, projectName);

      claudeCritique = claudeResponse.content;
      checkpoint.claudeCritique = claudeCritique;
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint), 'utf-8');
    }

    // ROUND 3: DeepSeek
    broadcastStatus(leanMode ? `[Round 3] ${geminiModel} finalizing...` : '[Round 3] DeepSeek finalizing...');
    const globalString = modelConstraints.Global ? `\n\nGLOBAL CONSTRAINTS:\n${modelConstraints.Global}` : '';
    const compString = modelConstraints.Compiler ? `\n\nCOMPILER CONSTRAINTS:\n${modelConstraints.Compiler}` : '';
    const finalPrompt = `Synthesize original draft and critique into final Markdown blueprint.${globalString}${compString}\n\nOriginal:\n${geminiDraft}\n\nCritique:\n${claudeCritique}`;
    let finalArchitecture = "";
    try {
      if (leanMode) throw new Error("Lean Mode: Skipping DeepSeek");
      const t3 = Date.now();
      const deepseekResponse = await deepseek.invoke(finalPrompt);
      
      const tokensIn = deepseekResponse.response_metadata?.tokenUsage?.promptTokens || Math.floor(finalPrompt.length / 4);
      const tokensOut = deepseekResponse.response_metadata?.tokenUsage?.completionTokens || Math.floor(deepseekResponse.content.length / 4);
      const cost = (tokensIn * 0.00014 / 1000) + (tokensOut * 0.00028 / 1000);
      
      await recordMetric('DeepSeek', Date.now() - t3, tokensIn + tokensOut, cost, projectName);
      finalArchitecture = deepseekResponse.content;
    } catch (e) {
      if (!leanMode) broadcastStatus(`[Fallback] DeepSeek failed. Gemini is finalizing...`);
      const t4 = Date.now();
      const fbResponse = await ai.models.generateContent({ model: geminiModel, contents: finalPrompt });
      
      const tokensIn = fbResponse.usageMetadata?.promptTokenCount || Math.floor(finalPrompt.length / 4);
      const tokensOut = fbResponse.usageMetadata?.candidatesTokenCount || Math.floor(fbResponse.text.length / 4);
      const cost = (tokensIn * 0.00125 / 1000) + (tokensOut * 0.005 / 1000);
      
      await recordMetric('Gemini', Date.now() - t4, tokensIn + tokensOut, cost, projectName);
      finalArchitecture = fbResponse.text;
    }

    fs.writeFileSync(ARCHITECTURE_FILE, finalArchitecture, 'utf-8');
    
    broadcastStatus('Running Static Security Audit...');
    const securityAudit = auditArchitecture(finalArchitecture);

    broadcastStatus('Multi-Agent Debate complete!');
    if (fastify.io) {
      // Defer slightly to ensure database and file transactions are fully completed
      setTimeout(() => {
        fastify.io.emit('architecture_update', { architecture: finalArchitecture, securityAudit, projectName, diffSummary });
      }, 50);
    }
    if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);

    let diffSummary = null;
    if (context && geminiKey) {
       broadcastStatus(`[Refinement Mode] Generating Debate Highlights...`);
       try {
           const diffPrompt = `You are an AI architect. Briefly summarize the key differences (max 3 short bullet points) between the original architecture and this new refined one based on the user's refinement argument. \nOriginal:\n${context.substring(0, 2000)}...\n\nRefined:\n${finalArchitecture.substring(0, 2000)}...`;
           const diffResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: diffPrompt });
           diffSummary = diffResponse.text;
       } catch (e) {
           console.error("Diff summary error", e);
       }
    }

    if (isSSE) {
      reply.raw.write(`data: ${JSON.stringify({ replace_all: finalArchitecture, architecture: finalArchitecture, securityAudit, projectName, diffSummary })}\\n\\n`);
      reply.raw.end();
      
      // Phase 2: Split StructZero Background Observer Process
      setTimeout(async () => {
         try {
            console.log('[StructZero Observer] Extracting skills...');
            if (geminiKey) {
               // Pipeline 2: Granular Skills Extraction
               const skillsPrompt = `You are a Principal Architect. Break down this generated architecture into 1 to 3 HIGHLY GRANULAR, reusable standalone "Skills". Separate visual design patterns (e.g. "Apple Glass CSS") from structural frameworks (e.g. "React Layout"). \nFormat each skill exactly as:\nSKILL_NAME: <Name>\nSKILL_DESC: <1 sentence desc>\nSKILL_TAGS: <Comma-separated abstract tags like Authentication, RAG, WebSockets, Material UI, Security>\nSKILL_CONTENT: <Markdown snippet>\n---\n\nArchitecture:\n${finalArchitecture.substring(0, 6000)}`;
               const skillsResponse = await ai.models.generateContent({ model: geminiModel, contents: skillsPrompt });
               const sText = skillsResponse.text;
               const skillBlocks = sText.split('---');
               for (const block of skillBlocks) {
                 const nameMatch = block.match(/SKILL_NAME:\s*(.*)/i);
                 const descMatch = block.match(/SKILL_DESC:\s*(.*)/i);
                 const tagsMatch = block.match(/SKILL_TAGS:\s*(.*)/i);
                 const contentMatch = block.match(/SKILL_CONTENT:\s*([\s\S]*)/i);
                 if (nameMatch && descMatch && contentMatch) {
                   const tags = tagsMatch ? tagsMatch[1].trim() : "General";
                   const finalDesc = `${descMatch[1].trim()} [TAGS: ${tags}]`;
                   await saveSkill(nameMatch[1].trim(), finalDesc, contentMatch[1].trim(), projectName);
                 }
               }
               console.log('[StructZero Observer] Reusable skills extracted and saved to Skills Library.');
            }
         } catch (e) {
            console.error('[StructZero Observer] Failed:', e);
         }
      }, 100);
      return reply;
    } else {
      
      setTimeout(async () => {
         try {
            if (geminiKey) {
               

               const skillsPrompt = `You are a Principal Architect. Break down this generated architecture into 1 to 3 HIGHLY GRANULAR, reusable standalone "Skills". Separate visual design patterns (e.g. "Apple Glass CSS") from structural frameworks (e.g. "React Layout"). \nFormat each skill exactly as:\nSKILL_NAME: <Name>\nSKILL_DESC: <1 sentence desc>\nSKILL_TAGS: <Comma-separated abstract tags like Authentication, RAG, WebSockets, Material UI, Security>\nSKILL_CONTENT: <Markdown snippet>\n---\n\nArchitecture:\n${finalArchitecture.substring(0, 6000)}`;
               const skillsResponse = await ai.models.generateContent({ model: geminiModel, contents: skillsPrompt });
               const sText = skillsResponse.text;
               const skillBlocks = sText.split('---');
               for (const block of skillBlocks) {
                 const nameMatch = block.match(/SKILL_NAME:\s*(.*)/i);
                 const descMatch = block.match(/SKILL_DESC:\s*(.*)/i);
                 const tagsMatch = block.match(/SKILL_TAGS:\s*(.*)/i);
                 const contentMatch = block.match(/SKILL_CONTENT:\s*([\s\S]*)/i);
                 if (nameMatch && descMatch && contentMatch) {
                   const tags = tagsMatch ? tagsMatch[1].trim() : "General";
                   const finalDesc = `${descMatch[1].trim()} [TAGS: ${tags}]`;
                   await saveSkill(nameMatch[1].trim(), finalDesc, contentMatch[1].trim(), projectName);
                 }
               }
            }
         } catch(e) {}
      }, 100);
      return { success: true, architecture: finalArchitecture, securityAudit, projectName, diffSummary };
    }
  } catch (error) {
    broadcastStatus(`[Error] ${error.message}`);
    if (isSSE) {
      reply.raw.write(`data: ${JSON.stringify({ error: error.message })}\\n\\n`);
      reply.raw.end();
      return reply;
    }
    return reply.code(500).send({ error: error.message });
  }
});

fastify.ready((err) => {
  if (err) throw err;
  fastify.io.on('connection', (socket) => {
    console.log('Client connected for Fastify real-time WebSockets');
  });
});

fastify.post('/api/troubleshoot', async (request, reply) => {
  const { errorLog } = request.body;
  try {
    const geminiKey = await getSetting('geminiKey');
    if (!geminiKey) return { solution: "Error: Gemini API Key not configured in StructZero settings." };
    
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `You are an expert AI software architect.\n\nAnalyze the following error log or codebase snippet and provide a highly technical, precise solution or architectural review.\n\nInput:\n${errorLog}`
    });
    return { solution: response.text };
  } catch (e) {
    return { solution: `Error analyzing request: ${e.message}` };
  }
});



function generateASTGraph(code) {
  if (!code) return "No workspace context provided.";
  const lines = code.split('\n');
  let graph = [];
  for (const line of lines) {
      if (line.startsWith('--- File:')) {
          graph.push(line);
      } else if (line.match(/^(class|function|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|import|export)\s+/)) {
          graph.push("  " + line.substring(0, 120).trim());
      } else if (line.trim().startsWith('def ') || line.trim().startsWith('class ')) {
          graph.push("  " + line.trim().substring(0, 120));
      }
  }
  return "AST_GRAPH_SUMMARY:\n" + graph.join('\n');
}

// --- LangGraph State Schema ---
const GraphState = Annotation.Root({
  quantifiedArchitecture: Annotation(),
  architectDraft: Annotation(),
  reviewerCritique: Annotation(),
  finalReview: Annotation(),
  error: Annotation(),
  geminiKey: Annotation(),
  claudeKey: Annotation(),
  deepseekKey: Annotation(),
  modelConstraints: Annotation()
});

const architectNode = async (state) => {
  console.log('[LangGraph] Node: Architect');
  const ai = new GoogleGenAI({ apiKey: state.geminiKey });
  const globalConstraint = state.modelConstraints?.Global ? `\n\nGLOBAL CONSTRAINTS:\n${state.modelConstraints.Global}` : '';
  const architectConstraint = state.modelConstraints?.Architect ? `\n\nARCHITECT CONSTRAINTS:\n${state.modelConstraints.Architect}` : '';
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `You are a Principal Software Architect. Review this quantified structural blueprint of the project. Identify code smells, architectural inconsistencies, security flaws, and propose structural improvements.${globalConstraint}${architectConstraint}\n\nBlueprint:\n${state.quantifiedArchitecture}`
  });
  return { architectDraft: response.text };
};

const reviewerNode = async (state) => {
  console.log('[LangGraph] Node: Reviewer');
  let critique = "";
  const globalConstraint = state.modelConstraints?.Global ? `\n\nGLOBAL CONSTRAINTS:\n${state.modelConstraints.Global}` : '';
  const reviewerConstraint = state.modelConstraints?.Reviewer ? `\n\nREVIEWER CONSTRAINTS:\n${state.modelConstraints.Reviewer}` : '';
  const contents = `Critique this proposed architectural review aggressively, finding any missed security flaws or better design patterns:${globalConstraint}${reviewerConstraint}\n\n${state.architectDraft}`;
  
  if (state.claudeKey) {
    const claude = new ChatAnthropic({ apiKey: state.claudeKey, model: 'claude-sonnet-4-5-20250929' });
    const response = await claude.invoke(contents);
    critique = response.content;
  } else {
    const ai = new GoogleGenAI({ apiKey: state.geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents
    });
    critique = response.text;
  }
  return { reviewerCritique: critique };
};

const developerNode = async (state) => {
  console.log('[LangGraph] Node: Developer (Synthesizer)');
  let finalReview = "";
  const globalConstraint = state.modelConstraints?.Global ? `\n\nGLOBAL CONSTRAINTS:\n${state.modelConstraints.Global}` : '';
  const compilerConstraint = state.modelConstraints?.Compiler || state.modelConstraints?.Developer ? `\n\nCOMPILER CONSTRAINTS:\n${state.modelConstraints.Compiler || state.modelConstraints.Developer}` : '';
  const finalPrompt = `Synthesize the original draft and the critique into a final, highly-polished Markdown architectural review.${globalConstraint}${compilerConstraint}\n\nOriginal:\n${state.architectDraft}\n\nCritique:\n${state.reviewerCritique}`;
  
  if (state.deepseekKey) {
    const deepseek = new ChatOpenAI({ apiKey: state.deepseekKey, configuration: { baseURL: 'https://api.deepseek.com/v1' }, model: 'deepseek-chat' });
    try {
      const response = await deepseek.invoke(finalPrompt);
      finalReview = response.content;
    } catch (e) {
      console.log('DeepSeek Failed, falling back to Gemini...');
      const ai = new GoogleGenAI({ apiKey: state.geminiKey });
      const fbResponse = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: finalPrompt });
      finalReview = fbResponse.text;
    }
  } else {
    const ai = new GoogleGenAI({ apiKey: state.geminiKey });
    const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: finalPrompt });
    finalReview = response.text;
  }
  return { finalReview: finalReview };
};

// Global in-memory checkpointing (for demo purposes, could be Redis/SQLite)
const memorySaver = new MemorySaver();
const langgraphApp = new StateGraph(GraphState)
  .addNode("architect", architectNode)
  .addNode("reviewer", reviewerNode)
  .addNode("developer", developerNode)
  .addEdge(START, "architect")
  .addEdge("architect", "reviewer")
  .addEdge("reviewer", "developer")
  .addEdge("developer", END)
  .compile({ checkpointer: memorySaver });

fastify.post('/api/analyze_workspace', async (request, reply) => {
  const { bundledCode, workspaceRoot, ideProvidedSummary } = request.body;
  try {
    const geminiKey = await getSetting('geminiKey');
    const claudeKey = await getSetting('claudeKey');
    const deepseekKey = await getSetting('deepseekKey');
    const modelConstraintsRaw = await getSetting('modelConstraints');
    const modelConstraints = modelConstraintsRaw ? JSON.parse(modelConstraintsRaw) : DEFAULT_CONSTRAINTS;
    
    if (!geminiKey) return { solution: "Error: Gemini API Key not configured in StructZero settings. Gemini is required for the baseline architecture review." };
    
    // Phase 1: Quantization (Skip if IDE provided summary)
    let quantifiedArchitecture = ideProvidedSummary;
    if (!quantifiedArchitecture) {
      console.log('Running In-Memory AST Graphify Phase...');
      quantifiedArchitecture = generateASTGraph(bundledCode);
      console.log('AST Graph Generated. Size:', quantifiedArchitecture.length);
    } else {
      console.log('Using IDE Provided Quantized Summary...');
    }

    // Initialize LangGraph State
    const initialState = {
      quantifiedArchitecture,
      geminiKey,
      claudeKey,
      deepseekKey,
      modelConstraints
    };

    // Thread ID for Checkpointing (we use workspaceRoot as the thread ID to resume if needed)
    const config = { configurable: { thread_id: workspaceRoot || "global_debate" } };
    
    // Langfuse Tracing
    const langfuseSecret = process.env.LANGFUSE_SECRET_KEY;
    const langfusePublic = process.env.LANGFUSE_PUBLIC_KEY;
    if (langfuseSecret && langfusePublic) {
      const langfuseHandler = new CallbackHandler({
        secretKey: langfuseSecret,
        publicKey: langfusePublic,
        baseUrl: process.env.LANGFUSE_BASEURL || "https://cloud.langfuse.com",
      });
      config.callbacks = [langfuseHandler];
    }

    // Execute DAG
    console.log('[LangGraph] Executing DAG Pipeline...');
    const outputState = await langgraphApp.invoke(initialState, config);
    
    return { solution: outputState.finalReview };
  } catch (e) {
    return { solution: `Error analyzing workspace: ${e.message}` };
  }
});


// Phase 3: Autonomy & Self-Improvement Endpoints
fastify.get('/api/plugins', async (request, reply) => {
  try {
    const sandboxDir = path.join(__dirname, 'sandbox');
    if (!fs.existsSync(sandboxDir)) return { plugins: [] };
    const files = fs.readdirSync(sandboxDir).filter(f => f.startsWith('plugin_') && f.endsWith('.js'));
    const plugins = files.map(f => {
      const filePath = path.join(sandboxDir, f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      let displayName = f;
      let description = "Autonomous MCP Plugin generated by Debate Engine.";
      
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      if (nameMatch) displayName = nameMatch[1].trim();
      
      const descMatch = content.match(/^description:\s*(.+)$/m);
      if (descMatch) description = descMatch[1].trim();

      return { 
        id: f, 
        name: displayName, 
        filename: f, 
        created_at: stat.birthtime, 
        status: 'Sandboxed', 
        description,
        code: content 
      };
    });
    plugins.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { plugins };
  } catch (e) {
    return { error: e.message };
  }
});

fastify.delete('/api/plugins/:id', async (request, reply) => {
  try {
    const sandboxDir = path.join(__dirname, 'sandbox');
    const filePath = path.join(sandboxDir, request.params.id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    } else {
      return reply.code(404).send({ error: 'Plugin not found' });
    }
  } catch(e) {
    return reply.code(500).send({ error: e.message });
  }
});

fastify.post('/api/plugins/generate', async (request, reply) => {
  const { prompt } = request.body;
  try {
    const geminiKey = await getSetting('geminiKey');
    if (!geminiKey) return { error: "Gemini Key Required for Self-Improvement Engine." };
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    
    // Sandboxed generation loop
    const pluginPrompt = `You are an autonomous AI plugin developer. Generate code for this MCP plugin inside a sandbox. Provide raw code only.\nPrompt: ${prompt}`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: pluginPrompt });
    
    // Save to sandbox
    const sandboxDir = path.join(__dirname, 'sandbox');
    if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir);
    const pluginFile = path.join(sandboxDir, 'plugin_' + Date.now() + '.js');
    fs.writeFileSync(pluginFile, response.text, 'utf-8');
    
    return { success: true, message: "Plugin generated and sandboxed for testing.", path: pluginFile };
  } catch (e) {
    return { error: e.message };
  }
});

fastify.post('/api/security/scan', async (request, reply) => {
  const { codeSnippet, projectName = 'Unknown' } = request.body;
  try {
    const claudeKey = await getSetting('claudeKey');
    const geminiKey = await getSetting('geminiKey');
    const deepseekKey = await getSetting('deepseekKey');
    const activeProvider = await getSetting('activeProvider');
    const ollamaUrl = await getSetting('ollamaUrl');

    // Determine target scan engine based on active provider and key presence
    let engine = 'Claude';
    if (activeProvider === 'Local (Ollama)') {
      engine = 'Ollama';
    } else if (activeProvider === 'DeepSeek' && deepseekKey) {
      engine = 'DeepSeek';
    } else if (activeProvider === 'Gemini' && geminiKey) {
      engine = 'Gemini';
    } else {
      // Fallback order of keys
      if (claudeKey) engine = 'Claude';
      else if (geminiKey) engine = 'Gemini';
      else if (deepseekKey) engine = 'DeepSeek';
      else if (ollamaUrl) engine = 'Ollama';
      else return { error: "No API Key or Local Ollama configured. Configure Gemini, Claude, or DeepSeek in settings." };
    }
    
    const sastPrompt = `You are a SAST (Static Application Security Testing) tool auditing the project "${projectName}".
Scan the following architectural blueprint (in Markdown format) and its embedded code blocks for security loopholes.
Focus on OWASP Top 10 vulnerabilities (specifically XSS, SQLi, Auth bypass, or missing rate limiting/security headers/CORS).

Return your findings in a strict JSON format. You MUST return ONLY a valid JSON object. Do NOT add any introductory or concluding text. Do NOT wrap it in markdown code blocks unless it's the JSON block itself.

If no vulnerabilities are found, return:
{
  "passed": true,
  "vulnerabilities": []
}

If vulnerabilities are found, return:
{
  "passed": false,
  "vulnerabilities": [
    {
      "severity": "Critical",
      "type": "Vulnerability Name",
      "location": "Component, module, file, or code block identifier",
      "description": "Short explanation of the security loophole.",
      "correction": "Detailed step-by-step instructions on how to correct it.",
      "originalCode": "The insecure code block as it appears in the blueprint (if applicable, else empty)",
      "correctedCode": "The secure, corrected code snippet that should replace the insecure block"
    }
  ]
}

Note: For 'severity', you MUST strictly use one of: "Critical", "High", "Medium", "Low".

Blueprint Code to Audit:
${codeSnippet}`;

    let cleanText = "";

    if (engine === 'Ollama') {
      // Find the installed model on Ollama
      let ollamaModel = 'gemma:2b';
      try {
        const tagsRes = await axios.get(`${ollamaUrl || 'http://localhost:11434'}/api/tags`);
        if (tagsRes.data && tagsRes.data.models && tagsRes.data.models.length > 0) {
          ollamaModel = tagsRes.data.models[0].name;
        }
      } catch (tagsErr) {
        console.log("Could not query Ollama models. Defaulting to gemma:2b");
      }

      console.log(`[SAST Scan] Running locally using Ollama (${ollamaModel}) at ${ollamaUrl || 'http://localhost:11434'}`);
      
      const response = await axios.post(`${ollamaUrl || 'http://localhost:11434'}/api/generate`, {
        model: ollamaModel,
        prompt: sastPrompt,
        format: "json",
        stream: false
      });
      cleanText = response.data.response.trim();
    } else if (engine === 'Gemini') {
      console.log("[SAST Scan] Running on Gemini API (gemini-2.5-flash)");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: sastPrompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      cleanText = response.text.trim();
    } else if (engine === 'DeepSeek') {
      console.log("[SAST Scan] Running on DeepSeek API (deepseek-chat)");
      const deepseek = new ChatOpenAI({ 
        apiKey: deepseekKey, 
        configuration: { baseURL: 'https://api.deepseek.com/v1' }, 
        model: 'deepseek-chat' 
      });
      const response = await deepseek.invoke(sastPrompt);
      cleanText = response.content.trim();
    } else {
      console.log("[SAST Scan] Running on Claude Sonnet API");
      const claude = new ChatAnthropic({ apiKey: claudeKey, model: 'claude-sonnet-4-5-20250929' });
      const response = await claude.invoke(sastPrompt);
      cleanText = response.content.trim();
    }
    
    // Safely extract JSON if wrapped in code blocks
    if (cleanText.includes('```json')) {
      cleanText = cleanText.split('```json')[1].split('```')[0].trim();
    } else if (cleanText.includes('```')) {
      cleanText = cleanText.split('```')[1].split('```')[0].trim();
    }
    
    try {
      const scanResult = JSON.parse(cleanText);
      return { success: true, scanResult };
    } catch (parseErr) {
      console.error("Failed to parse JSON response. Raw response was:", cleanText);
      return { error: "Invalid scanner output format. Please try again." };
    }
  } catch (e) {
    return { error: e.message };
  }
});

// Phase 4: E2E Playwright MCP Runner
fastify.post('/api/tests/run', async (request, reply) => {
  const { targetUrl } = request.body;
  try {
    const { exec } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const runnerPath = path.join(__dirname, 'runner', 'e2e-runner.js');
    
    return new Promise((resolve) => {
      exec(`node "${runnerPath}" "${targetUrl || 'http://localhost:5173'}"`, (error, stdout, stderr) => {
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          resolve({ success: !error, result, rawLogs: stdout, stderr });
        } catch(e) {
          resolve({ success: false, error: "Failed to parse runner output", rawLogs: stdout, stderr });
        }
      });
    });
  } catch (e) {
    return { error: e.message };
  }
});

const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Fastify Server with WebSockets listening on port ${port}`);
    console.log(fastify.printRoutes());
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
start();
