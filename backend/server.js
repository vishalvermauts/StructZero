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
import { getSetting, setSetting, getAllMemories, addMemory, deleteMemory, getAllSkills, saveSkill, logMetric, getMetrics } from './database.js';
import CircuitBreaker from 'opossum';
import PQueue from 'p-queue';
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');

// --- WALLET BUDGET CIRCUIT BREAKER ---
const BUDGET_LIMIT = 5.00; // Hardcoded $5.00 daily limit for safety

async function checkAndChargeBudget(estimatedCost) {
  const today = new Date().toISOString().split('T')[0];
  const spendKey = `spend:${today}`;
  
  const pipeline = redis.pipeline();
  const results = await pipeline.get(spendKey).exec();
  const currentSpend = parseFloat(results[0][1]) || 0;

  if (currentSpend + estimatedCost > BUDGET_LIMIT) {
    throw new Error(`Budget Exceeded! Daily limit is $${BUDGET_LIMIT}. Current spend: $${currentSpend.toFixed(2)}.`);
  }

  await redis.incrbyfloat(spendKey, estimatedCost);
  
  // Expire at midnight
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

// P-Queue to ensure local Ollama doesn't run out of VRAM/RAM (Concurrency: 1)
const localQueue = new PQueue({ concurrency: 1 });

// Opossum Circuit Breaker for Local Ollama
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

const recordMetric = async (provider, latencyMs, tokens, cost) => {
  await logMetric(provider, latencyMs, tokens, cost);
  if (fastify.io) {
    fastify.io.emit('metric_update', { provider, latency_ms: latencyMs, tokens, cost });
  }
};

// --- Endpoints ---

fastify.get('/api/settings', async (request, reply) => {
  const geminiKey = await getSetting('geminiKey');
  const claudeKey = await getSetting('claudeKey');
  const deepseekKey = await getSetting('deepseekKey');
  const ollamaUrl = await getSetting('ollamaUrl') || 'http://localhost:11434';
  const activeProvider = await getSetting('activeProvider') || 'Gemini';
  return { geminiKey, claudeKey, deepseekKey, ollamaUrl, activeProvider };
});

fastify.post('/api/settings', async (request, reply) => {
  const { geminiKey, claudeKey, deepseekKey, ollamaUrl, activeProvider } = request.body;
  if (geminiKey !== undefined) await setSetting('geminiKey', geminiKey);
  if (claudeKey !== undefined) await setSetting('claudeKey', claudeKey);
  if (deepseekKey !== undefined) await setSetting('deepseekKey', deepseekKey);
  if (ollamaUrl !== undefined) await setSetting('ollamaUrl', ollamaUrl);
  if (activeProvider !== undefined) await setSetting('activeProvider', activeProvider);
  return { success: true };
});

fastify.get('/api/memory', async () => await getAllMemories());

fastify.post('/api/memory', async (request) => {
  await addMemory(request.body.topic, request.body.details);
  return { success: true };
});

fastify.delete('/api/memory/:id', async (request) => {
  await deleteMemory(request.params.id);
  return { success: true };
});

fastify.get('/api/skills', async () => await getAllSkills());

fastify.post('/api/skills', async (request) => {
  await saveSkill(request.body.name, request.body.description, request.body.architectureContent);
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

fastify.post('/api/generate', async (request, reply) => {
  const { prompt, apiKeys, uiStyles, ollamaUrl, leanMode } = request.body;
  const activeProvider = await getSetting('activeProvider');

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
        const archPrompt = `You are a Principal Architect. Generate a comprehensive architecture blueprint for this feature: "${prompt}". UI Styles: ${uiStyles?.join(', ')}. Use Markdown. ALWAYS append a \`\`\`mermaid flowchart TD\`\`\` code block representing the architecture at the bottom.`;
        
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
        await recordMetric('Local (Ollama)', latency, tokens, 0); 
        
        if (activeProvider.startsWith('Local')) {
          fs.writeFileSync(ARCHITECTURE_FILE, localDraft, 'utf-8');
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
    const claudeModel = leanMode ? 'claude-3-haiku-20240307' : 'claude-sonnet-4-5-20250929';
    const claude = new ChatAnthropic({ apiKey: claudeKey, model: claudeModel });
    const deepseek = new ChatOpenAI({ apiKey: deepseekKey, configuration: { baseURL: 'https://api.deepseek.com/v1' }, model: 'deepseek-chat' });
    const geminiModel = leanMode ? 'gemini-1.5-flash' : 'gemini-2.5-pro';
    
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

    const memories = await getAllMemories();
    const memoryString = memories.map(m => `- ${m.topic}: ${m.details}`).join('\\n');

    // ROUND 1: Gemini (or Hybrid Skeleton)
    let geminiDraft = checkpoint.geminiDraft;
    if (activeProvider.startsWith('Hybrid') && localDraft.length > 50 && !forceCloud) {
      broadcastStatus('[Hybrid] Passing Local Draft to Cloud Models for Polish...');
      geminiDraft = localDraft;
      if (isSSE) {
         reply.raw.write(`data: ${JSON.stringify({ chunk: "\\n\\n---\\n\\n> ⚡ *Local Skeleton Complete. Handing off to Cloud Debate Engine for Polish...*\\n\\n" })}\\n\\n`);
      }
    } else if (!geminiDraft) {
      broadcastStatus('[Round 1] Gemini 2.5 Pro is drafting...');
      const architecturePrompt = `You are an expert Software Architect (Gemini). User Prompt: "${prompt}"\\nContext:\\n${memoryString}\\nGenerate a comprehensive architecture blueprint in Markdown. ALWAYS append a \`\`\`mermaid flowchart TD\`\`\` code block representing the architecture at the bottom.`;
      const t1 = Date.now();
      const archResponse = await ai.models.generateContent({ model: geminiModel, contents: architecturePrompt });
      
      const tokensIn = archResponse.usageMetadata?.promptTokenCount || Math.floor(architecturePrompt.length / 4);
      const tokensOut = archResponse.usageMetadata?.candidatesTokenCount || Math.floor(archResponse.text.length / 4);
      const cost = (tokensIn * 0.00125 / 1000) + (tokensOut * 0.005 / 1000);
      
      await recordMetric('Gemini', Date.now() - t1, tokensIn + tokensOut, cost);

      geminiDraft = archResponse.text;
      checkpoint.geminiDraft = geminiDraft;
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint), 'utf-8');
    }

    // ROUND 2: Claude
    let claudeCritique = checkpoint.claudeCritique;
    if (!claudeCritique) {
      broadcastStatus('[Round 2] Claude 4.5 Sonnet is critiquing...');
      const claudePrompt = `Critique this proposed architecture aggressively:\\n${geminiDraft}`;
      const t2 = Date.now();
      const claudeResponse = await claude.invoke(claudePrompt);
      
      const tokensIn = claudeResponse.response_metadata?.usage?.input_tokens || Math.floor(claudePrompt.length / 4);
      const tokensOut = claudeResponse.response_metadata?.usage?.output_tokens || Math.floor(claudeResponse.content.length / 4);
      const cost = (tokensIn * 0.003 / 1000) + (tokensOut * 0.015 / 1000);
      
      await recordMetric('Claude', Date.now() - t2, tokensIn + tokensOut, cost);

      claudeCritique = claudeResponse.content;
      checkpoint.claudeCritique = claudeCritique;
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint), 'utf-8');
    }

    // ROUND 3: DeepSeek
    broadcastStatus('[Round 3] DeepSeek finalizing...');
    const finalPrompt = `Synthesize original draft and critique into final Markdown blueprint.\\nOriginal:\\n${geminiDraft}\\nCritique:\\n${claudeCritique}`;
    let finalArchitecture = "";
    try {
      const t3 = Date.now();
      const deepseekResponse = await deepseek.invoke(finalPrompt);
      
      const tokensIn = deepseekResponse.response_metadata?.tokenUsage?.promptTokens || Math.floor(finalPrompt.length / 4);
      const tokensOut = deepseekResponse.response_metadata?.tokenUsage?.completionTokens || Math.floor(deepseekResponse.content.length / 4);
      const cost = (tokensIn * 0.00014 / 1000) + (tokensOut * 0.00028 / 1000);
      
      await recordMetric('DeepSeek', Date.now() - t3, tokensIn + tokensOut, cost);
      finalArchitecture = deepseekResponse.content;
    } catch (e) {
      broadcastStatus(`[Fallback] DeepSeek failed. Gemini is finalizing...`);
      const t4 = Date.now();
      const fbResponse = await ai.models.generateContent({ model: geminiModel, contents: finalPrompt });
      
      const tokensIn = fbResponse.usageMetadata?.promptTokenCount || Math.floor(finalPrompt.length / 4);
      const tokensOut = fbResponse.usageMetadata?.candidatesTokenCount || Math.floor(fbResponse.text.length / 4);
      const cost = (tokensIn * 0.00125 / 1000) + (tokensOut * 0.005 / 1000);
      
      await recordMetric('Gemini', Date.now() - t4, tokensIn + tokensOut, cost);
      finalArchitecture = fbResponse.text;
    }

    fs.writeFileSync(ARCHITECTURE_FILE, finalArchitecture, 'utf-8');
    
    broadcastStatus('Running Static Security Audit...');
    const securityAudit = auditArchitecture(finalArchitecture);

    broadcastStatus('Multi-Agent Debate complete!');
    if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);

    if (isSSE) {
      reply.raw.write(`data: ${JSON.stringify({ replace_all: finalArchitecture, securityAudit })}\\n\\n`);
      reply.raw.end();
      return reply;
    } else {
      return { success: true, architecture: finalArchitecture, securityAudit };
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

const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Fastify Server with WebSockets listening on port ${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
start();
