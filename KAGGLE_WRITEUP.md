# StructZero — The Multi-Agent Planning Layer for Agentic IDEs, built on MCP

**Subtitle:** How a 4-agent AI pipeline transforms shallow IDE-generated code into production-grade software architecture — before a single line is written

**Track:** Agents for Business

---

## The Problem: Agentic IDEs Are Excellent Executors but Weak Planners

Modern agentic IDEs like Antigravity, Cursor, and Windsurf have transformed how developers write code. Give them a prompt — "design an Android weather app" — and they generate a working scaffold in minutes.

But this power has a hidden cost: **the quality of the output is bounded by the quality of the plan**. When you give a vague prompt directly to an IDE, it generates shallow, first-draft code — no offline sync strategy, no error recovery, no security hardening, no production observability. The IDE is an exceptional executor. It is not an architect.

The result is a predictable pattern in engineering teams: a developer writes a prompt, gets a basic scaffold, then spends 2–3 days refactoring it because it wasn't designed for production from the start. This is expensive, demoralizing, and completely avoidable.

---

## The Solution: StructZero as the Missing Planning Layer

StructZero sits upstream of any agentic IDE. Instead of prompting the IDE directly, a developer sends their prompt to StructZero first. StructZero runs it through a **4-agent AI pipeline** that produces a detailed, production-hardened architectural blueprint. That blueprint becomes the IDE's input — and the IDE, now working from a concrete plan instead of a vague description, generates dramatically better code.

**The before/after is the core demonstration:**

1. **Direct IDE prompt:** *"Design an Android app for live weather"* → IDE generates a basic Activity with a hardcoded API call. No offline support. No error handling. No architecture.

2. **StructZero-mediated prompt:** Same prompt → 4-agent debate produces a blueprint specifying: Room database for offline cache, WorkManager for background sync, Retrofit with OkHttp interceptors, MVVM with LiveData, exponential retry logic, and certificate pinning. → IDE is asked to **implement** the blueprint directly → generates production-shaped code.

Same IDE. Same base model. Dramatically different output — because the planning happened upstream, and the IDE was given a plan to execute rather than a vague idea to interpret.

---

## Architecture: The 4-Agent Pipeline

StructZero orchestrates four AI agents, each with a distinct role and adversarial incentive:

### Agent 1 — Gemini 2.5 Pro (The Architect)
Receives the user's prompt enriched with:
- Persistent memory bank (previous project decisions, tech stack preferences)
- Skills Library RAG context (matching patterns from past blueprints)
- User-configured ACL guardrails (team-wide constraints injected into every prompt)

Produces the initial architecture blueprint in Markdown.

### Agent 2 — Claude Sonnet (The Critic)
Receives the Gemini draft with Reviewer-role constraints. Its sole instruction: **find problems**. Missing rate limiting? Flag it. Weak CORS? Flag it. Over-engineered component? Flag it. Claude is explicitly incentivized to disagree with the draft rather than validate it.

### Agent 3 — DeepSeek Chat (The Compiler)
Receives both the original draft and the full critique. Synthesizes them into a final, balanced blueprint that preserves the architectural vision while addressing every critique. If unavailable, Gemini handles this round as an automatic fallback.

### Agent 4 — Google ADK LlmAgent (The Production Gatekeeper)
After the 3-way LangGraph debate produces the final blueprint, a **Google ADK `LlmAgent`** performs a structured production readiness review across 7 operational dimensions: Observability, Resilience, Security, Scalability, Operability, Performance, and Data Integrity. Each dimension receives PASS / WARN / BLOCK status with a specific, actionable note.

The ADK agent scores the blueprint 0–100. If gaps are found, a single click on **"Improve Blueprint with ADK Findings"** re-injects all WARN and BLOCK items as hard constraints into the debate engine, triggering a new generation that explicitly resolves every flagged issue.

This creates a feedback loop: **LangGraph debate → ADK review → constraint injection → improved debate** — a closed production hardening cycle. Note this loop re-runs the full 3-agent debate, so a blueprint requiring two hardening passes costs roughly double the API spend of a single pass — a deliberate tradeoff of cost for correctness that's configurable per project.

---

## MCP Server: IDE Integration via Model Context Protocol

The core of StructZero's IDE integration is a full **Model Context Protocol server** (`mcp.js`) implementing the MCP SDK with 8 callable tools and 1 persistent resource.

Any MCP-compatible IDE — Antigravity, Cursor, Claude Desktop — connects to StructZero via stdio. From within the IDE, developers can:

- Call `generate_architecture` to trigger the full 4-agent pipeline
- Call `review_codebase` to audit code against the active blueprint
- Call `analyze_workspace` for a deep architectural review of any codebase
- Call `search_skills` to retrieve reusable patterns from the library
- Call `store_memory` / `search_memory` to persist decisions across sessions

The `workspace://context` resource gives any connected IDE AI the full active blueprint plus memory bank as a single Markdown context — ensuring IDE agents and the planning pipeline always share the same ground truth.

When StructZero generates a new blueprint from any source (web UI or IDE tool call), a Socket.io `architecture_update` event broadcasts the result to all connected clients simultaneously. Multiple developers can connect separate IDE instances to the same StructZero server — and any generation from any tool appears as a new version in the shared web dashboard.

---

## Security: Defense Before Code Is Written

StructZero enforces security at every layer:

**Static Application Security Testing (SAST):** Every blueprint is automatically audited for OWASP Top 10 patterns — missing rate limiting, weak CORS, absent authentication, XSS vectors, SQL injection risks, missing security headers. An "Auto-Fix" button re-runs the debate with the vulnerability as an explicit constraint.

**ACL Guardrails:** Teams configure per-model constraint rules that are injected into every LLM prompt. A global constraint like "never recommend plaintext password storage" propagates to all four agents simultaneously.

**Resilience Infrastructure:** Opossum circuit breaker for automatic cloud/local failover; p-queue concurrency control to prevent local model resource exhaustion; configurable budget breaker to cap monthly API spend.

**Credential Handling:** No API keys are hardcoded anywhere in the codebase. All secrets load from a local `.env` file excluded via `.gitignore`; the ADK subprocess receives its key via environment variable, not command-line argument, avoiding exposure through process listings.

---

## Skills Library: Compound Architectural Intelligence

Every blueprint generated by the debate engine passes through a background pipeline that extracts 1–3 reusable "skills" — isolated architectural patterns tagged by technology domain.

These serve two functions: the `search_skills` MCP tool lets any IDE retrieve relevant patterns without re-running the full debate (reducing token cost for common, previously-solved patterns); and when generating new blueprints, matching skills are injected as RAG context into the Gemini prompt, ensuring institutional knowledge compounds over time rather than being regenerated from scratch.

---

## Why Multi-Agent?

A single LLM asked for architecture advice tends to validate whatever framing the question provides — ask it "should I use microservices?" and it says yes; ask it "should I use a monolith?" and it also says yes. Splitting the work into four agents with opposing incentives directly counters this: Claude's Critic role is rewarded for finding flaws, not agreeing; the ADK Gatekeeper is structured to flag gaps, not approve designs; DeepSeek's Compiler role must resolve genuine tension between the two rather than pick a side. The result is a blueprint that has been adversarially stress-tested before it reaches the IDE — something a single-pass prompt to one model structurally cannot produce.

---

## Course Concepts Applied

| Concept | Implementation |
|---------|---------------|
| **Multi-Agent System (ADK)** | Google ADK `LlmAgent` as Production Gatekeeper (Round 4); LangGraph state machine for Rounds 1–3 |
| **MCP Server** | Full MCP SDK implementation: 8 tools, 1 resource, stdio transport |
| **Antigravity** | Primary development environment; core use case (planning layer for Antigravity IDE) |
| **Security Features** | SAST scanner, ACL guardrails, circuit breakers, budget limits |
| **Deployability** | Single-command local setup; documented setup in README |
| **Agent Skills** | Auto-extracted Skills Library with `search_skills` MCP tool and RAG injection |

---

## Business Value

### The real cost isn't the planning — it's the rework

When a developer prompts an agentic IDE directly, the first response is rarely the last one. A vague prompt produces a shallow scaffold, and the developer then has to go back and forth — fine-tuning the architecture, correcting the IDE's choices, and, in practice, sometimes troubleshooting outdated APIs or deprecated libraries the IDE suggested with confidence. Every one of those correction cycles is another round of tokens spent mid-build, on top of whatever time the developer loses context-switching into debugging mode.

StructZero front-loads that correction into the planning stage, where it's cheap, instead of the coding stage, where it's expensive. The 4-agent debate costs a few cents up front. But because the blueprint has already been adversarially critiqued and production-gated before it ever reaches the IDE, the IDE has far less to get wrong — meaning fewer troubleshooting round-trips during implementation, and less token spend recovering from an outdated dependency or a missed edge case discovered mid-build. A few extra cents at the planning stage is, in practice, some of the cheapest API spend in the entire development cycle.

### Beyond engineering teams: making agentic IDEs usable for non-coders too

Because StructZero's blueprint is a structured, readable document rather than raw code, someone without an engineering background can use the StructZero UI, generate an architecture plan for their idea, and paste that plan directly into the chat box of any agentic IDE. The IDE then has a real specification to implement against, rather than trying to infer one from a single vague sentence. This turns tools like Antigravity from something that mainly rewards developers who already know what to ask for, into something a non-coder can point at a well-formed plan and get a genuinely production-shaped result back. StructZero doesn't just make agentic IDEs more accurate for engineers — it raises the floor for everyone else using them.

### Summary

- **Time reallocation:** each blueprint that would otherwise require a senior engineer's manual design review — plus the IDE troubleshooting cycles that typically follow a vague prompt — is generated and adversarially checked in minutes rather than hours.
- **Fewer mid-build corrections:** planning-stage critique catches outdated APIs, missing error handling, and architectural gaps before the IDE writes code against them, avoiding the token cost of discovering and fixing them mid-implementation.
- **Earlier defect detection:** OWASP-class issues caught in the blueprint stage are, by any standard software-engineering estimate, cheaper to fix than the same issues caught after code is written or after release — the exact magnitude varies by team and industry, so we present this as a directional argument rather than a fixed dollar figure.
- **API cost per full 4-agent pipeline run:** ~$0.05 (roughly double if an ADK-triggered hardening pass re-runs the debate) — a small, predictable cost against the larger, unpredictable cost of mid-build troubleshooting it's designed to prevent.
- **Accessibility:** a non-coder can generate a blueprint through the StructZero UI and feed it directly into any agentic IDE's chat box, getting a materially better result without needing to know what to ask for in the first place.
- **Knowledge retention:** every blueprint's extracted patterns persist in the Skills Library, so institutional architecture decisions survive team turnover instead of living only in one engineer's head.

---

## Limitations & Honest Tradeoffs

No system is free of tradeoffs, and naming them here rather than leaving them to be discovered:

- **Sequential API dependency.** The 3-agent debate calls Gemini, then Claude, then DeepSeek in sequence — a slow or unavailable provider adds latency to every generation. DeepSeek has an automatic Gemini fallback; Gemini and Claude currently do not.
- **Cost scales with hardening passes.** Each ADK-triggered re-debate roughly doubles API spend for that blueprint. This is a deliberate cost-for-correctness tradeoff, and it's configurable — teams on a tighter budget can review ADK findings manually instead of auto-re-running.
- **Blueprint quality still depends on prompt clarity.** StructZero meaningfully improves on a vague prompt, but it isn't a substitute for a developer who understands the problem domain — it structures and stress-tests the plan, it doesn't invent requirements the user never expressed.
- **Local-first, single-machine by default.** SQLite persistence is intentionally zero-infrastructure for solo/small-team use; a larger team running this as shared infrastructure would want to swap in a networked database and add the access-control layer this version doesn't yet enforce server-side.

---

## What's Next

Two extensions are the clearest next steps: replacing the SQLite memory bank's cosine-only search with a hybrid keyword + vector index as the Skills Library grows past a few hundred entries, and expanding the single ADK `LlmAgent` gate into a small ADK-native sub-workflow (e.g., a `SequentialAgent` covering security and cost review as distinct steps) rather than one combined dimension check.

---

## The Build

StructZero was built iteratively using Antigravity as the primary coding assistant — the same IDE it's designed to enhance. In a small recursive loop, part of StructZero's own architecture was designed by feeding its own debate engine a prompt about itself, then using that blueprint as input back into Antigravity.

The tech stack: Fastify backend with Socket.io, React/Vite frontend, LangChain/LangGraph for agent orchestration, Google ADK for the production gate, SQLite for local persistence, Monaco Editor for blueprint diffing, and Mermaid.js for live architecture diagrams.

---

## Conclusion

StructZero demonstrates that the highest-leverage application of multi-agent AI in software development is not code generation — it is **planning**. By giving four agents distinct, adversarial roles and feeding their output into the IDE as structured context, StructZero turns every agentic IDE from a first-draft code generator into a production-architecture-aware implementation engine.

The project is fully open-source, runs locally with a single `node server.js` command, and connects to any MCP-compatible IDE in under 2 minutes.
